/**
 * Export mảng object → file CSV, kích trigger download tự động.
 * Escaping đúng cho comma, quote, newline theo RFC 4180.
 */
function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: readonly { key: keyof T; header: string; get?: (row: T) => unknown }[],
): void {
  const header = columns.map((c) => esc(c.header)).join(',')
  const body = rows
    .map((r) =>
      columns
        .map((c) => esc(c.get ? c.get(r) : r[c.key]))
        .join(','),
    )
    .join('\n')
  // BOM để Excel VN mở UTF-8 đúng
  const blob = new Blob(['﻿' + header + '\n' + body], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
