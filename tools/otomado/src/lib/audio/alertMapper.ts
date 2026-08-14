import type { CategoryId, Sensitivity } from '../../types'

/**
 * YAMNet（AudioSet 521クラス）の display_name をアラートカテゴリへ対応付ける。
 * クラス index ではなく名前のキーワードで照合する — クラスマップCSVの版差に強い。
 *
 * 照合はカテゴリ順に行い、最初に一致したカテゴリを採用する。
 * 順序が重要: 例「Telephone bell ringing」は 'bell' で chime にも一致するため phone を先に置く。
 */
const CATEGORY_KEYWORDS: Array<[CategoryId, string[]]> = [
  ['phone', ['telephone', 'ringtone', 'ringer', 'alarm clock', 'phone']],
  ['baby', ['baby cry', 'infant cry', 'crying, sobbing', 'whimper']],
  ['dog', ['dog', 'bark', 'howl', 'bow-wow', 'growling', 'yip']],
  ['knock', ['knock']],
  ['horn', ['vehicle horn', 'car horn', 'honk', 'air horn', 'truck horn', 'train horn', 'foghorn']],
  ['beep', ['beep', 'bleep', 'microwave oven']],
  [
    'siren',
    ['siren', 'smoke detector', 'fire alarm', 'car alarm', 'civil defense', 'emergency vehicle', 'alarm'],
  ],
  ['chime', ['doorbell', 'ding-dong', 'buzzer', 'chime', 'bell']],
  ['shout', ['shout', 'yell', 'scream', 'bellow']],
]

export function mapClassName(displayName: string): CategoryId | null {
  const name = displayName.toLowerCase()
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (name.includes(kw)) return category
    }
  }
  return null
}

export interface ClassScore {
  name: string
  score: number
}

export interface MappedAlert {
  category: CategoryId
  className: string
  score: number
}

/** 感度(1..5) → 分類スコアのしきい値。感度が高いほど低スコアでも通知する */
export const CLASSIFY_THRESHOLD: Record<Sensitivity, number> = {
  1: 0.5,
  2: 0.4,
  3: 0.3,
  4: 0.22,
  5: 0.15,
}

/**
 * スコア上位のクラスから、有効なカテゴリに対応する最初のものを返す。
 * @param entries スコア降順である必要はない（内部でソートする）
 */
export function mapScores(
  entries: ClassScore[],
  threshold: number,
  enabled: Record<CategoryId, boolean>,
): MappedAlert | null {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  for (const { name, score } of sorted) {
    if (score < threshold) break
    const category = mapClassName(name)
    if (category && enabled[category]) {
      return { category, className: name, score }
    }
  }
  return null
}

/** カテゴリごとの連続発火を防ぐクールダウンゲート */
export class CooldownGate {
  private lastFire = new Map<CategoryId, number>()

  constructor(private readonly cooldownMs: number = 6000) {}

  tryFire(category: CategoryId, now: number): boolean {
    const last = this.lastFire.get(category) ?? -Infinity
    if (now - last < this.cooldownMs) return false
    this.lastFire.set(category, now)
    return true
  }
}
