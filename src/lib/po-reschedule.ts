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
 * ghi vết vào ghi chú của đơn. Tiền, dòng hàng, NCC không đổi — chữ ký duyệt vẫn
 * còn nguyên giá trị.
 */

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
 * Dòng vết ghi vào `note` của đơn.
 *
 * Ghi ở đầu ghi chú và giữ nguyên phần cũ — mỗi lần dời thêm một dòng, đọc từ
 * trên xuống là ra lịch sử. Cùng lối với `[Huỷ]` mà `posService.cancel` đang
 * dùng, để người đọc đơn chỉ phải quen một quy ước.
 */
export function rescheduleNote(
  oldDate: string | null,
  newDate: string | null,
  reason: string,
  prevNote: string | null,
): string {
  const line = `[Dời hẹn giao] ${dmy(oldDate)} → ${dmy(newDate)} · ${reason.trim()}`
  return prevNote?.trim() ? `${line}\n${prevNote.trim()}` : line
}
