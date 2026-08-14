import { describe, expect, it } from 'vitest'
import { captionsReducer, initialCaptionsState, MAX_FINALS } from './reducer'

describe('captionsReducer', () => {
  it('sets interim text', () => {
    const s = captionsReducer(initialCaptionsState, { type: 'interim', text: 'こん' })
    expect(s).toEqual({ finals: [], interim: 'こん' })
  })

  it('appends a final line and clears interim', () => {
    const s1 = captionsReducer(initialCaptionsState, { type: 'interim', text: 'こんにちは' })
    const s2 = captionsReducer(s1, { type: 'final', text: 'こんにちは ' })
    expect(s2).toEqual({ finals: ['こんにちは'], interim: '' })
  })

  it('ignores empty final results', () => {
    const s = captionsReducer(initialCaptionsState, { type: 'final', text: '   ' })
    expect(s.finals).toEqual([])
  })

  it('clears everything', () => {
    const s1 = captionsReducer(initialCaptionsState, { type: 'final', text: 'a' })
    expect(captionsReducer(s1, { type: 'clear' })).toEqual(initialCaptionsState)
  })

  it('trims the oldest lines beyond MAX_FINALS', () => {
    let s = initialCaptionsState
    for (let i = 0; i < MAX_FINALS + 10; i++) {
      s = captionsReducer(s, { type: 'final', text: `line ${i}` })
    }
    expect(s.finals.length).toBe(MAX_FINALS)
    expect(s.finals[0]).toBe('line 10')
    expect(s.finals.at(-1)).toBe(`line ${MAX_FINALS + 9}`)
  })
})
