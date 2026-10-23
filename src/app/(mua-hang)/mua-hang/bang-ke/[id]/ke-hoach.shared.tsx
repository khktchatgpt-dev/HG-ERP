import type { BangKeRow } from '@/lib/lsx-bang-ke'
import type { DongMua } from '@/lib/lsx-bang-ke-mua'

/** Một dòng trên màn = dòng bảng kê gốc + phần tính để mua. */
export type DongKH = { r: BangKeRow; d: DongMua }

/** Số trên lưới: 0 là gạch, lẻ tối đa 2 số. */
export const so = (x: number): string =>
  x > 0 ? x.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—'

/** Số luôn hiện, kể cả 0 (cột Tồn: "0" là thông tin, không phải trống). */
export const so0 = (x: number): string =>
  x.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export const dmy = (iso: string | null): string => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** % lệch của số tay so với định mức, ký hiệu kèm dấu: "+9,1%". */
export function lechPct(tay: number, dm: number): string {
  if (!(dm > 0)) return ''
  const p = (tay / dm - 1) * 100
  return `${p > 0 ? '+' : ''}${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}
