// Minimal, correct CSV. Quotes any field containing a comma, quote or newline
// and doubles embedded quotes (RFC 4180). CRLF line endings + a UTF-8 BOM so
// Excel opens rupee amounts and non-ASCII names without mojibake.

export type CsvCell = string | number | null | undefined

function escape(v: CsvCell): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  return '﻿' + lines.join('\r\n')
}
