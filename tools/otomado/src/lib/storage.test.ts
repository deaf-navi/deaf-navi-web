import { describe, expect, it } from 'vitest'
import { clearAllAppData, loadJSON, saveJSON } from './storage'

describe('storage', () => {
  it('round-trips JSON values', () => {
    saveJSON('otomado:test', { a: 1 })
    expect(loadJSON('otomado:test', null)).toEqual({ a: 1 })
  })

  it('returns the fallback for missing keys', () => {
    expect(loadJSON('otomado:missing', 'fb')).toBe('fb')
  })

  it('returns the fallback for corrupted JSON', () => {
    localStorage.setItem('otomado:bad', '{oops')
    expect(loadJSON('otomado:bad', 42)).toBe(42)
  })

  it('clearAllAppData removes only app keys', () => {
    localStorage.setItem('otomado:a', '1')
    localStorage.setItem('otomado:b', '2')
    localStorage.setItem('other:key', '3')
    clearAllAppData()
    expect(localStorage.getItem('otomado:a')).toBeNull()
    expect(localStorage.getItem('otomado:b')).toBeNull()
    expect(localStorage.getItem('other:key')).toBe('3')
  })
})
