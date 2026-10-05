import type { TagTone } from '@/components/kit'
import type { GtdQuy } from '@/lib/gia-tri-don'
import type { LaiLoVerdict } from '@/lib/lai-lo'

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
/**
 * Ngoại tệ GỌN, tròn tới đơn vị — cho dải đầu trang và bảng tổng (bản vẽ duyệt
 * 03/10/2026 in "1.582.737 USD"). Số lẻ cent chỉ làm dài ô; ngăn soi từng đơn
 * vẫn dùng `ccy` hai lẻ để đối chiếu chứng từ.
 */
export const ccyGon = (n: number, c: string) =>
  `${Math.round(n).toLocaleString('vi-VN')} ${c}`
/** "+1.500 USD chưa quy · 20 EUR chưa quy" cho phần thiếu tỷ giá. */
export const missingText = (q: GtdQuy) =>
  q.missing.map((m) => `${ccy(m.amount, m.currency)} chưa quy`).join(' · ')
/** Giá trị gốc nhiều tiền tệ: "1.582.737 USD · 2.000.000 VND". */
export const amountsText = (a: { currency: string; amount: number }[]) =>
  a.map((x) => ccy(x.amount, x.currency)).join(' · ')
/** Như `amountsText` nhưng tròn tới đơn vị (`ccyGon`). */
export const amountsGon = (a: { currency: string; amount: number }[]) =>
  a.map((x) => ccyGon(x.amount, x.currency)).join(' · ')
/** Phần trăm một lẻ kiểu Việt: 87,4%. */
export const pct = (p: number) =>
  `${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
/** Màu nhãn kết luận lãi / lỗ (chuyển từ trang /exec/lai-lo đã gỡ, 03/10/2026). */
export const VERDICT_TONE: Record<LaiLoVerdict, TagTone> = {
  lo: 'stop',
  an_lai: 'warn',
  on: 'done',
  thieu: 'neutral',
}
/** 2026-12-30 → 30/12/26. */
export const dmy = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '—'
