import type { TraGiaMon } from '@/modules/dept/supply/tra-gia.service'
import { fmtMoney } from '@/lib/po-line'

/** Một món trong danh sách tra giá (nháp trên máy). `kq` = kết quả tra lần gần nhất. */
export type Mon = {
  id: string
  text: string
  sl: number | null
  dvt: string | null
  /** Quy cách người mua đã chọn khi món mơ hồ. */
  key: string | null
  kq: TraGiaMon | null
  dang: boolean
  loi: string | null
}

/** Kỳ giá, tháng — 0 = mọi lúc. */
export type Ky = 3 | 6 | 12 | 0
export const KY_OPTS = [
  { value: '3', label: '3 tháng' },
  { value: '6', label: '6 tháng' },
  { value: '12', label: '12 tháng' },
  { value: '0', label: 'mọi lúc' },
]

/** Trạng thái món trên màn — của bộ máy, cộng 'dang' (đang tra) và 'loi'. */
export type TrangMon = 'dang' | 'loi' | 'ok' | 'one' | 'mo_ho' | 'moi' | 'trong'

/** Giá cũ hơn chừng này ngày thì gắn nhãn — đem đi so là dễ lệch (câu Q2 bản vẽ). */
export const GIA_CU_NGAY = 90

export const tien = (n: number) => fmtMoney(Math.round(n), 'VND')

/** yyyy-mm-dd → dd/mm (năm nay) · dd/mm/yy (năm khác). */
export function ngay(iso: string, nam: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y === nam ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`
}

export function soNgay(iso: string, homNay: string): number {
  const t = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`)
  return Math.round((t(homNay) - t(iso)) / 86_400_000)
}

/** Bỏ đầu "Công ty TNHH / Cổ phần" — tên đầy đủ vẫn nằm ở title. */
export const nganNcc = (ten: string) =>
  ten.replace(/^\s*(công\s*ty|cty)\s+(tnhh|cổ\s*phần|cp)\s+/i, '').trim() || ten

/** % chênh — dưới 1% thì hai chữ số lẻ, để 19.500 → 19.505 không hiện "0%". */
export const phanTram = (x: number) =>
  `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: x < 0.01 ? 2 : 1 })}%`
