/**
 * MUA TRÊN SÀN TMĐT (0278, 26/10/2026) — logic thuần, dùng chung server + client.
 *
 * Mua Shopee/Lazada không đẻ chứng từ mới: vẫn là ĐƠN MUA, chỉ khác ở chỗ NCC là
 * một SÀN (`supply_suppliers.is_marketplace`), tiền trả TRƯỚC lúc đặt, và sàn có
 * thể HOÀN tiền. Mỗi con số một nguồn — file này chỉ là các phép tính trên nguồn đó.
 */

/** Loại phiếu chi NCC. `amount` luôn > 0 (check DB); DẤU nằm ở đây. */
export const PAYMENT_KINDS = ['payment', 'refund'] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  payment: 'Trả tiền',
  refund: 'Hoàn tiền',
}

/**
 * Số tiền của một phiếu chi CÓ DẤU, để cộng vào "đã trả": phiếu hoàn tiền (sàn trả
 * lại khi shop huỷ / trả hàng) TRỪ đi. Thiếu `kind` (đọc từ chỗ chưa select cột) =
 * phiếu trả tiền như trước 0278.
 */
export function soTienDaTra(p: { amount: unknown; kind?: string | null }): number {
  const v = Number(p.amount ?? 0) || 0
  return p.kind === 'refund' ? -v : v
}

/**
 * Hai ô riêng của đơn mua trên sàn. Đơn NCC thường thì GHI NULL dù client có gửi
 * — đổi NCC từ Shopee sang NCC thật lúc sửa nháp không được để "tên shop" cũ dính lại.
 */
export function truongSan(
  isMarketplace: boolean,
  input: { marketplace_shop?: string | null; marketplace_tracking_no?: string | null },
): { marketplace_shop: string | null; marketplace_tracking_no: string | null } {
  if (!isMarketplace) return { marketplace_shop: null, marketplace_tracking_no: null }
  const t = (s: string | null | undefined) => s?.trim() || null
  return {
    marketplace_shop: t(input.marketplace_shop),
    marketplace_tracking_no: t(input.marketplace_tracking_no),
  }
}

/** Tình trạng hoá đơn GTGT của một đơn — suy từ sự thật đã ghi, không lưu thành cột. */
export type HoaDonDon = 'waived' | 'received' | 'pending'

export const HOA_DON_DON_LABEL: Record<HoaDonDon, string> = {
  waived: 'Không có hoá đơn',
  received: 'Đã có hoá đơn',
  pending: 'Chờ hoá đơn',
}

/**
 * Có hoá đơn đã vào sổ thì là "đã có" — kể cả khi trước đó ai đó đánh dấu không có
 * (shop gửi hoá đơn muộn): giấy thật thắng lời khai.
 */
export function hoaDonDon(p: {
  invoice_waived_reason?: string | null
  posted_invoice_count: number
}): HoaDonDon {
  if (p.posted_invoice_count > 0) return 'received'
  if (p.invoice_waived_reason?.trim()) return 'waived'
  return 'pending'
}

export type NoHoanUng = {
  user_id: string
  currency: string
  amount: number
  count: number
}

/**
 * CÔNG TY CÒN NỢ NHÂN VIÊN bao nhiêu — phiếu chi do nhân viên ứng tiền riêng
 * (`paid_by_user_id`) mà chưa hoàn ứng. Sàn hoàn tiền về tài khoản người đã trả,
 * nên phiếu hoàn của chính người đó TRỪ vào số công ty nợ họ. Tách theo tiền tệ;
 * người đã hết nợ (≤ 0) không hiện.
 */
export function noHoanUng(
  payments: {
    paid_by_user_id?: string | null
    reimbursed_at?: string | null
    amount: unknown
    kind?: string | null
    currency?: string | null
  }[],
): NoHoanUng[] {
  const by = new Map<string, NoHoanUng>()
  for (const p of payments) {
    if (!p.paid_by_user_id || p.reimbursed_at) continue
    const currency = p.currency || 'VND'
    const key = `${p.paid_by_user_id}|${currency}`
    const row = by.get(key) ?? {
      user_id: p.paid_by_user_id,
      currency,
      amount: 0,
      count: 0,
    }
    row.amount = Math.round((row.amount + soTienDaTra(p)) * 100) / 100
    row.count += 1
    by.set(key, row)
  }
  return [...by.values()].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount)
}
