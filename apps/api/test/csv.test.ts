import { describe, expect, it } from 'vitest'
import { toCsv } from '../src/lib/csv.js'

// CSV export feeds a `report.export` download opened in Excel. The only way it
// corrupts data is bad escaping, so pin RFC 4180 behaviour.

describe('toCsv', () => {
  it('prefixes a UTF-8 BOM so Excel reads rupee/non-ASCII as UTF-8', () => {
    expect(toCsv(['A'], [['x']]).startsWith('﻿')).toBe(true)
  })

  it('uses CRLF line endings and a header row', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']])
    expect(csv).toBe('﻿A,B\r\n1,2')
  })

  it('quotes and doubles quotes for fields with commas, quotes or newlines', () => {
    const csv = toCsv(['Name', 'Note'], [['Patil, R', 'said "hi"'], ['multi\nline', 'plain']])
    expect(csv).toBe('﻿Name,Note\r\n"Patil, R","said ""hi"""\r\n"multi\nline",plain')
  })

  it('renders null/undefined as an empty field, not the string "null"', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('﻿A,B\r\n,')
  })

  it('stringifies numbers', () => {
    expect(toCsv(['N'], [[42]])).toBe('﻿N\r\n42')
  })
})
