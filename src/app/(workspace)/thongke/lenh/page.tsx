import { authService } from '@/modules/core/auth/auth.service'
import { worklistService } from '@/modules/dept/production/worklist.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { LsxListScreen } from './LsxListScreen'

export const dynamic = 'force-dynamic'

/**
 * TIẾN ĐỘ THEO LỆNH — màn XEM, trả lời "lệnh này đang tới đâu".
 *
 * Là TRANG GỐC của khu Thống kê từ 27/08/2026: màn nhập "Sổ sản lượng" đã xoá
 * theo yêu cầu, `/thongke` redirect vào đây. Khu này hiện chưa có màn nhập.
 */
export default async function LenhPage() {
  const user = await authService.requirePageUser()
  const data = await worklistService.list(user)
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))

  return (
    <LsxListScreen
      cards={data.lsx_cards}
      unroutedCount={data.unrouted_count}
      canRecord={canRecord}
    />
  )
}
