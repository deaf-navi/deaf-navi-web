import type { CategoryId, Sensitivity } from '../../types'
import { EnergyDetector } from './energyDetector'
import { RingBuffer } from './ringBuffer'
import { resampleTo, YAMNET_SAMPLE_RATE } from './resample'
import { CooldownGate, CLASSIFY_THRESHOLD, mapScores } from './alertMapper'
import { YamnetClassifier, YAMNET_INPUT_SAMPLES } from './yamnet'

export type AiStatus = 'loading' | 'ready' | 'unavailable'
export type MicError = 'denied' | 'unavailable'

export interface EngineEvent {
  category: CategoryId
  className?: string
  score: number
}

export interface SoundEngineCallbacks {
  /** 約20回/秒。rms/peak は 0..1 */
  onLevel: (rms: number, peak: number) => void
  onEvent: (event: EngineEvent) => void
  onAiStatus: (status: AiStatus) => void
  onMicError: (kind: MicError) => void
}

export interface EngineConfig {
  sensitivity: Sensitivity
  enabled: Record<CategoryId, boolean>
}

const LEVEL_INTERVAL_MS = 50
// 解析窓は 0.975 秒。窓より短い間隔で回して未解析ギャップを作らない（短い単発音の取りこぼし防止）
const CLASSIFY_INTERVAL_MS = 900

/**
 * マイク入力の取得・レベル計測・エネルギー検知（Layer 1）・
 * YAMNet 分類（Layer 2）をまとめたエンジン。React からは start/stop/setConfig だけ触る。
 */
export class SoundEngine {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private silentGain: GainNode | null = null
  private levelTimer: ReturnType<typeof setInterval> | null = null
  private classifyTimer: ReturnType<typeof setInterval> | null = null
  private ring: RingBuffer | null = null
  private classifier: YamnetClassifier | null = null
  private classifying = false
  private stopped = false
  private readonly energy = new EnergyDetector()
  private readonly gate = new CooldownGate(6000)

  constructor(
    private config: EngineConfig,
    private readonly cb: SoundEngineCallbacks,
  ) {}

  setConfig(config: EngineConfig): void {
    this.config = config
  }

  /** @returns マイク取得に成功して監視を開始できたら true */
  async start(): Promise<boolean> {
    this.stopped = false
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cb.onMicError('unavailable')
      return false
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch {
      this.cb.onMicError('denied')
      return false
    }
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop())
      return false
    }
    this.stream = stream

    // 以降の失敗（AudioContext生成不可・ノード生成失敗・起動中の停止競合）でも
    // マイクを掴んだまま固まらないよう、必ず stop() で後始末する
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      this.ctx = ctx
      await ctx.resume().catch(() => undefined)
      if (this.stopped) {
        this.stop()
        return false
      }

      const source = ctx.createMediaStreamSource(stream)

      // レベル計測用 Analyser
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      this.analyser = analyser

      // 分類用 PCM キャプチャ（直近2秒を保持）
      this.ring = new RingBuffer(Math.ceil(ctx.sampleRate * 2))
      await this.setupCapture(ctx, source)
      if (this.stopped) {
        this.stop()
        return false
      }

      this.startLevelLoop()
      this.startClassifier()
      return true
    } catch {
      const wasCancelled = this.stopped
      this.stop()
      if (!wasCancelled) this.cb.onMicError('unavailable')
      return false
    }
  }

  private async setupCapture(ctx: AudioContext, source: MediaStreamAudioSourceNode): Promise<void> {
    // 出力ゼロの GainNode に接続してオーディオグラフを常時駆動する
    const silent = ctx.createGain()
    silent.gain.value = 0
    silent.connect(ctx.destination)
    this.silentGain = silent

    try {
      const workletUrl = new URL('worklets/capture-processor.js', document.baseURI).toString()
      await ctx.audioWorklet.addModule(workletUrl)
      const node = new AudioWorkletNode(ctx, 'otomado-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        this.ring?.write(e.data)
      }
      source.connect(node)
      node.connect(silent)
      this.workletNode = node
    } catch {
      // AudioWorklet 不可の環境向けフォールバック（非推奨APIだが動作互換のため）
      const node = ctx.createScriptProcessor(4096, 1, 1)
      node.onaudioprocess = (e) => {
        this.ring?.write(e.inputBuffer.getChannelData(0))
      }
      source.connect(node)
      node.connect(silent)
      this.scriptNode = node
    }
  }

  private startLevelLoop(): void {
    const analyser = this.analyser
    if (!analyser) return
    const buf = new Float32Array(analyser.fftSize)
    this.levelTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      let peak = 0
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i]
        sum += v * v
        const a = Math.abs(v)
        if (a > peak) peak = a
      }
      const rms = Math.sqrt(sum / buf.length)
      this.cb.onLevel(rms, peak)

      // Layer 1: 大きな音の検知
      const now = Date.now()
      if (
        this.energy.update(rms, this.config.sensitivity, now) &&
        this.config.enabled.loud &&
        this.gate.tryFire('loud', now)
      ) {
        this.cb.onEvent({ category: 'loud', score: 1 })
      }
    }, LEVEL_INTERVAL_MS)
  }

  private startClassifier(): void {
    this.cb.onAiStatus('loading')
    YamnetClassifier.load()
      .then((c) => {
        if (this.stopped) return
        this.classifier = c
        this.cb.onAiStatus('ready')
      })
      .catch(() => {
        if (!this.stopped) this.cb.onAiStatus('unavailable')
      })

    this.classifyTimer = setInterval(() => {
      void this.classifyOnce()
    }, CLASSIFY_INTERVAL_MS)
  }

  private async classifyOnce(): Promise<void> {
    const { classifier, ring, ctx } = this
    if (!classifier || !ring || !ctx || this.classifying) return
    const needed = Math.ceil((YAMNET_INPUT_SAMPLES * ctx.sampleRate) / YAMNET_SAMPLE_RATE)
    const raw = ring.readLast(needed)
    if (!raw) return

    this.classifying = true
    try {
      let wave = resampleTo(raw, ctx.sampleRate, YAMNET_SAMPLE_RATE)
      // 超過分は「古い側」を捨てて最新音声を残す
      if (wave.length > YAMNET_INPUT_SAMPLES)
        wave = wave.subarray(wave.length - YAMNET_INPUT_SAMPLES) as Float32Array
      if (wave.length < YAMNET_INPUT_SAMPLES) {
        const padded = new Float32Array(YAMNET_INPUT_SAMPLES)
        padded.set(wave)
        wave = padded
      }
      const scores = await classifier.classify(wave)
      if (this.stopped) return
      const threshold = CLASSIFY_THRESHOLD[this.config.sensitivity]
      const hit = mapScores(scores, threshold, this.config.enabled)
      if (hit && this.gate.tryFire(hit.category, Date.now())) {
        this.cb.onEvent({ category: hit.category, className: hit.className, score: hit.score })
      }
    } catch {
      // 単発の推論エラーは無視して次周期へ
    } finally {
      this.classifying = false
    }
  }

  stop(): void {
    this.stopped = true
    if (this.levelTimer !== null) clearInterval(this.levelTimer)
    if (this.classifyTimer !== null) clearInterval(this.classifyTimer)
    this.levelTimer = null
    this.classifyTimer = null
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null
      this.scriptNode.disconnect()
      this.scriptNode = null
    }
    this.silentGain?.disconnect()
    this.silentGain = null
    this.analyser?.disconnect()
    this.analyser = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
    this.ring = null
  }
}
