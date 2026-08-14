import { describe, expect, it } from 'vitest'
import { ja } from './ja'
import { en } from './en'
import { interpolate, translate } from './index'

describe('i18n dictionaries', () => {
  it('en covers exactly the same keys as ja', () => {
    const jaKeys = Object.keys(ja).sort()
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(jaKeys)
  })

  it('has no empty messages', () => {
    for (const [key, value] of Object.entries({ ...ja, ...en })) {
      expect(value.trim(), `empty message for ${key}`).not.toBe('')
    }
  })

  it('explains vibration support and limitations', () => {
    expect(ja['settings.vibrationNote']).toContain('Android')
    expect(ja['settings.vibrationNote']).toContain('iPhone・iPad')
    expect(en['settings.vibrationNote']).toContain('Android')
    expect(en['settings.vibrationNote']).toContain('iPhone and iPad')
  })

  it('placeholders in ja exist in en too', () => {
    for (const key of Object.keys(ja) as Array<keyof typeof ja>) {
      const jaParams = [...ja[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      const enParams = [...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(enParams, `placeholder mismatch in ${key}`).toEqual(jaParams)
    }
  })
})

describe('interpolate / translate', () => {
  it('replaces named params', () => {
    expect(interpolate('{name}を検知', { name: 'ノック' })).toBe('ノックを検知')
  })

  it('leaves unknown params untouched', () => {
    expect(interpolate('{name}を検知')).toBe('{name}を検知')
  })

  it('translates with params in both languages', () => {
    expect(translate('ja', 'sound.detected', { name: 'ノック' })).toBe('ノックを検知しました')
    expect(translate('en', 'sound.detected', { name: 'Knock' })).toBe('Knock detected')
  })
})
