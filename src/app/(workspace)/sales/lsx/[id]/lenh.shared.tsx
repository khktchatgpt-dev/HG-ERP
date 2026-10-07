/**
 * Kiểu + hằng + ô nhỏ dùng chung của màn CHI TIẾT LỆNH SẢN XUẤT phía Sale
 * (khuôn D · Chứng từ, khối ERP `sales/_erp/ui.tsx`, 07/10/2026). Không state.
 */
import type { ReactNode } from 'react'
import type { SyncItem } from '@/lib/lsx-sync'

export type LenhView = {
  id: string
  code: string
  status: string
  customer_id: string
  customer_name: string
  priority: number
  revision: number
  revision_note: string | null
  revised_at: string | null
  ship_date: string | null
  received_date: string | null
  container_summary: string | null
  note: string | null
  issued_at: string | null
  approved_at: string | null
  completed_at: string | null
  rejected_reason: string | null
  materials_due_at: string | null
  materials_received_at: string | null
  created_at: string
  updated_at: string
  created_by_name: string | null
}

export type DonView = {
  id: string
  code: string
  status: string
  customer_po_no: string | null
  due_date: string | null
  qty: number
  shipped: number
}

export type DongView = {
  id: string
  group_id: string
  product_id: string | null
  product_code: string
  customer_item_code: string | null
  name_vi: string | null
  unit: string
  qty: number
  cbm: number | null
  /** Đợt xuất — theo LÔ của Sale khi đã chia (D1), không thì ngày cũ ở dòng/nhóm. */
  ship_text: string
  changed_in_rev: number | null
  spec_summary: string
  bom_missing: boolean
}

export type NhomView = {
  id: string
  title: string
  po_no: string | null
  buyer_name: string | null
  sales_order_code: string | null
  lines: DongView[]
}

export type LotView = {
  id: string
  seq: number
  po: string | null
  ship_date: string | null
  note: string | null
  qty: number
  lines: { product_key: string; qty: number }[]
}

export type ChangeView = {
  id: string
  changed_by_name: string | null
  change: Record<string, unknown>
  note: string | null
  created_at: string
}

export type PoView = { id: string; code: string; status: string; supplier_name: string }

export type MergeCandidate = { id: string; code: string; line_count: number }

export type SyncPreview = { items: SyncItem[]; applied: number; manual: number }

export const LSX_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  completed: 'Hoàn thành',
  rejected: 'Bị từ chối',
  cancelled: 'Đã huỷ',
}
export const PO_LABEL: Record<string, string> = {
  draft: 'nháp',
  pending_approval: 'chờ duyệt',
  approved: 'đã duyệt',
  ordered: 'đã đặt',
  confirmed: 'NCC xác nhận',
  in_transit: 'đang về',
  partial: 'về một phần',
  received: 'đã về đủ',
  cancelled: 'đã huỷ',
}

export const fmtN = (n: number) => n.toLocaleString('vi-VN')
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

/** Ô "nhãn : giá trị" — nhãn trái cố định 120px. */
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
