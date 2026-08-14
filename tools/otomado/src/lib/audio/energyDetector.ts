import type { Sensitivity } from '../../types'

/**
 * Layer 1: エネルギー（RMS）ベースの「大きな音」検知。
 * AIモデルが無くても常に動作するフォールバック。
 *
 * - 環境ノイズの基準値を指数移動平均（EMA）で学習する
 * - RMS が「基準値 × 感度係数」と絶対フロアの両方を超えたら発火
 * - 発火後はクールダウン（連続発火防止）
 */

/** 感度(1..5) → 基準値に対する倍率。感度が高いほど小さい倍率で発火する */
const RATIO_BY_SENSITIVITY: Record<Sensitivity, number> = {
  1: 8,
  2: 6,
  3: 4.5,
  4: 3.2,
  5: 2.2,
}

/** 感度(1..5) → 絶対RMSフロア。無音環境で基準値が極小になっても誤発火しないための下限 */
const FLOOR_BY_SENSITIVITY: Record<Sensitivity, number> = {
  1: 0.12,
  2: 0.09,
  3: 0.06,
  4: 0.04,
  5: 0.025,
}

export interface EnergyDetectorOptions {
  /** EMA 係数（0..1、小さいほどゆっくり学習） */
  alpha?: number
  /** 発火後のクールダウン ms */
  cooldownMs?: number
  /** 起動直後の学習ウォームアップ ms（この間は発火しない） */
  warmupMs?: number
}

export class EnergyDetector {
  private baseline = 0.01
  private readonly alpha: number
  private readonly cooldownMs: number
  private readonly warmupMs: number
  private lastFireAt = -Infinity
  private startedAt: number | null = null

  constructor(opts: EnergyDetectorOptions = {}) {
    this.alpha = opts.alpha ?? 0.02
    this.cooldownMs = opts.cooldownMs ?? 5000
    this.warmupMs = opts.warmupMs ?? 1500
  }

  /**
   * RMS サンプルを与える。発火条件を満たしたら true を返す。
   * @param rms 現在の RMS (0..1)
   * @param sensitivity 感度 1..5
   * @param now epoch ms
   */
  update(rms: number, sensitivity: Sensitivity, now: number): boolean {
    if (this.startedAt === null) this.startedAt = now

    const ratio = RATIO_BY_SENSITIVITY[sensitivity]
    const floor = FLOOR_BY_SENSITIVITY[sensitivity]
    const threshold = Math.max(floor, this.baseline * ratio)

    const inWarmup = now - this.startedAt < this.warmupMs
    const inCooldown = now - this.lastFireAt < this.cooldownMs
    const fired = !inWarmup && !inCooldown && rms >= threshold

    // 発火した瞬間の大音量は基準値に学習させない（アラート音で基準が跳ね上がるのを防ぐ）
    if (!fired) {
      this.baseline = this.baseline * (1 - this.alpha) + rms * this.alpha
    }

    if (fired) this.lastFireAt = now
    return fired
  }

  /** 現在の学習済み基準値（デバッグ・テスト用） */
  getBaseline(): number {
    return this.baseline
  }
}
