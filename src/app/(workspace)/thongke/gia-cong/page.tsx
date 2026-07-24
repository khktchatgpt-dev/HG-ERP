import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { OutsourceWorkbench } from './OutsourceWorkbench'

export const dynamic = 'force-dynamic'

/**
 * GIA CÔNG NGOÀI — trang riêng của thống kê (0087): chọn lệnh đang chạy ngay
 * tại đây rồi ghi giao/nhận (panel self-fetch theo lsxId), khỏi mở từng hồ sơ.
 */
export default async function OutsourcePage() {
  const user = (await authService.currentUser())!
  const [active, canRecord] = await Promise.all([
    productionRepo.listActive(),
    isProductionStaff(user).then(
      (m) => m || user.role === 'admin' || user.role === 'manager',
    ),
  ])
  return (
    <OutsourceWorkbench
      lsxList={active.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
      }))}
      canRecord={canRecord}
    />
  )
}
