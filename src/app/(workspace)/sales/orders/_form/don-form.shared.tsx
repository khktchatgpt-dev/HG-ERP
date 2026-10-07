/**
 * Kiểu + hằng + ô nhỏ của FORM ĐƠN BÁN (khuôn F · Bảng nhập liệu, kiểu ERP —
 * 07/10/2026): lưới dòng là nhân vật chính, đầu đơn co thành dải ô nhỏ, thanh
 * chốt đáy nói vì sao chưa lưu được bằng câu bấm được. Không state, không API.
 */
import type { ReactNode } from 'react'
import type { ProductPick } from '@/components/sales/ProductPicker'

export type CustomerOption = {
  id: string
  name: string
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
}
export type QuoteOption = {
  id: string
  code: string
  customer_name: string
  currency: string
}

export type OrderInitial = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  currency: string
  status: string
  quote_code: string | null
  customer_po_no: string | null
  due_date: string | null
  container_summary: string | null
  note: string | null
  price_term: string | null
  payment_terms: string | null
  deposit_percent: number | null
  qty_tolerance_pct: number | null
  port_of_loading: string | null
  port_of_discharge: string | null
  payment_method: string | null
  required_docs: string | null
  partial_shipment: boolean | null
  transhipment: boolean | null
}

export type LineInitial = {
  id: string
  product_id: string
  qty: number
  unit_price: number
  ship_date: string | null
  note: string | null
  /** Đã xuất (0120) — dòng có xuất không bỏ / không giảm dưới số này. */
  shipped: number
}

/** Năm ô quy cách SP mới — khoá khớp `ProductTechSpec`. */
export type SpecKey = 'machine' | 'cushion' | 'paint' | 'glass' | 'wood'
export const SPEC_FIELDS: [SpecKey, string, string][] = [
  ['machine', 'Máy', 'Dây dù màu kem'],
  ['cushion', 'Nệm', 'Nệm dày 5cm · vải Stormstone'],
  ['paint', 'Sơn', 'Màu Graphit H-SM-9608'],
  ['glass', 'Kính', 'Kính cường lực 8mm'],
  ['wood', 'Gỗ', 'Acacia FSC 100%'],
]
export const emptySpec = (): Record<SpecKey, string> => ({
  machine: '',
  cushion: '',
  paint: '',
  glass: '',
  wood: '',
})

/** SP MỚI do Sale khai — chỉ tạo vào thư viện Kỹ thuật KHI lưu đơn (không mồ côi). */
export type LineDraft = {
  code: string
  name: string
  unit: string
  itemCode: string
  notes: string
  barcode: string
  image: File | null
  spec: Record<SpecKey, string>
}

export type LineRow = {
  key: number
  /** id dòng đang có (sửa đơn) — server khớp theo id (D2). */
  id?: string
  productId: string
  draft: LineDraft | null
  qty: string
  unitPrice: string
  shipDate: string
  note: string
  shipped: number
  /** Dòng dán từ Excel chưa khớp mã — giữ để người dùng chọn SP. */
  pastedCode?: string
}

export type Missing = { msg: string; focus?: string }

export const CURRENCIES = ['USD', 'VND', 'EUR']

export const INPUT =
  'h-7 w-full rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none disabled:bg-muted'
export const CELL =
  'h-7 w-full rounded-sm border border-transparent bg-transparent px-1.5 text-[13px] text-foreground focus:border-[var(--primary)] focus:bg-card focus:outline-none'
export const BTN_SUB =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-[13px] text-foreground hover:bg-muted disabled:opacity-50'
export const BTN_PRI =
  'inline-flex h-8 items-center gap-1.5 rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50'

/** Ô đầu đơn: nhãn nhỏ trên, ô nhập dưới — xếp thành dải. */
export function O({
  label,
  htmlFor,
  w = 'w-[160px]',
  children,
  hint,
}: {
  label: ReactNode
  htmlFor?: string
  w?: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className={`flex min-w-0 flex-col gap-0.5 ${w}`}>
      <span className="text-muted-foreground truncate text-[11px] leading-4">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground text-[11px] leading-4">{hint}</span>
      )}
    </label>
  )
}

export const fmtMoney = (n: number) =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtN = (n: number) => n.toLocaleString('vi-VN')
export const num = (s: string) => {
  const v = Number(String(s).replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

export type { ProductPick }
