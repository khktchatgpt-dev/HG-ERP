/**
 * LOẠI THÔNG BÁO LÊN CHUÔNG (05/11/2026, chủ dự án: "chỉ nên báo những thông
 * tin mới được giao đến người nhận, không cần những cảnh báo").
 *
 * Đo 30 ngày trước đó: hơn 3.000 thông báo / 60 loại, 4.444 chưa đọc, 11 người
 * treo trên 50 — còn "việc giao cho bạn" chỉ 2. Số đỏ gộp mọi thứ nên việc giao
 * chìm. Chuông nay chỉ đếm và bày thông báo ĐÍCH DANH về VIỆC GIAO (module
 * tasks): giao / chuyển cho bạn, việc bạn giao báo xong, việc của bạn được
 * duyệt / trả lại, trao đổi trên việc. Mọi loại khác (kho, đơn mua, lệnh,
 * lương…) vẫn ghi và vẫn xem ở trang Thông báo, nhưng không lên chuông.
 *
 * Thuần, client import được (hộp chuông là Client Component).
 */
export const BELL_TYPES = [
  'assigned',
  'reassigned',
  'submitted',
  'approved',
  'rejected',
  'commented',
  'status_changed',
] as const

export type BellType = (typeof BELL_TYPES)[number]

export function isBellType(type: string): type is BellType {
  return (BELL_TYPES as readonly string[]).includes(type)
}
