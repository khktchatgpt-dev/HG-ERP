import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { poReviewService } from '@/modules/dept/supply/po-review.service'
import { ChoXemKhongQuyen, ChoXemScreen } from './ChoXemScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Chờ tôi xem' }

/**
 * CHỜ TÔI XEM — trưởng phòng Cung ứng xem đơn chờ duyệt trước khi lên bàn Giám
 * đốc (05/11/2026, bản vẽ RcqWLU7F1z33btAR97gZBo). Mục menu chỉ hiện cho vai
 * trưởng phòng (capability `supply.review`); ai gõ thẳng địa chỉ mà không có
 * quyền thì thấy lý do, không thấy trang lỗi.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const ok = user.role === 'admin' || (await canAction(user, 'supply.po.manage_any'))
  if (!ok) return <ChoXemKhongQuyen />
  const box = await poReviewService.box(user)
  return <ChoXemScreen box={box} />
}
