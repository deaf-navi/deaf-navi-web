import type { CategoryId } from '../types'

/** カテゴリごとに異なる振動パターン（ms）。画面を見ていなくても区別の手がかりになる。 */
export const VIBRATION_PATTERNS: Record<CategoryId, number[]> = {
  chime: [200, 100, 200],
  siren: [400, 150, 400, 150, 400],
  baby: [150, 100, 150, 100, 150],
  phone: [300, 150, 300],
  beep: [80, 60, 80],
  knock: [100, 80, 100, 80, 100],
  dog: [120, 80, 120],
  shout: [250, 100, 250],
  horn: [500],
  loud: [400, 100, 400],
}

export function vibrate(pattern: number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // noop
  }
}

export function vibrateCategory(category: CategoryId): void {
  vibrate(VIBRATION_PATTERNS[category])
}
