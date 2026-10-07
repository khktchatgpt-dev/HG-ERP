/**
 * Kiểu + hàm thuần của SỔ BÁO GIÁ (khuôn C · Danh sách, kiểu ERP — 07/10/2026).
 * Không state, không API.
 */

export type BaoGiaRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  status: string
  currency: string
  revision_no: number
  revision_of: string | null
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  created_at: string
  created_by: string | null
  owner_name: string | null
  line_count: number
  /** Σ net × SL (chỉ dòng có SL) — trị giá tham chiếu; 0 khi không dòng nào có SL. */
  ref_value: number
  /** Có dòng chưa có SL — trị giá tham chiếu chưa đủ. */
  lines_no_qty: number
  orders: { id: string; code: string }[]
  /** Bản sửa đổi đã sinh từ bản này. */
  revisions: number
  /** Ngày gửi khách suy từ updated_at khi status sent (chưa có cột riêng). */
  updated_at: string
}

export type Tab =
  'all' | 'draft' | 'pending' | 'sent' | 'won' | 'lost' | 'expired' | 'stale' | 'closed'

export const TAB_LABEL: Record<Tab, string> = {
  all: 'Đang chào',
  draft: 'Nháp',
  pending: 'Chờ GĐ duyệt',
  sent: 'Đã gửi khách',
  won: 'Thắng',
  lost: 'Thua',
  expired: 'Hết hiệu lực',
  stale: 'Nằm im',
  closed: 'Đã đóng',
}

export const QUOTE_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'GĐ đã duyệt',
  rejected: 'GĐ từ chối',
  sent: 'Đã gửi khách',
  superseded: 'Đã có bản mới',
  won: 'Thắng — đã ra đơn',
  lost: 'Thua',
  cancelled: 'Đã huỷ',
}

export type QuoteTone = 'stop' | 'warn' | 'done' | 'neutral'
export function quoteTone(status: string): QuoteTone {
  switch (status) {
    case 'draft':
    case 'pending_approval':
      return 'warn'
    case 'approved':
    case 'sent':
      return 'neutral'
    case 'won':
      return 'done'
    case 'rejected':
    case 'lost':
    case 'cancelled':
      return 'stop'
    default:
      return 'neutral'
  }
}

export const isClosed = (r: BaoGiaRow) =>
  ['won', 'lost', 'cancelled', 'superseded'].includes(r.status)
export const isExpired = (r: BaoGiaRow, today: string) =>
  !!r.valid_to && r.valid_to < today && !isClosed(r)
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function matchTab(r: BaoGiaRow, tab: Tab, today: string): boolean {
  switch (tab) {
    case 'all':
      return !isClosed(r)
    case 'draft':
      return r.status === 'draft' || r.status === 'rejected'
    case 'pending':
      return r.status === 'pending_approval' || r.status === 'approved'
    case 'sent':
      return r.status === 'sent'
    case 'won':
      return r.status === 'won'
    case 'lost':
      return r.status === 'lost'
    case 'expired':
      return isExpired(r, today)
    case 'stale':
      return r.status === 'sent' && daysBetween(r.updated_at.slice(0, 10), today) >= 14
    case 'closed':
      return isClosed(r)
  }
}

export type SortKey = 'new' | 'valid' | 'customer' | 'value'
export const SORT_LABEL: Record<SortKey, string> = {
  new: 'Mới lập trước',
  valid: 'Hết hiệu lực gần nhất',
  customer: 'Khách hàng A → Z',
  value: 'Trị giá lớn trước',
}

export const fmtN = (n: number) => n.toLocaleString('vi-VN')
export const fmtMoney = (n: number) =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
