/**
 * Kiểu + hàm thuần của SỔ ĐƠN BÁN (khuôn C · Danh sách, kiểu ERP — 07/10/2026).
 * Không state, không API.
 */

export type DonRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  created_at: string
  lines: number
  qty: number
  shipped: number
  total: number
  lsx_id: string | null
  lsx_code: string | null
  created_by: string | null
  created_by_name: string | null
  customer_owner_id: string | null
  can_edit: boolean
  /** Chuỗi tìm phụ: mã SP + mã khách của mọi dòng (không hiện). */
  search: string
  /** Dữ liệu còn thiếu để đơn "đủ hồ sơ": PO · tuần giao · điều khoản · giá. */
  missing: string[]
}

export type Tab =
  | 'all'
  | 'todo'
  | 'running'
  | 'done'
  | 'partial'
  | 'shipped'
  | 'delivered'
  | 'late'
  | 'missing'
  | 'cancelled'

export const TAB_LABEL: Record<Tab, string> = {
  all: 'Tất cả',
  todo: 'Chờ lệnh',
  running: 'Đang SX',
  done: 'SX xong',
  partial: 'Xuất dở',
  shipped: 'Đã xuất đủ',
  delivered: 'Đã giao',
  late: 'Quá hạn',
  missing: 'Thiếu dữ liệu',
  cancelled: 'Đã huỷ',
}

export type SortKey = 'due' | 'new' | 'customer' | 'value'
export const SORT_LABEL: Record<SortKey, string> = {
  due: 'Hạn giao gần nhất',
  new: 'Mới tạo trước',
  customer: 'Khách hàng A → Z',
  value: 'Giá trị lớn trước',
}

export const isClosed = (o: DonRow) =>
  o.status === 'delivered' || o.status === 'cancelled'
export const isLate = (o: DonRow, today: string) =>
  !!o.due_date && o.due_date < today && !isClosed(o)
/** "Của tôi" = tôi tạo HOẶC khách tôi phụ trách. */
export const isMine = (o: DonRow, meId: string) =>
  o.created_by === meId || o.customer_owner_id === meId

export function matchTab(o: DonRow, tab: Tab, today: string): boolean {
  switch (tab) {
    case 'all':
      return o.status !== 'cancelled'
    case 'todo':
      return o.status === 'confirmed' || o.status === 'lsx_pending'
    case 'running':
      return o.status === 'lsx_issued'
    case 'done':
      return o.status === 'completed'
    case 'partial':
      return o.status === 'partially_shipped'
    case 'shipped':
      return o.status === 'shipped'
    case 'delivered':
      return o.status === 'delivered'
    case 'late':
      return isLate(o, today)
    case 'missing':
      return o.missing.length > 0 && !isClosed(o)
    case 'cancelled':
      return o.status === 'cancelled'
  }
}

/** Chênh lệch ngày (b − a) trên chuỗi yyyy-mm-dd. */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

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
/** Tên gọi (chữ cuối) để nhét vừa ô hẹp: "Nguyễn T.Minh Hằng" → "Hằng". */
export const shortName = (full: string | null) =>
  full ? (full.trim().split(/\s+/).at(-1) ?? full) : '—'

/** Σ giá trị theo từng loại tiền → "1.250.000,00 USD · 300.000.000,00 VND". */
export function sumByCurrency(rows: DonRow[]): string {
  const by = new Map<string, number>()
  for (const o of rows)
    if (o.total > 0) by.set(o.currency, (by.get(o.currency) ?? 0) + o.total)
  if (by.size === 0) return '—'
  return [...by.entries()].map(([cur, v]) => `${fmtMoney(v)} ${cur}`).join(' · ')
}
