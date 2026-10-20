import { canAction } from '@/modules/core/rbac/rbac.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { todayVn } from '@/lib/date-vn'
import { SoChuyenScreen } from './SoChuyenScreen'
import { toCostRow } from './van-chuyen.shared'

export const metadata = { title: 'Mua hàng · Vận chuyển' }
export const dynamic = 'force-dynamic'

/**
 * SỔ CHUYẾN — Khuôn C (artboard 13a, duyệt 28/09/2026). Câu trả lời: "chuyến
 * nào chưa trả tiền, ai đang chờ hoàn?" Một hàng = một phiếu phí = một chuyến.
 *
 * Tách hẳn khỏi Nhà cung cấp (chủ dự án chốt): đơn vị vận chuyển có danh mục
 * riêng ở `/mua-hang/van-chuyen/don-vi`. Vài trăm phiếu/năm — nạp một lượt,
 * lọc ở client.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [costs, canRecord, users] = await Promise.all([
    poCostsService.listAll(user),
    canAction(user, 'supply.po_cost.manage'),
    usersRepo.list({ active_only: true }),
  ])
  return (
    <SoChuyenScreen
      rows={costs.map(toCostRow)}
      today={todayVn()}
      canRecord={user.role === 'admin' || canRecord}
      me={{ id: user.id, name: user.name ?? user.email }}
      payers={users.map((u) => ({ id: u.id, name: u.name ?? u.email }))}
    />
  )
}
