/**
 * AI ĐƯỢC SỬA/XOÁ MỘT BẢN GHI CÓ CHỦ — logic thuần, dùng chung cho đơn hàng và
 * lệnh sản xuất (chủ dự án chốt 07/08/2026: "của ai thì người đó có quyền sửa
 * xoá").
 *
 * Trước đây `sales.order.manage` chỉ hỏi "có thuộc phòng Bán Hàng không", nên
 * mọi sale sửa/huỷ được đơn của nhau. Nay permission vẫn là cửa THỨ NHẤT (không
 * phải sale thì khỏi bàn), hàm này là cửa THỨ HAI theo chủ bản ghi.
 *
 * Tách khỏi service để test được mà không cần DB — đây là luật rủi ro cao: siết
 * nhầm là cả phòng không thao tác được.
 */
import type { UserRole } from '@/modules/core/users/users.repo'

export type OwnershipActor = { id: string; role: UserRole }

/**
 * @param createdBy chủ bản ghi (`sales_orders.created_by` / `production_orders.created_by`)
 *
 * Luật:
 *   admin, manager → mọi bản ghi (trưởng phòng/GĐ gánh việc khi sale nghỉ; nếu
 *                    không có đường này thì đơn của người vắng mặt bị kẹt cứng)
 *   nhân viên      → chỉ bản ghi CHÍNH MÌNH tạo
 *   bản ghi vô chủ → chỉ admin/manager. Dữ liệu nhập bằng script không có chủ;
 *                    để nhân viên nào cũng sửa được thì thành lỗ hổng lớn hơn cả
 *                    luật cũ, nên đóng lại và để quản lý gán chủ trước.
 */
export function canMutateOwned(
  actor: OwnershipActor,
  createdBy: string | null | undefined,
): boolean {
  if (actor.role === 'admin' || actor.role === 'manager') return true
  if (!createdBy) return false
  return createdBy === actor.id
}

/** Trạng thái LSX còn cho phép GỠ ĐƠN khỏi lệnh (thao tác mang tính xoá). */
const REMOVABLE_STATUSES = new Set(['draft', 'pending_approval', 'rejected'])

/**
 * Lệnh đã qua tay Giám đốc thì phần nội dung đã duyệt là cam kết với xưởng —
 * chỉ được SỬA/CẬP NHẬT, không được gỡ bớt đơn ra khỏi lệnh (chủ dự án chốt
 * 07/08/2026). Muốn dừng hẳn thì huỷ ĐƠN, lệnh sẽ tự khép theo.
 */
export function canRemoveOrdersFromLsx(status: string): boolean {
  return REMOVABLE_STATUSES.has(status)
}
