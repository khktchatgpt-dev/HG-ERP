/**
 * Kiểu + hàm thuần của SỔ LỆNH SẢN XUẤT phía Sale (khuôn C · Danh sách, kiểu
 * ERP — 07/10/2026). Không state, không API.
 */

export type LenhRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  order_codes: string[]
  status: string
  revision: number
  priority: number
  issued_at: string | null
  created_by: string | null
  created_by_name: string | null
  /** Hạn xuất đầu lệnh (D1: = lô sớm nhất khi đã chia lô). */
  ship_date: string | null
  materials_due_at: string | null
  materials_received_at: string | null
  lines: number
  qty: number
  jobs_done: number
  jobs_total: number
  /** Số lô Sale đã chia (0222). */
  lots: number
  /** Lô kế tiếp chưa qua: ngày + PO. */
  next_lot: { ship_date: string; po: string | null } | null
  /** Σ SL đã xếp vào lô / Σ SL lệnh. */
  lot_qty: number
}

export type Tab =
  | 'all'
  | 'draft'
  | 'pending'
  | 'running'
  | 'completed'
  | 'rejected'
  | 'due_soon'
  | 'no_lots'

export const TAB_LABEL: Record<Tab, string> = {
  all: 'Tất cả',
  draft: 'Nháp',
  pending: 'Chờ GĐ duyệt',
  running: 'Đang chạy',
  completed: 'Hoàn thành',
  rejected: 'Bị từ chối',
  due_soon: 'Xuất ≤ 14 ngày',
  no_lots: 'Chưa chia đợt',
}

export const LSX_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  completed: 'Hoàn thành',
  rejected: 'Bị từ chối',
  cancelled: 'Đã huỷ',
}

export type LsxTone = 'stop' | 'warn' | 'done' | 'neutral'
export function lsxTone(status: string): LsxTone {
  switch (status) {
    case 'draft':
    case 'pending_approval':
      return 'warn'
    case 'completed':
      return 'done'
    case 'rejected':
    case 'cancelled':
      return 'stop'
    default:
      return 'neutral'
  }
}

export const isRunning = (r: LenhRow) =>
  r.status === 'approved' || r.status === 'in_progress'
export const isOpen = (r: LenhRow) => !['completed', 'cancelled'].includes(r.status)

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function matchTab(r: LenhRow, tab: Tab, today: string): boolean {
  switch (tab) {
    case 'all':
      return r.status !== 'cancelled'
    case 'draft':
      return r.status === 'draft'
    case 'pending':
      return r.status === 'pending_approval'
    case 'running':
      return isRunning(r)
    case 'completed':
      return r.status === 'completed'
    case 'rejected':
      return r.status === 'rejected'
    case 'due_soon': {
      if (!isRunning(r)) return false
      const d = r.next_lot?.ship_date ?? r.ship_date
      return !!d && daysBetween(today, d) <= 14
    }
    case 'no_lots':
      return isRunning(r) && r.lots === 0
  }
}

export type SortKey = 'ship' | 'new' | 'customer' | 'code'
export const SORT_LABEL: Record<SortKey, string> = {
  ship: 'Hạn xuất gần nhất',
  new: 'Phát lệnh mới trước',
  customer: 'Khách hàng A → Z',
  code: 'Số lệnh',
}

export const fmtN = (n: number) => n.toLocaleString('vi-VN')
export const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
export const shortName = (full: string | null) =>
  full ? (full.trim().split(/\s+/).at(-1) ?? full) : '—'
