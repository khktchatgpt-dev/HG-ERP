import type { CutLine, CutPatternPiece } from './types'

/** 1390 → "1390", 1390.5 → "1390,5" — mm theo lối viết Việt, không đuôi ".0". */
export const fmtMm = (v: number) =>
  (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10)).replace('.', ',')

/** 5560 mm → "5,56 m". */
export const fmtM = (mm: number) =>
  `${(Math.round(mm / 10) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m`

/**
 * "2 × 1390 (Chân sau)  +  3 × 390 (Chân trước)" — một câu cho cả màn hình và
 * Excel, để thợ đọc ở đâu cũng cùng một cách.
 */
export function patternText(
  pieces: CutPatternPiece[],
  byKey: Map<number, CutLine>,
): string {
  return pieces
    .map((p) => {
      const l = byKey.get(p.id)
      const len = l && typeof l.length_mm === 'number' ? fmtMm(l.length_mm) : '?'
      const who = l?.part_name.trim()
      return `${p.count} × ${len}${who ? ` (${who})` : ''}`
    })
    .join('  +  ')
}
