/**
 * MUA TRÊN SÀN TMĐT (0279, 26/10/2026) — logic thuần, dùng chung server + client.
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
 * phiếu trả tiền như trước 0279.
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

/**
 * CÁCH TRẢ TIỀN lúc đặt trên sàn (user chốt 26/10/2026: cho chọn cả). Ghi vào
 * `accounting_supplier_payments.method` — cột chữ tự do sẵn có, đây là bộ giá trị
 * mà bước "Đặt trên sàn" sinh ra.
 */
export const PREPAY_METHODS = ['ck', 'the', 'ung', 'cod'] as const
export type PrepayMethod = (typeof PREPAY_METHODS)[number]

export const PREPAY_METHOD_LABEL: Record<PrepayMethod, string> = {
  ck: 'Chuyển khoản công ty',
  the: 'Thẻ công ty',
  ung: 'Nhân viên ứng tiền',
  cod: 'COD — trả khi nhận hàng',
}

/**
 * Gửi duyệt đơn sàn phải nói MUA CỦA SHOP NÀO — Giám đốc duyệt một đơn "Shopee"
 * không tên shop là duyệt mù. Trả lý do chặn (kèm cách gỡ) hoặc null.
 */
export function guiDuyetSanLoi(po: { marketplace_shop?: string | null }): string | null {
  return po.marketplace_shop?.trim()
    ? null
    : 'Đơn mua trên sàn chưa có tên shop — bấm "Sửa" điền tên shop bán rồi mới gửi duyệt được'
}

export type DatTrenSan = {
  order_no: string
  tracking_no?: string | null
  method: PrepayMethod
  amount?: number | null
  paid_by_user_id?: string | null
}

/**
 * Kiểm bước "ĐẶT TRÊN SÀN" — sàn bắt trả tiền lúc đặt, nên bước này ghi luôn số
 * đã trả. COD là ngoại lệ duy nhất được để trống tiền: trả khi nhận, Kế toán ghi
 * phiếu chi lúc đó. Trả lý do chặn hoặc null.
 */
export function datTrenSanLoi(s: Partial<DatTrenSan> | null | undefined): string | null {
  if (!s)
    return 'Đơn mua trên sàn: ghi mã đơn sàn và số tiền đã trả ở bước "Đặt trên sàn"'
  if (!s.order_no?.trim())
    return 'Chưa có mã đơn sàn — chép mã đơn trong app Shopee/Lazada vào'
  if (!s.method || !PREPAY_METHODS.includes(s.method)) return 'Chọn cách trả tiền'
  if (s.method !== 'cod' && !(Number(s.amount) > 0))
    return 'Chưa có số tiền đã trả — ghi đúng số app trừ (gồm phí ship, đã trừ voucher)'
  return null
}

/** Tên shop đã mua trên một sàn — gợi ý cho ô Shop lúc soạn đơn. */
export type ShopGoiY = { supplier_id: string; shop: string; n: number; last: string }

/**
 * Gom đơn sàn thành gợi ý tên shop: theo từng sàn, mỗi tên một dòng (không phân biệt
 * hoa thường / khoảng trắng thừa — "Shop A" và "shop  a" là một), giữ cách viết của
 * lần dùng GẦN NHẤT, xếp theo lần mua gần nhất. `rows` phải xếp mới → cũ.
 */
export function gomShop(
  rows: { supplier_id: string; marketplace_shop: string | null; created_at: string }[],
): ShopGoiY[] {
  const by = new Map<string, ShopGoiY>()
  for (const r of rows) {
    const shop = r.marketplace_shop?.trim().replace(/\s+/g, ' ')
    if (!shop) continue
    const key = `${r.supplier_id}|${shop.toLowerCase()}`
    const cur = by.get(key)
    if (cur) cur.n += 1
    else by.set(key, { supplier_id: r.supplier_id, shop, n: 1, last: r.created_at.slice(0, 10) }) // prettier-ignore
  }
  return [...by.values()]
}

/**
 * Đọc số tiền gõ kiểu Việt Nam: "2.500.000" = 2500000, "2500000" như cũ, "2,5" = 2.5.
 * Chấm là dấu nghìn, phẩy là dấu thập phân (luật số VN của cả dự án). Không đọc được → null.
 */
export function docTien(s: string): number | null {
  const t = s
    .replace(/[\s₫đ]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
