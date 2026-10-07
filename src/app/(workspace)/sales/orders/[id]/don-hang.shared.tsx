/**
 * Kiểu + hằng + ô nhỏ dùng chung của màn CHI TIẾT ĐƠN BÁN (khuôn D · Chứng từ,
 * dựng theo khối ERP `sales/_erp/ui.tsx`, 07/10/2026). Không state, không API.
 */
import type { ReactNode } from 'react'

export type DonHangView = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  quote_code: string | null
  customer_po_no: string | null
  status: string
  currency: string
  fx_rate: number | null
  fx_date: string | null
  due_date: string | null
  deposit_percent: number | null
  price_term: string | null
  payment_terms: string | null
  payment_method: string | null
  qty_tolerance_pct: number | null
  partial_shipment: boolean | null
  transhipment: boolean | null
  port_of_loading: string | null
  port_of_discharge: string | null
  required_docs: string | null
  container_summary: string | null
  note: string | null
  owner_name: string | null
  created_at: string
}

export type DongView = {
  id: string
  product_id: string
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  barcode: string | null
  bom_status: 'none' | 'drawing' | 'done'
  qty: number
  unit_price: number
  ship_date: string | null
  shipped: number
  note: string | null
}

export type DotXuatView = {
  id: string
  order_line_id: string
  qty: number
  shipped_at: string
  note: string | null
  created_by_name: string | null
}

export type ChangeView = {
  id: string
  changed_by_name: string | null
  change: {
    type?: string
    fields?: Record<string, { from: unknown; to: unknown }>
    lines?: unknown
    count?: number
    lsx_code?: string
    shipped?: number
    total?: number
  }
  note: string | null
  created_at: string
}

export type LsxView = {
  id: string
  code: string
  status: string
  issued_at: string | null
  approved_at: string | null
  completed_at: string | null
  rejected_reason: string | null
  ship_date: string | null
  materials_received_at: string | null
  jobs_done: number
  jobs_total: number
  /** Lệnh gộp: các đơn khác cùng lệnh. */
  other_orders: { id: string; code: string }[]
}

export type MergeCandidate = {
  id: string
  code: string
  due_date: string | null
  line_count: number
}

export type CancelImpact = {
  lsx_active: boolean
  lsx_shared: boolean
  pos_auto: string[]
  pos_manual: string[]
}

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

/** Nhãn trạng thái lệnh — nguồn `lsx-status.ts` nhưng gói gọn cho màn này. */
export const LSX_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  completed: 'Hoàn thành',
  rejected: 'Bị từ chối',
  cancelled: 'Đã huỷ',
}

/** Ô "nhãn : giá trị" trong khối Tổng quan — nhãn trái cố định 120px. */
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
      <span className="text-muted-foreground w-[120px] shrink-0 text-xs">{label}</span>
      <span
        className={`min-w-0 break-words ${mono ? 'font-mono tabular-nums' : ''} ${
          empty ? 'text-muted-foreground italic' : 'text-foreground'
        }`}
      >
        {empty ? 'chưa khai' : children}
      </span>
    </div>
  )
}

/** Nhóm trường có tên (tiêu chí ERP #3). */
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

/** Ô nhập kiểu ERP (vuông, 28px). */
export const INPUT =
  'h-7 w-full rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none disabled:bg-muted'
export const TEXTAREA =
  'w-full rounded-sm border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none'

/** Nút phụ trong khối hành động. */
export const BTN_SUB =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-[13px] text-foreground hover:bg-muted disabled:opacity-50'
export const BTN_PRI =
  'inline-flex h-7 items-center gap-1 rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50'
export const BTN_STOP =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--stop)]/40 bg-card px-2.5 text-[13px] text-[var(--stop)] hover:bg-[var(--stop)]/10 disabled:opacity-50'
