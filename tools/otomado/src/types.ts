export type Route = 'home' | 'sound' | 'captions' | 'board' | 'settings'

export type ThemeSetting = 'aurora' | 'dark' | 'light' | 'green'
export type Lang = 'ja' | 'en'

/** 音アラートのカテゴリ */
export type CategoryId =
  | 'chime' // インターホン・チャイム
  | 'siren' // 警報・サイレン
  | 'baby' // 赤ちゃんの泣き声
  | 'phone' // 電話・アラーム
  | 'beep' // 家電の電子音
  | 'knock' // ノック
  | 'dog' // 犬の鳴き声
  | 'shout' // 叫び声・呼びかけ
  | 'horn' // クラクション
  | 'loud' // 大きな音（エネルギー検知フォールバック）

export const ALL_CATEGORIES: CategoryId[] = [
  'chime',
  'siren',
  'baby',
  'phone',
  'beep',
  'knock',
  'dog',
  'shout',
  'horn',
  'loud',
]

export interface SoundEvent {
  id: string
  category: CategoryId
  /** YAMNet の元クラス名（分類由来の場合のみ） */
  className?: string
  /** 0..1 のスコア（エネルギー検知は 1 固定） */
  score: number
  /** epoch ms */
  at: number
}

export type Sensitivity = 1 | 2 | 3 | 4 | 5

export interface Settings {
  lang: Lang
  theme: ThemeSetting
  vibration: boolean
  srAnnounce: boolean
  sensitivity: Sensitivity
  enabled: Record<CategoryId, boolean>
  /** 文字サイズ段階 1..6 */
  captionScale: number
  boardScale: number
  /** アラート自動クローズ秒数。0 = 閉じるまで表示（WCAG 2.2.1 対応の既定値） */
  alertSeconds: number
}

export const ALERT_SECONDS_OPTIONS = [0, 8, 30] as const
