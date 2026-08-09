import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { TransferBoard } from './TransferBoard'

export const dynamic = 'force-dynamic'

/**
 * BÀN GIAO CHO TỔ (0090) — thống kê ghi "SL giao" phôi/WIP vào tổ theo đợt
 * (cột SL giao 1..4 của sheet tổ trong Excel) + tổ trả lại lỗi/thừa. Tồn WIP
 * tại tổ = giao − trả − đã làm (kể cả phế), đối chiếu tự tính.
 */
export default async function TransfersPage() {
  const user = await authService.requirePageUser()
  const [active, stages, allDepts, canRecord] = await Promise.all([
    productionRepo.listActive(),
    productionRepo.listStages(),
    departmentsRepo.list(),
    isProductionStaff(user).then(
      (m) => m || user.role === 'admin' || user.role === 'manager',
    ),
  ])
  return (
    <TransferBoard
      lsxList={active.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
      }))}
      stages={stages}
      teams={allDepts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({ id: d.id, name: d.name }))}
      canRecord={canRecord}
    />
  )
}
