/**
 * Kiểu + ô nhỏ của màn CHI TIẾT BÁO GIÁ (khuôn D · Chứng từ, khối ERP, 07/10/2026).
 */
import type { ReactNode } from 'react'

export type BaoGiaView = {
  id: string
  code: string
  status: string
  currency: string
  customer_id: string
  customer_name: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  owner_name: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
  submitted_by_name: string | null
  approved_at: string | null
  approved_by_name: string | null
  rejected_reason: string | null
  lost_reason: string | null
  revision_no: number
  revision_of: string | null
}

export type DongBaoGia = {
  id: string
  product_id: string
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  description_en: string | null
  qty: number | null
  unit_price: number
  discount_pct: number | null
  /** Giá thành KH hiện tại (null khi không quyền / chưa có). */
  plan_price: number | null
  /** Giá thành KH chụp lúc chào. */
  plan_snapshot: number | null
  note: string | null
  packing_text: string | null
}

export type RevisionView = {
  id: string
  code: string
  revision_no: number
  status: string
  created_at: string
}
export type DonView = { id: string; code: string; status: string }

export const fmtN = (n: number) => n.toLocaleString('vi-VN')
export const fmtMoney = (n: number) =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtD = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
export const fmtDT = (d: string) =>
  new Date(d).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const INPUT =
  'h-7 w-full rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none disabled:bg-muted'
export const TEXTAREA =
  'w-full rounded-sm border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none'
export const BTN_SUB =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-[13px] text-foreground hover:bg-muted disabled:opacity-50'
export const BTN_PRI =
  'inline-flex h-7 items-center gap-1 rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50'
export const BTN_STOP =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--stop)]/40 bg-card px-2.5 text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10 disabled:opacity-50'

export function Truong({
  label,
  children,
  mono,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  const empty = children == null || children === '' || children === '—'
  return (
    <div className="flex min-w-0 items-baseline gap-2 py-1 text-[13px]">
      <span className="text-muted-foreground w-[92px] shrink-0 text-xs">{label}</span>
      <span
        className={`min-w-0 break-words ${mono ? 'font-mono tabular-nums' : ''} ${empty ? 'text-muted-foreground italic' : 'text-foreground'}`}
      >
        {empty ? 'chưa khai' : children}
      </span>
    </div>
  )
}

export function Nhom({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-foreground border-border mb-1 border-b pb-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </div>
      {children}
    </div>
  )
}
