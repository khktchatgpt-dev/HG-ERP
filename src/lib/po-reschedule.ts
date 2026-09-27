/**
 * DỜI HẸN GIAO CỦA ĐƠN ĐÃ GỬI.
 *
 * Đơn đã qua tay Giám đốc và đã gửi NCC thì KHÔNG cho sửa lại (xem
 * `posService.update`): sửa giá hay dòng hàng sau khi duyệt là âm thầm vô hiệu
 * hoá chữ ký duyệt, và bản NCC đang cầm khác bản trong máy.
 *
 * Nhưng NGÀY GIAO thì đổi thật, và đổi thường xuyên — NCC báo trễ, xưởng giục
 * sớm. Trước đây không có đường nào ghi lại: hoặc để ngày sai trên hệ thống (rồi
 * cảnh báo "quá hẹn" kêu oan), hoặc huỷ đơn tạo lại (mất số PO đã gửi NCC).
 *
 * Nên tách riêng một thao tác HẸP: chỉ đụng `expected_at`, bắt buộc có lý do, và
 * ghi vết vào Trao đổi nội bộ của đơn. Tiền, dòng hàng, NCC không đổi — chữ ký duyệt vẫn
 * còn nguyên giá trị.
 */

import { reasonLine } from './po-note'

/** Trạng thái cho phép dời hẹn — đơn đang chạy, chưa đóng. */
const RESCHEDULABLE = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']

export type RescheduleGuard = { ok: true } | { ok: false; reason: string }

export function canReschedule(status: string): RescheduleGuard {
  if (status === 'pending_approval') {
    // Chưa duyệt thì sửa thẳng cả đơn được — không cần đường vòng này.
    return { ok: false, reason: 'Đơn chưa duyệt — dùng "Sửa đơn" để đổi cả ngày giao' }
  }
  if (status === 'received') return { ok: false, reason: 'Đơn đã về đủ — không dời được' }
  if (status === 'cancelled') return { ok: false, reason: 'Đơn đã huỷ — không dời được' }
  if (!RESCHEDULABLE.includes(status)) {
    return { ok: false, reason: `Không dời được hẹn giao ở trạng thái "${status}"` }
  }
  return { ok: true }
}

const dmy = (iso: string | null): string =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : 'chưa hẹn'

/**
 * Dòng vết dời hẹn — ghi thành ghi chú Trao đổi NỘI BỘ, không vào `note` (ô
 * đó in lên phiếu gửi NCC, xem lib/po-note). Phần riêng của việc dời hẹn là
 * "ngày cũ → ngày mới"; nhãn dùng chung lối `[nhãn] nội dung` với `[Huỷ]`,
 * `[Trả lại để sửa]`.
 */
export function rescheduleNote(
  oldDate: string | null,
  newDate: string | null,
  reason: string,
): string {
  const what = `${dmy(oldDate)} → ${dmy(newDate)} · ${reason.trim()}`
  // `what` không bao giờ rỗng — `dmy` luôn trả ít nhất 'chưa hẹn'.
  return reasonLine('Dời hẹn giao', what) as string
}

/**
 * DỜI CẢ ĐƠN THÌ DỜI LUÔN CÁC ĐỢT CHƯA GIAO — cùng số ngày (27/09/2026).
 *
 * Trước đây dời hẹn cả đơn chỉ đổi `expected_at`; thao tác kế tiếp trên bất kỳ
 * đợt nào chạy `syncExpectedAt` và kéo mốc về ngày đợt cũ — lần dời bị xoá IM
 * LẶNG. Nay các đợt 'planned' trượt theo đúng độ lệch (giữ khoảng cách giữa các
 * đợt, "đợt 2 sau đợt 1 mười ngày" vẫn đúng). Đợt 'arrived' (xe đã tới, đang
 * nhận dở) và đợt đã nhận / huỷ không đụng. Đơn chưa từng có hẹn → không có độ
 * lệch để trượt, trả rỗng.
 */
export function shiftPlannedShipments(
  shipments: { id: string; status: string; expected_date: string }[],
  oldDate: string | null,
  newDate: string,
): { id: string; from: string; to: string }[] {
  if (!oldDate) return []
  const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
  const delta = Math.round((day(newDate) - day(oldDate)) / 86_400_000)
  if (delta === 0) return []
  return shipments
    .filter((s) => s.status === 'planned')
    .map((s) => {
      const d = new Date(day(s.expected_date) + delta * 86_400_000)
      return { id: s.id, from: s.expected_date.slice(0, 10), to: d.toISOString().slice(0, 10) }
    })
}
