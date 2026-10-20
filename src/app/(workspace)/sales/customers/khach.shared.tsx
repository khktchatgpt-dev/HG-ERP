/**
 * Kiểu + hằng + hàm thuần của khu KHÁCH HÀNG (sổ khuôn C · hồ sơ khuôn E, kiểu
 * ERP — 07/10/2026). Không state, không API.
 */

/** Khách như giao diện Sales cần — khớp `CustomerWithOwner` phía server. */
export type CustomerView = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  tax_code: string | null
  country: string | null
  contact_person: string | null
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
  fax: string | null
  representative_title: string | null
  fsc_cert: string | null
  is_active: boolean
  created_at: string
}

export type MemberOption = { id: string; label: string }

/** Số báo giá/đơn của KH — server đếm cho đúng trang đang hiện. */
export type Activity = { quotes: number; orders: number; openOrders: number }

export type StatusFilter = 'all' | 'active' | 'inactive'
export const STATUS_LABEL: Record<StatusFilter, string> = {
  active: 'Đang giao dịch',
  inactive: 'Ngừng giao dịch',
  all: 'Tất cả',
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
export const fmtDT = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/** Điều khoản mặc định còn thiếu gì — báo giá / đơn của khách này sẽ không tự điền. */
export function termsMissing(c: CustomerView): string[] {
  const m: string[] = []
  if (!c.default_currency) m.push('tiền tệ')
  if (!c.default_price_term) m.push('Incoterm')
  if (!c.default_payment_terms) m.push('thanh toán')
  return m
}

/** Hồ sơ đủ để in hợp đồng / chứng từ chưa. */
export function profileMissing(c: CustomerView): string[] {
  const m: string[] = []
  if (!c.address) m.push('địa chỉ')
  if (!c.country) m.push('quốc gia')
  if (!c.contact_person) m.push('người liên hệ')
  if (!c.email && !c.phone) m.push('email / ĐT')
  return m
}

/** Σ tiền theo loại tiền → "1.250.000,00 USD · 300.000,00 VND". */
export function sumByCurrency(rows: { currency: string; total: number }[]): string {
  const by = new Map<string, number>()
  for (const o of rows)
    if (o.total > 0) by.set(o.currency, (by.get(o.currency) ?? 0) + o.total)
  if (by.size === 0) return '—'
  return [...by.entries()].map(([cur, v]) => `${fmtMoney(v)} ${cur}`).join(' · ')
}
