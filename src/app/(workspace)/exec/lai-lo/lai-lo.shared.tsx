import type { LaiLoVerdict, Quy } from '@/lib/lai-lo'
import type { TagTone } from '@/components/kit'

/** Tiền VND đã quy, nhóm nghìn kiểu Việt, không lẻ. */
export const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN')
/** Ngoại tệ: hai lẻ, đủ để 10.750 không bị đọc thành 10,75. */
export const ccy = (n: number, c: string) =>
  `${n.toLocaleString('vi-VN', { maximumFractionDigits: c === 'VND' ? 0 : 2 })} ${c}`
/** Tiền tỷ gọn cho dải đầu trang: 14.097.000.000 → "14,10 tỷ". */
export function tyGon(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9)
    return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`
  if (abs >= 1e6)
    return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr`
  return vnd(n)
}
export const pct = (p: number) =>
  `${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

/** Chuỗi "chưa quy" cho phần thiếu tỷ giá: "+138.000 USD chưa quy". */
export const missingText = (q: Quy) =>
  q.missing.map((m) => `${ccy(m.amount, m.currency)} chưa quy`).join(' · ')

export const VERDICT_TONE: Record<LaiLoVerdict, TagTone> = {
  lo: 'stop',
  an_lai: 'warn',
  on: 'done',
  thieu: 'neutral',
}
