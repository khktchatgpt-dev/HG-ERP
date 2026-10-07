/**
 * Nhãn + màu vòng đời ĐƠN BÁN cho màn kiểu ERP (khối `sales/_erp/ui.tsx`,
 * 07/10/2026). Một nguồn cho sổ đơn, chi tiết đơn, trang chủ Sale — thêm trạng
 * thái (0223) thì sửa một chỗ. Màu: `--warn` đang chờ ai đó, `--done` đã xong
 * bước, `--stop` dừng/huỷ, trung tính = đang chạy bình thường.
 */
import { STATUS_LABEL } from './order-progress'

export type StatusTone = 'stop' | 'warn' | 'done' | 'neutral'

const TONE: Record<string, StatusTone> = {
  confirmed: 'warn', // chờ phát lệnh
  lsx_pending: 'warn', // chờ GĐ duyệt lệnh
  lsx_issued: 'neutral',
  completed: 'done',
  partially_shipped: 'warn',
  shipped: 'done',
  delivered: 'done',
  cancelled: 'stop',
}

export function orderStatusTone(status: string): StatusTone {
  return TONE[status] ?? 'neutral'
}

export function orderStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

/** Đơn đã đóng — không còn là việc phải lo (hạn giao, xuất, sửa). */
export function isOrderClosed(status: string): boolean {
  return status === 'delivered' || status === 'cancelled'
}

/** Bước kế tiếp mà Sale phải làm với đơn này — câu ngắn cho ô "Việc kế". */
export function orderNextStep(input: {
  status: string
  hasLsx: boolean
  lsxStatus?: string | null
  shipped: number
  total: number
}): string {
  switch (input.status) {
    case 'confirmed':
      return input.hasLsx ? 'Lệnh đang soạn' : 'Phát lệnh sản xuất'
    case 'lsx_pending':
      return 'Chờ Giám đốc duyệt lệnh'
    case 'lsx_issued':
      return input.lsxStatus === 'rejected'
        ? 'Lệnh bị từ chối — sửa, trình lại'
        : 'Xưởng đang làm'
    case 'completed':
      return 'Ghi xuất hàng'
    case 'partially_shipped':
      return `Xuất tiếp (còn ${Math.max(input.total - input.shipped, 0)})`
    case 'shipped':
      return 'Xác nhận đã giao'
    case 'delivered':
      return 'Đã khép'
    case 'cancelled':
      return 'Đã huỷ'
    default:
      return ''
  }
}
