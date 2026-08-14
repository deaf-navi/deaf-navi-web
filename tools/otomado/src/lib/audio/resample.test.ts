import { describe, expect, it } from 'vitest'
import { resampleTo } from './resample'

describe('resampleTo', () => {
  it('returns input unchanged when rates match', () => {
    const input = new Float32Array([0.1, 0.2, 0.3])
    expect(resampleTo(input, 16000, 16000)).toBe(input)
  })

  it('downsamples 48kHz to 16kHz at 1/3 length', () => {
    const input = new Float32Array(48000)
    const out = resampleTo(input, 48000, 16000)
    expect(out.length).toBe(16000)
  })

  it('preserves a constant signal', () => {
    const input = new Float32Array(4800).fill(0.5)
    const out = resampleTo(input, 48000, 16000)
    for (const v of out) expect(v).toBeCloseTo(0.5, 5)
  })

  it('handles empty input', () => {
    expect(resampleTo(new Float32Array(0), 48000, 16000).length).toBe(0)
  })
})
