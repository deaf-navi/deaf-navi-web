import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ALERT_SECONDS_OPTIONS, type CategoryId, type Settings } from '../types'
import { loadJSON, saveJSON } from '../lib/storage'
import { makeT, type Translator } from '../i18n'

export const SETTINGS_KEY = 'otomado:settings:v1'
const THEME_COLORS = {
  aurora: '#08766d',
  dark: '#111214',
  light: '#08766d',
  green: '#102522',
} as const

export function defaultSettings(): Settings {
  const browserLang =
    typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('en')
      ? 'en'
      : 'ja'
  return {
    lang: browserLang,
    theme: 'aurora',
    vibration: true,
    srAnnounce: true,
    sensitivity: 3,
    enabled: {
      chime: true,
      siren: true,
      baby: true,
      phone: true,
      beep: true,
      knock: true,
      dog: true,
      shout: true,
      horn: false,
      loud: true,
    },
    captionScale: 3,
    boardScale: 3,
    alertSeconds: 0,
  }
}

export function loadSettings(): Settings {
  const defaults = defaultSettings()
  const saved = loadJSON<Partial<Settings>>(SETTINGS_KEY, {})
  const enabled: Record<CategoryId, boolean> = { ...defaults.enabled, ...(saved.enabled ?? {}) }
  const merged: Settings = { ...defaults, ...saved, enabled }
  // 値域の防御
  if (![1, 2, 3, 4, 5].includes(merged.sensitivity)) merged.sensitivity = 3
  if (merged.lang !== 'ja' && merged.lang !== 'en') merged.lang = defaults.lang
  if (!['aurora', 'dark', 'light', 'green'].includes(merged.theme)) merged.theme = 'aurora'
  merged.captionScale = clampScale(merged.captionScale)
  merged.boardScale = clampScale(merged.boardScale)
  if (!(ALERT_SECONDS_OPTIONS as readonly number[]).includes(merged.alertSeconds)) {
    merged.alertSeconds = 0
  }
  return merged
}

export function clampScale(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 3
  return Math.min(6, Math.max(1, v))
}

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  setCategoryEnabled: (id: CategoryId, on: boolean) => void
  t: Translator
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveJSON(SETTINGS_KEY, next)
      return next
    })
  }, [])

  const setCategoryEnabled = useCallback((id: CategoryId, on: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, enabled: { ...prev.enabled, [id]: on } }
      saveJSON(SETTINGS_KEY, next)
      return next
    })
  }, [])

  // テーマ適用（端末設定には追従せず、利用者が選んだ配色を常に保つ）
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[settings.theme])
  }, [settings.theme])

  // 言語適用
  useEffect(() => {
    document.documentElement.lang = settings.lang
  }, [settings.lang])

  const t = useMemo(() => makeT(settings.lang), [settings.lang])

  const value = useMemo(
    () => ({ settings, update, setCategoryEnabled, t }),
    [settings, update, setCategoryEnabled, t],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
