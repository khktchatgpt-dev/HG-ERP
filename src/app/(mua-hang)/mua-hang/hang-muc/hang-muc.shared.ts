import { fmtMoney } from '@/lib/po-line'

/** Tiền kèm đơn vị khi không phải VND — "128.400.000" / "1.200,00 USD". */
export const tien = (n: number, cur: string) =>
  cur === 'VND' ? fmtMoney(n, cur) : `${fmtMoney(n, cur)} ${cur}`

/** Cộng riêng từng loại tiền, KHÔNG quy đổi — "612.600.000 · 1.200,00 USD". */
export function tienTheoLoai(m: Record<string, number>): string {
  return Object.entries(m)
    .filter(([, v]) => Math.abs(v) > 0.005)
    .map(([c, v]) => tien(v, c))
    .join(' · ')
}
