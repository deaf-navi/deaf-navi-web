import { parseClassMapCsv } from './classMap'
import type { ClassScore } from './alertMapper'

/**
 * YAMNet（Google, Apache License 2.0）のロードと推論。
 *
 * モデル取得戦略:
 *   1. まず自サイト同梱（public/model/yamnet/）を試す — 同梱すれば外部依存ゼロ
 *   2. 無ければ公式ホスティングから取得（Service Worker がキャッシュし2回目以降はオフライン可）
 * どちらも失敗したらアプリはエネルギー検知のみで動作を続ける。
 */
const LOCAL_MODEL_URL = 'model/yamnet/model.json'
/** TFHub の公式配信URL（Kaggle Models へリダイレクト・CORS可・実機検証済み 2026-08-13） */
const REMOTE_MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'
const LOCAL_CLASS_MAP_URL = 'model/yamnet/yamnet_class_map.csv'
const REMOTE_CLASS_MAP_URL =
  'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'

/** YAMNet 入力: 16kHz mono, 0.975 秒 = 15600 サンプル */
export const YAMNET_INPUT_SAMPLES = 15600
export const NUM_CLASSES = 521

type Tf = typeof import('@tensorflow/tfjs')

export class YamnetClassifier {
  private constructor(
    private readonly tf: Tf,
    private readonly model: import('@tensorflow/tfjs').GraphModel,
    private readonly classNames: string[],
  ) {}

  private static loading: Promise<YamnetClassifier> | null = null

  /** 多重ロード防止のためのシングルトンロード */
  static load(): Promise<YamnetClassifier> {
    if (!this.loading) {
      this.loading = this.doLoad().catch((err) => {
        this.loading = null // 失敗したら次回リトライできるようにする
        throw err
      })
    }
    return this.loading
  }

  private static async doLoad(): Promise<YamnetClassifier> {
    const tf = await import('@tensorflow/tfjs')
    await tf.ready()

    // まず同梱モデルを試し、無ければ TFHub 公式配信から取得
    let model: import('@tensorflow/tfjs').GraphModel
    try {
      model = await tf.loadGraphModel(LOCAL_MODEL_URL)
    } catch {
      model = await tf.loadGraphModel(REMOTE_MODEL_URL, { fromTFHub: true })
    }
    const csv = await loadFirst([LOCAL_CLASS_MAP_URL, REMOTE_CLASS_MAP_URL], async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return res.text()
    })
    const classNames = parseClassMapCsv(csv)
    if (classNames.length < NUM_CLASSES) {
      throw new Error(`class map too short: ${classNames.length}`)
    }

    const classifier = new YamnetClassifier(tf, model, classNames)
    await classifier.warmup()
    return classifier
  }

  private async warmup(): Promise<void> {
    const silent = new Float32Array(YAMNET_INPUT_SAMPLES)
    await this.classify(silent, 0)
  }

  /**
   * 16kHz mono 波形を分類し、minScore 以上のクラスを「全件」スコア降順で返す。
   * 上位N件に切り詰めてはいけない: テレビ・会話のある部屋では Speech/Music 等の
   * 環境クラスが上位を占め、しきい値超えの対象音（ドアベル等）が枠から押し出されて
   * アラートが黙って落ちる。カテゴリ照合・しきい値判定は mapScores 側で行う。
   * YAMNet は複数フレームのスコアを返すため、フレーム方向の最大値を採用する
   * （短い突発音を取りこぼさないため）。
   */
  async classify(waveform16k: Float32Array, minScore = 0.05): Promise<ClassScore[]> {
    const { tf, model } = this
    const input = tf.tensor1d(waveform16k)
    const toDispose: Array<{ dispose(): void }> = [input]
    try {
      const raw = model.predict(input) as
        | import('@tensorflow/tfjs').Tensor
        | import('@tensorflow/tfjs').Tensor[]
      const outputs = Array.isArray(raw) ? raw : [raw]
      toDispose.push(...outputs)

      // 出力のうち最後の次元が 521 のテンソルがスコア（[frames, 521]）
      const scoresT = outputs.find((o) => o.shape[o.shape.length - 1] === NUM_CLASSES)
      if (!scoresT) throw new Error('YAMNet scores output not found')

      const maxT = (scoresT as import('@tensorflow/tfjs').Tensor2D).max(0)
      toDispose.push(maxT)
      const scores = (await maxT.data()) as Float32Array

      const results: ClassScore[] = []
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] >= minScore) {
          results.push({ name: this.classNames[i] ?? `class ${i}`, score: scores[i] })
        }
      }
      results.sort((a, b) => b.score - a.score)
      return results
    } finally {
      toDispose.forEach((t) => t.dispose())
    }
  }
}

async function loadFirst<T>(urls: string[], loader: (url: string) => Promise<T>): Promise<T> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      return await loader(url)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('no URLs to load')
}
