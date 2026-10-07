/**
 * Kiểu + hàm thuần của SỔ ĐƠN BÁN (khuôn C · Danh sách, kiểu ERP — 07/10/2026).
 * Không state, không API. Lọc / sắp / phân trang là hàm thuần trên mảng đã tải
 * (sổ ~300 đơn/năm — bốc cả sổ rồi lọc phía client vẫn nhẹ nhiều năm).
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
  created_by: string | null
  created_by_name: string | null
  /** Người phụ trách KHÁCH của đơn (owner_id trên hồ sơ khách) — null = khách chưa gán ai. */
  owner_id: string | null
  owner_name: string | null
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
  todo: 'Mới xác nhận',
  running: 'Đang thực hiện',
  done: 'Sẵn sàng xuất',
  partial: 'Xuất dở',
  shipped: 'Đã xuất đủ',
  delivered: 'Đã giao',
  late: 'Quá hạn',
  missing: 'Thiếu dữ liệu',
  cancelled: 'Đã huỷ',
}

/** Sắp theo CỘT (bấm tiêu đề) — chuẩn trang danh sách ERP. */
export type SortCol =
  | 'code'
  | 'customer'
  | 'status'
  | 'due'
  | 'qty'
  | 'shipped'
  | 'total'
  | 'owner'
  | 'created'
export type SortDir = 'asc' | 'desc'
export const SORT_LABEL: Record<SortCol, string> = {
  code: 'Số đơn',
  customer: 'Khách hàng',
  status: 'Trạng thái',
  due: 'Hạn giao',
  qty: 'SL',
  shipped: 'Đã xuất',
  total: 'Giá trị',
  owner: 'Người phụ trách',
  created: 'Ngày tạo',
}

/** Bộ lọc mịn — ngoài dải ô đếm (vòng đời) và phạm vi (của tôi / cả phòng). */
export type Filters = {
  customer: string // 'all' | customer_id
  owner: string // 'all' | 'me' | 'none' | user_id
  missing: 'all' | 'any' | 'PO' | 'tuần giao' | 'điều khoản' | 'giá'
  currency: string // 'all' | 'USD' …
  dueFrom: string
  dueTo: string
  q: string
}
export const EMPTY_FILTERS: Filters = {
  customer: 'all',
  owner: 'all',
  missing: 'all',
  currency: 'all',
  dueFrom: '',
  dueTo: '',
  q: '',
}
/** Số ô lọc đang khác mặc định — để nút "Xoá lọc (n)" nói đúng. */
export const countActive = (f: Filters) =>
  (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter(
    (k) => f[k] !== EMPTY_FILTERS[k],
  ).length

/** Tuỳ chọn nhớ theo người dùng (localStorage) — cá nhân hoá sổ. */
export type Prefs = {
  mineOnly: boolean | null // null = tự quyết theo "tôi có ôm khách không"
  pageSize: number
  sort: SortCol
  dir: SortDir
  hideClosed: boolean
}
export const DEFAULT_PREFS: Prefs = {
  mineOnly: null,
  pageSize: 50,
  sort: 'due',
  dir: 'asc',
  hideClosed: true,
}
export const PAGE_SIZES = [25, 50, 100] as const

export const isClosed = (o: DonRow) =>
  o.status === 'delivered' || o.status === 'cancelled'
export const isLate = (o: DonRow, today: string) =>
  !!o.due_date && o.due_date < today && !isClosed(o)
/** Người chịu trách nhiệm đơn: phụ trách khách, không có thì người tạo. */
export const ownerOf = (o: DonRow) => o.owner_id ?? o.created_by
/** "Của tôi" = tôi phụ trách khách HOẶC tôi tạo. */
export const isMine = (o: DonRow, meId: string) =>
  o.created_by === meId || o.owner_id === meId

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

export function matchFilters(o: DonRow, f: Filters, meId: string): boolean {
  if (f.customer !== 'all' && o.customer_id !== f.customer) return false
  if (f.owner === 'me') {
    if (!isMine(o, meId)) return false
  } else if (f.owner === 'none') {
    if (ownerOf(o)) return false
  } else if (f.owner !== 'all' && ownerOf(o) !== f.owner) return false
  if (f.missing === 'any' && o.missing.length === 0) return false
  if (f.missing !== 'all' && f.missing !== 'any' && !o.missing.includes(f.missing))
    return false
  if (f.currency !== 'all' && o.currency !== f.currency) return false
  if (f.dueFrom && (!o.due_date || o.due_date < f.dueFrom)) return false
  if (f.dueTo && (!o.due_date || o.due_date > f.dueTo)) return false
  const ql = f.q.trim().toLowerCase()
  if (ql) {
    const hay =
      `${o.code} ${o.customer_name} ${o.customer_po_no ?? ''} ${o.owner_name ?? ''} ${o.created_by_name ?? ''} ${o.search}`.toLowerCase()
    if (!hay.includes(ql)) return false
  }
  return true
}

/** Sắp ổn định theo cột; đơn đã đóng luôn xuống cuối khi sắp theo hạn giao. */
export function sortRows(rows: DonRow[], col: SortCol, dir: SortDir): DonRow[] {
  const s = dir === 'asc' ? 1 : -1
  const str = (a: string | null, b: string | null) =>
    (a ?? '').localeCompare(b ?? '', 'vi') * s
  const num = (a: number, b: number) => (a - b) * s
  const cmp: Record<SortCol, (a: DonRow, b: DonRow) => number> = {
    code: (a, b) => str(a.code, b.code),
    customer: (a, b) => str(a.customer_name, b.customer_name) || str(a.code, b.code),
    status: (a, b) => str(a.status, b.status) || str(a.code, b.code),
    due: (a, b) => {
      const ka = isClosed(a) ? 2 : a.due_date ? 0 : 1
      const kb = isClosed(b) ? 2 : b.due_date ? 0 : 1
      if (ka !== kb) return ka - kb
      return str(a.due_date, b.due_date) || str(a.code, b.code)
    },
    qty: (a, b) => num(a.qty, b.qty),
    shipped: (a, b) => num(a.shipped, b.shipped),
    total: (a, b) => num(a.total, b.total),
    owner: (a, b) =>
      str(a.owner_name ?? a.created_by_name, b.owner_name ?? b.created_by_name) ||
      str(a.code, b.code),
    created: (a, b) => str(a.created_at, b.created_at),
  }
  return [...rows].sort(cmp[col])
}

/** Chênh lệch ngày (b − a) trên chuỗi yyyy-mm-dd. */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
/** yyyy-mm-dd + n ngày. */
export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** Thứ hai & chủ nhật của tuần chứa `iso`. */
export function weekRange(iso: string): [string, string] {
  const d = new Date(`${iso}T00:00:00Z`)
  const mon = addDays(iso, -((d.getUTCDay() + 6) % 7))
  return [mon, addDays(mon, 6)]
}
export function monthRange(iso: string): [string, string] {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [`${iso.slice(0, 7)}-01`, `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`]
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
