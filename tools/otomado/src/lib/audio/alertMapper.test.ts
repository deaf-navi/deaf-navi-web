import { describe, expect, it } from 'vitest'
import { CooldownGate, mapClassName, mapScores } from './alertMapper'
import type { CategoryId } from '../../types'

const allEnabled: Record<CategoryId, boolean> = {
  chime: true,
  siren: true,
  baby: true,
  phone: true,
  beep: true,
  knock: true,
  dog: true,
  shout: true,
  horn: true,
  loud: true,
}

describe('mapClassName', () => {
  it('maps YAMNet class names to categories', () => {
    expect(mapClassName('Doorbell')).toBe('chime')
    expect(mapClassName('Ding-dong')).toBe('chime')
    expect(mapClassName('Smoke detector, smoke alarm')).toBe('siren')
    expect(mapClassName('Fire alarm')).toBe('siren')
    expect(mapClassName('Siren')).toBe('siren')
    expect(mapClassName('Baby cry, infant cry')).toBe('baby')
    expect(mapClassName('Knock')).toBe('knock')
    expect(mapClassName('Dog')).toBe('dog')
    expect(mapClassName('Bark')).toBe('dog')
    expect(mapClassName('Vehicle horn, car horn, honking')).toBe('horn')
    expect(mapClassName('Microwave oven')).toBe('beep')
    expect(mapClassName('Beep, bleep')).toBe('beep')
    expect(mapClassName('Shout')).toBe('shout')
    expect(mapClassName('Screaming')).toBe('shout')
  })

  it('gives phone priority over generic bell/alarm keywords', () => {
    expect(mapClassName('Telephone bell ringing')).toBe('phone')
    expect(mapClassName('Alarm clock')).toBe('phone')
    expect(mapClassName('Ringtone')).toBe('phone')
  })

  it('returns null for unrelated classes', () => {
    expect(mapClassName('Speech')).toBeNull()
    expect(mapClassName('Music')).toBeNull()
    expect(mapClassName('Silence')).toBeNull()
    expect(mapClassName('Guitar')).toBeNull()
  })
})

describe('mapScores', () => {
  it('picks the highest scoring mapped class above threshold', () => {
    const result = mapScores(
      [
        { name: 'Speech', score: 0.9 },
        { name: 'Doorbell', score: 0.6 },
        { name: 'Dog', score: 0.4 },
      ],
      0.3,
      allEnabled,
    )
    expect(result).toEqual({ category: 'chime', className: 'Doorbell', score: 0.6 })
  })

  it('respects the threshold', () => {
    expect(mapScores([{ name: 'Doorbell', score: 0.2 }], 0.3, allEnabled)).toBeNull()
  })

  it('skips disabled categories and falls through to the next match', () => {
    const enabled = { ...allEnabled, chime: false }
    const result = mapScores(
      [
        { name: 'Doorbell', score: 0.6 },
        { name: 'Dog', score: 0.4 },
      ],
      0.3,
      enabled,
    )
    expect(result?.category).toBe('dog')
  })

  it('returns null when nothing matches', () => {
    expect(mapScores([{ name: 'Speech', score: 0.99 }], 0.3, allEnabled)).toBeNull()
  })

  it('finds a target sound even when many ambient classes score higher (no top-5 truncation)', () => {
    // テレビのある部屋の典型: 環境クラス6件が上位を占め、対象音は7位
    const ambient = [
      { name: 'Speech', score: 0.95 },
      { name: 'Television', score: 0.9 },
      { name: 'Music', score: 0.85 },
      { name: 'Inside, small room', score: 0.8 },
      { name: 'Narration, monologue', score: 0.7 },
      { name: 'Conversation', score: 0.6 },
    ]
    const result = mapScores([...ambient, { name: 'Doorbell', score: 0.45 }], 0.3, allEnabled)
    expect(result).toEqual({ category: 'chime', className: 'Doorbell', score: 0.45 })
  })
})

describe('CooldownGate', () => {
  it('blocks repeated fires within the cooldown window per category', () => {
    const gate = new CooldownGate(6000)
    expect(gate.tryFire('chime', 0)).toBe(true)
    expect(gate.tryFire('chime', 3000)).toBe(false)
    expect(gate.tryFire('dog', 3000)).toBe(true) // 別カテゴリは独立
    expect(gate.tryFire('chime', 6001)).toBe(true)
  })
})
