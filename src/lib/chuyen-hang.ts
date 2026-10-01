/**
 * CHUYẾN HÀNG (0216, 01/10/2026) — logic thuần, không chạm DB.
 *
 * Một chuyến = một lần hàng rời NCC trên một chiếc xe: gửi chành, HG thuê xe đi
 * lấy, hoặc NCC tự chở báo ngày tới. Chở được nhiều đơn của nhiều NCC.
 *
 * CHUYẾN KHÔNG MANG TIỀN (chủ dự án chốt 01/10): chỉ để nhận biết đơn nào đang
 * trên xe nào, bao giờ về kho. Phí vận chuyển ghi riêng (supply_po_costs).
 */

export const TRIP_MODES = ['chanh', 'xe_thue', 'ncc_cho'] as const
export type TripMode = (typeof TRIP_MODES)[number]

export const TRIP_MODE_LABEL: Record<TripMode, string> = {
  chanh: 'Gửi chành',
  xe_thue: 'Xe HG thuê đi lấy',
  ncc_cho: 'NCC tự chở',
}

export type TripStatus = 'dang_di' | 'da_toi' | 'da_ve_kho' | 'huy'

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  dang_di: 'Đang đi',
  da_toi: 'Đã tới xưởng',
  da_ve_kho: 'Đã về kho',
  huy: 'Đã huỷ',
}

export const PACKAGE_UNITS = ['kiện', 'bao', 'bó', 'cuộn', 'thùng', 'pallet'] as const

/**
 * TRẠNG THÁI SUY RA, không lưu cột: "đã về kho" là khi MỌI đơn trong chuyến đã
 * có phiếu nhập Kho từ ngày gửi trở đi (hoặc đơn đã về đủ). Lưu cứng thì hai sự
 * thật (chuyến nói đã về, kho chưa có phiếu) có thể cãi nhau.
 */
export function tripStatus(
  t: { cancelled_at: string | null; arrived_at: string | null; sent_on: string },
  pos: { status: string; last_receipt_on: string | null }[],
): TripStatus {
  if (t.cancelled_at) return 'huy'
  const sent = t.sent_on.slice(0, 10)
  const allIn =
    pos.length > 0 &&
    pos.every(
      (p) =>
        p.status === 'received' ||
        (p.last_receipt_on != null && p.last_receipt_on.slice(0, 10) >= sent),
    )
  if (allIn) return 'da_ve_kho'
  if (t.arrived_at) return 'da_toi'
  return 'dang_di'
}

/** Chuyến còn phải theo dõi (hiện ở màn Đang về). */
export function isOpenTrip(s: TripStatus): boolean {
  return s === 'dang_di' || s === 'da_toi'
}

/** Còn / trễ bao nhiêu ngày so với dự kiến tới. null = chưa có ngày dự kiến. */
export function etaDays(eta: string | null, todayIso: string): number | null {
  if (!eta) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(eta) - t(todayIso)) / 86_400_000)
}

export type TripDraft = {
  mode: TripMode
  carrier_name: string
  sent_on: string
  eta: string | null
  po_ids: string[]
}

/**
 * Vì sao CHƯA lưu được — một câu, hiện ngay dưới hộp, không đợi bấm. Server
 * kiểm lại cùng luật (zod + ràng buộc DB).
 */
export function tripProblem(d: TripDraft): string | null {
  if (d.carrier_name.trim().length < 2)
    return d.mode === 'ncc_cho' ? 'Ghi tên xe / người chở' : 'Ghi tên chành hoặc nhà xe'
  if (!d.sent_on) return 'Chọn ngày hàng rời NCC'
  if (d.eta && d.eta.slice(0, 10) < d.sent_on.slice(0, 10))
    return 'Ngày dự kiến tới trước ngày gửi'
  if (d.po_ids.length === 0) return 'Chọn ít nhất một đơn đi trong chuyến'
  return null
}
