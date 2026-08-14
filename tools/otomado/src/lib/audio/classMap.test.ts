import { describe, expect, it } from 'vitest'
import { parseClassMapCsv } from './classMap'

describe('parseClassMapCsv', () => {
  it('parses the YAMNet class map format with quoted commas', () => {
    const csv = [
      'index,mid,display_name',
      '0,/m/09x0r,Speech',
      '1,/m/05zppz,"Male speech, man speaking"',
      '390,/m/012n7d,"Smoke detector, smoke alarm"',
    ].join('\n')
    const names = parseClassMapCsv(csv)
    expect(names[0]).toBe('Speech')
    expect(names[1]).toBe('Male speech, man speaking')
    expect(names[390]).toBe('Smoke detector, smoke alarm')
  })

  it('skips empty lines and the header', () => {
    const names = parseClassMapCsv('index,mid,display_name\n\n0,/m/09x0r,Speech\n')
    expect(names.length).toBe(1)
  })

  it('handles escaped double quotes', () => {
    const names = parseClassMapCsv('0,/m/x,"He said ""hi"", loudly"')
    expect(names[0]).toBe('He said "hi", loudly')
  })
})
