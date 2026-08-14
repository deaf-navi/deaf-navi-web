import { describe, expect, it } from 'vitest'
import { clampScale, defaultSettings, loadSettings, SETTINGS_KEY } from './settings'

describe('loadSettings', () => {
  it('returns defaults when nothing is saved', () => {
    const s = loadSettings()
    expect(s.theme).toBe('aurora')
    expect(s.sensitivity).toBe(3)
    expect(s.enabled.chime).toBe(true)
    expect(s.enabled.horn).toBe(false) // 屋外向けは既定OFF
  })

  it('merges saved partial settings over defaults', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ theme: 'dark', enabled: { horn: true } }),
    )
    const s = loadSettings()
    expect(s.theme).toBe('dark')
    expect(s.enabled.horn).toBe(true)
    expect(s.enabled.chime).toBe(true) // 未保存のカテゴリは既定値
  })

  it('sanitizes out-of-range values', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ sensitivity: 99, theme: 'neon', lang: 'fr', captionScale: 42, alertSeconds: 99 }),
    )
    const s = loadSettings()
    expect(s.sensitivity).toBe(3)
    expect(s.theme).toBe('aurora')
    expect(['ja', 'en']).toContain(s.lang)
    expect(s.captionScale).toBe(6)
    expect(s.alertSeconds).toBe(0)
  })

  it('defaults alerts to stay until closed (WCAG 2.2.1)', () => {
    expect(loadSettings().alertSeconds).toBe(0)
  })

  it('survives corrupted JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{broken')
    expect(loadSettings()).toEqual(loadSettings())
    expect(loadSettings().sensitivity).toBe(defaultSettings().sensitivity)
  })

  it.each(['aurora', 'dark', 'light', 'green'] as const)('accepts the %s theme', (theme) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme }))
    expect(loadSettings().theme).toBe(theme)
  })
})

describe('clampScale', () => {
  it('clamps to 1..6 and defaults to 3', () => {
    expect(clampScale(0)).toBe(1)
    expect(clampScale(7)).toBe(6)
    expect(clampScale(4)).toBe(4)
    expect(clampScale('x')).toBe(3)
    expect(clampScale(Number.NaN)).toBe(3)
  })
})
