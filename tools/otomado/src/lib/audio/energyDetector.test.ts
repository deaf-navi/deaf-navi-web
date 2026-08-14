import { describe, expect, it } from 'vitest'
import { EnergyDetector } from './energyDetector'

function feedQuiet(d: EnergyDetector, from: number, to: number, rms = 0.01): number {
  let t = from
  for (; t < to; t += 50) d.update(rms, 3, t)
  return t
}

describe('EnergyDetector', () => {
  it('does not fire during warmup', () => {
    const d = new EnergyDetector({ warmupMs: 1000, cooldownMs: 5000 })
    expect(d.update(0.9, 5, 0)).toBe(false)
    expect(d.update(0.9, 5, 500)).toBe(false)
  })

  it('fires on a loud spike after learning a quiet baseline', () => {
    const d = new EnergyDetector({ warmupMs: 1000, cooldownMs: 5000 })
    feedQuiet(d, 0, 2000)
    expect(d.update(0.5, 3, 2050)).toBe(true)
  })

  it('respects the cooldown after firing', () => {
    const d = new EnergyDetector({ warmupMs: 1000, cooldownMs: 5000 })
    feedQuiet(d, 0, 2000)
    expect(d.update(0.5, 3, 2050)).toBe(true)
    expect(d.update(0.5, 3, 2100)).toBe(false)
    expect(d.update(0.5, 3, 7100)).toBe(true) // クールダウン明け
  })

  it('does not learn the baseline from the firing spike itself', () => {
    const d = new EnergyDetector({ warmupMs: 1000, cooldownMs: 1000 })
    feedQuiet(d, 0, 2000)
    const before = d.getBaseline()
    d.update(0.8, 3, 2050) // fire
    expect(d.getBaseline()).toBe(before)
  })

  it('is less sensitive at sensitivity 1 than 5', () => {
    const quietRms = 0.01
    const spike = 0.05
    const low = new EnergyDetector({ warmupMs: 0, cooldownMs: 0 })
    const high = new EnergyDetector({ warmupMs: 0, cooldownMs: 0 })
    for (let t = 0; t < 2000; t += 50) {
      low.update(quietRms, 1, t)
      high.update(quietRms, 5, t)
    }
    expect(low.update(spike, 1, 2050)).toBe(false)
    expect(high.update(spike, 5, 2050)).toBe(true)
  })
})
