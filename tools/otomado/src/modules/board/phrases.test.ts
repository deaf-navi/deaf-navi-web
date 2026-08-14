import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  defaultPhrases,
  LEGACY_PHRASES_KEY,
  loadPhrases,
  MAX_HISTORY,
  MAX_PHRASES,
  phrasesKey,
  pushHistory,
  removePhraseAt,
  savePhrases,
} from './phrases'

describe('phrases store', () => {
  it('provides language-specific defaults', () => {
    expect(defaultPhrases('ja')[0]).toContain('筆談')
    expect(defaultPhrases('en')[0]).toContain('deaf')
  })

  it('stores Japanese and English phrases independently', () => {
    savePhrases('ja', ['日本語の定型文'])
    savePhrases('en', ['English phrase'])
    expect(loadPhrases('ja')).toEqual(['日本語の定型文'])
    expect(loadPhrases('en')).toEqual(['English phrase'])
  })

  it('migrates legacy Japanese phrases without showing them in English', () => {
    localStorage.setItem(LEGACY_PHRASES_KEY, JSON.stringify(['筆談でお願いします', 'ありがとう']))

    expect(loadPhrases('en')[0]).toContain('deaf')
    expect(loadPhrases('ja')).toEqual(['筆談でお願いします', 'ありがとう'])
    expect(localStorage.getItem(LEGACY_PHRASES_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(phrasesKey('ja'))!)).toEqual([
      '筆談でお願いします',
      'ありがとう',
    ])
  })

  it('migrates legacy English phrases into the English store', () => {
    localStorage.setItem(LEGACY_PHRASES_KEY, JSON.stringify(defaultPhrases('en')))
    expect(loadPhrases('en')).toEqual(defaultPhrases('en'))
    expect(localStorage.getItem(phrasesKey('ja'))).toBeNull()
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
