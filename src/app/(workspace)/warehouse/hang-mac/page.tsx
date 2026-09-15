import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { blockedService } from '@/modules/dept/warehouse/blocked.service'
import { HangMacScreen } from './HangMacScreen'

/**
 * HÀNG MẮC — Khuôn C. Câu hỏi: *lô nào đang nằm chết, ai phải quyết, bao lâu
 * rồi?*
 *
 * Màn này CHỈ TỒN TẠI ĐƯỢC vì hàng không đạt nay vào sổ (0194). Trước đó lô
 * hỏng bị loại ngoài sổ — nằm thật ngoài sân mà không bảng nào đếm được.
 *
 * Người phải quyết thường KHÔNG phải Kho mà là Cung ứng (trả NCC hay chịu
 * giá giảm), nên trang mở cho cả hai; quyền SỬA vẫn do service gác.
 */
export default async function HangMacPage() {
  const user = await authService.requirePageUser()
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))
  /* Huỷ là mất tài sản và chưa có vòng duyệt — siết bằng vai, xem service. */
  const canHuy = user.role === 'admin' || user.role === 'manager'

  const lots = await blockedService.list(user)
  return <HangMacScreen lots={lots} canEdit={canEdit} canHuy={canHuy} />
}
