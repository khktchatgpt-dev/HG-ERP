import { BASE_CURRENCY, toBase } from './fx'

/**
 * BẢNG TUỔI NỢ NHÀ CUNG CẤP (AP aging).
 *
 * Báo cáo SỐ MỘT của mọi phân hệ công nợ: không có nó thì không ai biết nên trả
 * ai trước, và một hoá đơn quá hạn 90 ngày trông y hệt một hoá đơn còn 20 ngày.
 *
 * Chia theo **tuổi so với HẠN THANH TOÁN**, không phải tuổi kể từ ngày hoá đơn.
 * Hai cách ra hai bảng khác hẳn: một hoá đơn 60 ngày tuổi mà điều khoản 90 ngày
 * thì CHƯA đến hạn — xếp nó vào "quá hạn 31–60" là giục nhầm nhà cung cấp.
 *
 * Số dư mỗi hoá đơn = tổng hoá đơn − đã trả cho chính hoá đơn đó. Hoá đơn đã
 * trả đủ rơi khỏi bảng (không bày dòng 0 đồng).
 */

export type AgingInvoice = {
  invoice_id: string
  invoice_no: string
  supplier_id: string
  supplier_name: string
  currency: string
  /** Tổng phải trả trên tờ hoá đơn (đã gồm VAT). */
  total: number
  /** Đã trả cho CHÍNH hoá đơn này. */
  paid: number
  /** Hạn thanh toán. null = chưa khai — KHÔNG được coi là đến hạn hôm nay. */
  due_date: string | null
  invoice_date: string
  /** Tỷ giá đã lưu cứng trên chứng từ. null = chứng từ VND hoặc chưa có. */
  fx_rate: number | null
}

/** Năm rổ tuổi nợ — chuẩn chung của mọi ERP. */
export type AgingBucket = 'chua_den_han' | 'qua_1_30' | 'qua_31_60' | 'qua_61_90' | 'qua_90' | 'chua_co_han' // prettier-ignore

export const BUCKET_LABEL: Record<AgingBucket, string> = {
  chua_den_han: 'Chưa đến hạn',
  qua_1_30: 'Quá hạn 1–30',
  qua_31_60: 'Quá hạn 31–60',
  qua_61_90: 'Quá hạn 61–90',
  qua_90: 'Quá hạn > 90',
  chua_co_han: 'Chưa khai hạn',
}

export const BUCKETS: AgingBucket[] = ['chua_den_han', 'qua_1_30', 'qua_31_60', 'qua_61_90', 'qua_90', 'chua_co_han'] // prettier-ignore

/**
 * Rổ của một hoá đơn.
 *
 * `chua_co_han` KHÔNG gộp vào "chưa đến hạn": hoá đơn không khai hạn là **lỗi
 * dữ liệu cần sửa**, không phải khoản nợ an toàn. Gộp vào là giấu lỗi đi.
 */
export function bucketOf(dueDate: string | null, today: string): AgingBucket {
  if (!dueDate) return 'chua_co_han'
  if (dueDate >= today) return 'chua_den_han'
  const days = daysBetween(dueDate, today)
  if (days <= 30) return 'qua_1_30'
  if (days <= 60) return 'qua_31_60'
  if (days <= 90) return 'qua_61_90'
  return 'qua_90'
}

export type AgingRow = {
  supplier_id: string
  supplier_name: string
  currency: string
  /** Số dư theo từng rổ, ĐƠN VỊ LÀ TIỀN GỐC của hoá đơn. */
  buckets: Record<AgingBucket, number>
  total: number
  /** Quy VND — null nếu có khoản thiếu tỷ giá. Xem `base_missing`. */
  total_base: number | null
  invoice_count: number
  /** Hoá đơn quá hạn lâu nhất (ngày) — để xếp thứ tự "ai cần trả trước". */
  worst_days: number
}

const ZERO = (): Record<AgingBucket, number> =>
  Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>

/**
 * Gộp tuổi nợ theo **nhà cung cấp × tiền tệ**.
 *
 * Tách theo tiền tệ vì cộng USD với VND là ngầm khai 1 USD = 1 VND. Cột
 * `total_base` cho con số VND để xếp hạng, nhưng `null` khi thiếu tỷ giá —
 * không bao giờ thay bằng 0.
 */
export function buildAging(invoices: AgingInvoice[], today: string): AgingRow[] {
  const by = new Map<string, AgingRow & { missingFx: boolean }>()
  for (const inv of invoices) {
    const open = round2(inv.total - inv.paid)
    // Đã trả đủ (hoặc trả dư) thì không còn là công nợ — không bày dòng 0 đồng.
    if (open <= 0.004) continue
    const key = `${inv.supplier_id}|${inv.currency}`
    const row = by.get(key) ?? {
      supplier_id: inv.supplier_id,
      supplier_name: inv.supplier_name,
      currency: inv.currency,
      buckets: ZERO(),
      total: 0,
      total_base: 0,
      invoice_count: 0,
      worst_days: 0,
      missingFx: false,
    }
    const b = bucketOf(inv.due_date, today)
    row.buckets[b] = round2(row.buckets[b] + open)
    row.total = round2(row.total + open)
    row.invoice_count += 1
    if (inv.due_date && inv.due_date < today) {
      row.worst_days = Math.max(row.worst_days, daysBetween(inv.due_date, today))
    }
    const base = toBase(open, inv.currency, inv.fx_rate)
    if (base == null) row.missingFx = true
    else row.total_base = round2((row.total_base ?? 0) + base)
    by.set(key, row)
  }
  return [...by.values()]
    .map(({ missingFx, ...r }) => ({ ...r, total_base: missingFx ? null : r.total_base }))
    .sort(
      (a, b) => b.worst_days - a.worst_days || (b.total_base ?? 0) - (a.total_base ?? 0),
    )
}

/** Cộng toàn bảng theo rổ, tách tiền tệ. Dải đầu trang đọc cái này. */
export function agingTotals(
  rows: AgingRow[],
): { currency: string; buckets: Record<AgingBucket, number>; total: number }[] {
  const by = new Map<string, { buckets: Record<AgingBucket, number>; total: number }>()
  for (const r of rows) {
    const cur = by.get(r.currency) ?? { buckets: ZERO(), total: 0 }
    for (const b of BUCKETS) cur.buckets[b] = round2(cur.buckets[b] + r.buckets[b])
    cur.total = round2(cur.total + r.total)
    by.set(r.currency, cur)
  }
  return [...by]
    .map(([currency, v]) => ({ currency, ...v }))
    .sort((a, b) => (a.currency === BASE_CURRENCY ? -1 : b.currency === BASE_CURRENCY ? 1 : 0)) // prettier-ignore
}

/** Số ngày giữa hai ngày dạng YYYY-MM-DD. */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

const round2 = (n: number) => Math.round(n * 100) / 100
