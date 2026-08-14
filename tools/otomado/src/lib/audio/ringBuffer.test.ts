import { describe, expect, it } from 'vitest'
import { RingBuffer } from './ringBuffer'

describe('RingBuffer', () => {
  it('returns null until enough samples are written', () => {
    const rb = new RingBuffer(10)
    rb.write(new Float32Array([1, 2, 3]))
    expect(rb.readLast(5)).toBeNull()
    expect(Array.from(rb.readLast(3)!)).toEqual([1, 2, 3])
  })

  it('keeps the most recent samples across wraparound', () => {
    const rb = new RingBuffer(5)
    rb.write(new Float32Array([1, 2, 3, 4]))
    rb.write(new Float32Array([5, 6, 7]))
    expect(Array.from(rb.readLast(5)!)).toEqual([3, 4, 5, 6, 7])
  })

  it('handles chunks larger than capacity', () => {
    const rb = new RingBuffer(3)
    rb.write(new Float32Array([1, 2, 3, 4, 5]))
    expect(Array.from(rb.readLast(3)!)).toEqual([3, 4, 5])
  })
})
