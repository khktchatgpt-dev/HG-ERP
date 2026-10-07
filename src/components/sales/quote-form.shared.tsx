'use client'

import type { ReactNode } from 'react'
import {
  Card as UiCard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { api } from '@/lib/api'
import { ProductSpecFill } from '@/components/sales/ProductSpecFill'
import type { ProductPick } from '@/components/sales/ProductPicker'

/**
 * Kiểu, hằng, hàm phụ và thành phần trình bày của form BÁO GIÁ — dời khỏi
 * QuoteForm 07/10/2026 (trần 800 dòng) khi khối dòng chuyển thành lưới có giá
 * thành / net / lãi (0225). Không state ngoài component con.
 */

export type CustomerOption = {
  id: string
  name: string
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
}

export type QuoteInitial = {
  id: string
  code: string
  customer_id: string
  currency: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
}

export type QuoteLineInitial = {
  product_id: string
  qty: number | null
  unit_price: number
  discount_pct: number | null
  note: string | null
}

export type LineDraft = { code: string; name: string; unit: string; itemCode: string }

export const BOM_LABEL = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
} as const
export const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const

/*
 * Lớp ô nhập dùng chung — CÙNG token với OrderForm (`.theme-v2`, bám
 * `components/shadcn/input.tsx`) để form báo giá và form đơn nhìn như một.
 */
export const cls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-card w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

/** Giá đã báo cho ĐÚNG khách này, theo SP — dùng để tự điền đơn giá. */
export async function fetchLastPrices(
  customerId: string,
): Promise<Map<string, { unit_price: number; quote_code: string }>> {
  const data = await api<{
    prices: { product_id: string; unit_price: number; quote_code: string }[]
  }>(`/api/dept/sales/quotes/last-prices?customer_id=${customerId}`)
  return new Map(data.prices.map((x) => [x.product_id, x]))
}

/** yyyy-mm-dd + n ngày (cùng cách server tính hiệu lực mặc định). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "60.2×58.1×92.4" từ 3 chiều — thiếu bất kỳ chiều nào = null. */
export function dimStr(a?: number, b?: number, c?: number): string | null {
  return a != null && b != null && c != null ? `${a}×${b}×${c}` : null
}
export const cmToInch = (v?: number) => (v != null ? (v / 2.54).toFixed(1) : null)
export function inchStr(a?: number, b?: number, c?: number): string | null {
  const [x, y, z] = [cmToInch(a), cmToInch(b), cmToInch(c)]
  return x && y && z ? `${x}×${y}×${z}` : null
}

/** Thẻ mục của form — cùng khối shadcn Card với OrderForm (tiêu đề chữ thật). */
export function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <UiCard>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {right && (
          <div className="col-start-2 row-span-2 row-start-1 self-center">{right}</div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </UiCard>
  )
}

export function L({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span2 ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}

export function LineField({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 ${span2 ? 'col-span-2' : ''}`}>
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

/** Hàng chi tiết của một dòng báo giá: quy cách · giá gợi ý · điền spec. */
export function QuoteLineDetails({
  colCount,
  product,
  specs,
  mine,
  market,
  onSaved,
}: {
  colCount: number
  product: ProductPick | undefined
  specs: [string, string | null][]
  mine?: { unit_price: number; quote_code: string }
  market?: { unit_price: number; currency: string; customer_name: string }
  onSaved: (p: ProductPick) => void
}) {
  return (
    <tr className="bg-muted/30">
      <td />
      <td colSpan={colCount} className="px-2 pt-1 pb-3">
        {product ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
              {specs.map(([label, val]) => (
                <div key={label} className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    {label}
                  </span>
                  <span className={val ? '' : 'text-amber-600'}>{val ?? '— thiếu'}</span>
                </div>
              ))}
            </div>
            {(mine || market) && (
              <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-[11px]">
                {mine && (
                  <span>
                    Khách này lần trước: <b>{mine.unit_price.toLocaleString('en-US')}</b>{' '}
                    ({mine.quote_code})
                  </span>
                )}
                {market && (
                  <span>
                    Gần nhất: <b>{market.unit_price.toLocaleString('en-US')}</b>{' '}
                    {market.currency} · {market.customer_name}
                  </span>
                )}
              </div>
            )}
            <ProductSpecFill product={product} onSaved={onSaved} />
          </>
        ) : (
          <span className="text-muted-foreground text-xs">Chọn sản phẩm trước.</span>
        )}
      </td>
    </tr>
  )
}
