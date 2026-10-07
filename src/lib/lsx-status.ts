import type { LsxStatus } from '@/modules/dept/production/production.schema'

export type LsxBadgeTone = 'gray' | 'blue' | 'amber' | 'green' | 'red'

/**
 * Nhãn + màu trạng thái LSX — NGUỒN DÙNG CHUNG cho mọi màn (trang chủ, chi tiết,
 * tiến độ, định hình). Trước đây mỗi màn tự khai → lệch chữ ("Đã duyệt" vs
 * "Đã duyệt — chờ SX") và lệch màu (in_progress chỗ amber chỗ green). Sửa ở đây
 * là đổi đồng bộ mọi nơi.
 */
export const LSX_STATUS: Record<LsxStatus, { label: string; tone: LsxBadgeTone }> = {
  draft: { label: 'Nháp', tone: 'gray' },
  pending_approval: { label: 'Chờ GĐ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt', tone: 'blue' },
  in_progress: { label: 'Đang sản xuất', tone: 'amber' },
  completed: { label: 'Hoàn thành', tone: 'green' },
  rejected: { label: 'Bị từ chối', tone: 'red' },
  cancelled: { label: 'Đã huỷ theo đơn', tone: 'gray' },
}

/** Nhãn ngắn cho trạng thái (fallback code nếu lạ). */
export function lsxStatusLabel(status: string): string {
  return LSX_STATUS[status as LsxStatus]?.label ?? status
}

/**
 * Dòng cảnh báo in chéo lên phiếu / file Excel khi lệnh CHƯA CÓ HIỆU LỰC. Trước
 * 07/10/2026 chỉ trang xem trước có watermark; `/print/lsx/[id]` in lệnh nháp,
 * chờ duyệt, bị từ chối hay đã huỷ y hệt bản chính thức — xưởng không phân biệt
 * được. Trả null khi lệnh đã duyệt / đang SX / hoàn thành.
 */
export function lsxPrintWatermark(status: string): string | null {
  switch (status as LsxStatus) {
    case 'draft':
      return 'BẢN NHÁP — chưa gửi Giám đốc duyệt, chưa có hiệu lực'
    case 'pending_approval':
      return 'CHỜ GIÁM ĐỐC DUYỆT — chưa có hiệu lực sản xuất'
    case 'rejected':
      return 'BỊ TỪ CHỐI — không có hiệu lực'
    case 'cancelled':
      return 'ĐÃ HUỶ THEO ĐƠN — không sản xuất'
    default:
      return null
  }
}
