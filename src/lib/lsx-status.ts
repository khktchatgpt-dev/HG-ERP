import type { LsxStatus } from '@/modules/dept/production/production.schema'

export type LsxBadgeTone = 'gray' | 'blue' | 'amber' | 'green' | 'red'

/**
 * Nhãn + màu trạng thái LSX — NGUỒN DÙNG CHUNG cho mọi màn (trang chủ, chi tiết,
 * tiến độ, định hình). Trước đây mỗi màn tự khai → lệch chữ ("Đã duyệt" vs
 * "Đã duyệt — chờ SX") và lệch màu (in_progress chỗ amber chỗ green). Sửa ở đây
 * là đổi đồng bộ mọi nơi.
 */
export const LSX_STATUS: Record<LsxStatus, { label: string; tone: LsxBadgeTone }> = {
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
