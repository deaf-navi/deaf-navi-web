import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router'

describe('parseHash', () => {
  it('maps hashes to routes', () => {
    expect(parseHash('')).toBe('home')
    expect(parseHash('#/')).toBe('home')
    expect(parseHash('#/sound')).toBe('sound')
    expect(parseHash('#/captions')).toBe('captions')
    expect(parseHash('#/board')).toBe('board')
    expect(parseHash('#/settings')).toBe('settings')
  })

  it('tolerates trailing slashes and case', () => {
    expect(parseHash('#/board/')).toBe('board')
    expect(parseHash('#/Sound')).toBe('sound')
  })

  it('falls back to home for unknown routes', () => {
    expect(parseHash('#/nope')).toBe('home')
    expect(parseHash('#garbage')).toBe('home')
  })

  it('round-trips with routeToHash', () => {
    for (const r of ['home', 'sound', 'captions', 'board', 'settings'] as const) {
      expect(parseHash(routeToHash(r))).toBe(r)
    }
  })
})
