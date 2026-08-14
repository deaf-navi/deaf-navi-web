import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  defaultPhrases,
  loadPhrases,
  MAX_HISTORY,
  MAX_PHRASES,
  pushHistory,
  removePhraseAt,
  savePhrases,
} from './phrases'

describe('phrases store', () => {
  it('provides language-specific defaults', () => {
    expect(defaultPhrases('ja')[0]).toContain('筆談')
    expect(defaultPhrases('en')[0]).toContain('deaf')
  })

  it('round-trips through localStorage', () => {
    savePhrases(['a', 'b'])
    expect(loadPhrases('ja')).toEqual(['a', 'b'])
  })

  it('addPhrase trims, dedupes and caps', () => {
    expect(addPhrase(['a'], '  b  ')).toEqual(['a', 'b'])
    expect(addPhrase(['a'], 'a')).toEqual(['a'])
    expect(addPhrase(['a'], '   ')).toEqual(['a'])
    const full = Array.from({ length: MAX_PHRASES }, (_, i) => `p${i}`)
    expect(addPhrase(full, 'new')).toBe(full)
  })

  it('removePhraseAt removes by index and ignores out-of-range', () => {
    expect(removePhraseAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
    expect(removePhraseAt(['a'], 5)).toEqual(['a'])
  })
})

describe('board history', () => {
  it('pushes to the front and dedupes', () => {
    let h = pushHistory([], 'first')
    h = pushHistory(h, 'second')
    expect(h).toEqual(['second', 'first'])
    h = pushHistory(h, 'second') // 直前と同じ → 変化なし
    expect(h).toEqual(['second', 'first'])
    h = pushHistory(h, 'first') // 既存は先頭に移動
    expect(h).toEqual(['first', 'second'])
  })

  it('caps history length', () => {
    let h: string[] = []
    for (let i = 0; i < MAX_HISTORY + 5; i++) h = pushHistory(h, `t${i}`)
    expect(h.length).toBe(MAX_HISTORY)
    expect(h[0]).toBe(`t${MAX_HISTORY + 4}`)
  })
})
