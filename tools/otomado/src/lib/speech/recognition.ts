/**
 * Web Speech API（SpeechRecognition）の薄いラッパー。
 * - continuous + interimResults で字幕向けに最適化
 * - Chrome は無音で勝手に終了するため、ユーザーが止めるまで自動再開する
 * - 標準の型定義に SpeechRecognition が無いため最小限の型を自前定義
 */

export interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string }; length: number }>
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => SpeechRecognitionLike

export function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null
}

export type CaptionError = 'not-allowed' | 'network' | 'other'

export interface CaptionEngineCallbacks {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onListeningChange: (listening: boolean) => void
  onError: (error: CaptionError) => void
}

const RESTART_DELAY_MS = 300

export class CaptionEngine {
  private rec: SpeechRecognitionLike | null = null
  private userStopped = true
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private lang = 'ja-JP'

  constructor(private readonly cb: CaptionEngineCallbacks) {}

  start(lang: string): void {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      this.cb.onError('other')
      return
    }
    this.lang = lang
    this.userStopped = false
    this.spawn(Ctor)
  }

  private spawn(Ctor: new () => SpeechRecognitionLike): void {
    const rec = new Ctor()
    rec.lang = this.lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          if (text.trim()) this.cb.onFinal(text.trim())
        } else {
          interim += text
        }
      }
      this.cb.onInterim(interim)
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        this.userStopped = true
        this.cb.onError('not-allowed')
      } else if (e.error === 'network') {
        this.userStopped = true
        this.cb.onError('network')
      }
      // 'no-speech' / 'aborted' は onend の自動再開に任せる
    }

    rec.onend = () => {
      this.cb.onInterim('')
      if (this.userStopped) {
        this.cb.onListeningChange(false)
        return
      }
      // 無音等で止まった場合は静かに再開する
      this.restartTimer = setTimeout(() => {
        if (!this.userStopped) this.spawn(Ctor)
      }, RESTART_DELAY_MS)
    }

    this.rec = rec
    try {
      rec.start()
      this.cb.onListeningChange(true)
    } catch {
      // 連続 start() の InvalidStateError 等
      this.cb.onListeningChange(false)
    }
  }

  stop(): void {
    this.userStopped = true
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    try {
      this.rec?.stop()
    } catch {
      // noop
    }
    this.rec = null
    this.cb.onListeningChange(false)
  }
}
