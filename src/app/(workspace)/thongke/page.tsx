import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { lateByShipDate } from '@/modules/dept/production/jobs.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { LogbookScreen, type RunningLsx } from './LogbookScreen'

export const dynamic = 'force-dynamic'

/**
 * SỔ SỐ LIỆU toàn xưởng (vai Thống kê — 0084): thống kê nhập TẬP TRUNG theo
 * ngày qua lưới bảng tính, cuối ngày Chốt sổ theo tổ. Dữ liệu ghi qua sổ
 * per-LSX (append-only); phế = số + lý do text tự do.
 */
export default async function LogbookPage() {
  const user = (await authService.currentUser())!
  const [active, stages, dept, allDepts] = await Promise.all([
    productionRepo.listActive(),
    productionRepo.listStages(),
    user.department_id ? departmentsRepo.findById(user.department_id) : null,
    departmentsRepo.list(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const lsxList: RunningLsx[] = active.map((l) => ({
    id: l.id,
    code: l.code,
    customer_name: l.customer_name,
    order_code: l.order_code,
    ship_date: l.ship_date,
    late: lateByShipDate(l.ship_date, today),
  }))
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  const ownTeam =
    dept && dept.workspace_id === 'production' ? { id: dept.id, name: dept.name } : null

  return (
    <LogbookScreen
      lsxList={lsxList}
      canRecord={canRecord}
      stages={stages}
      teams={allDepts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({ id: d.id, name: d.name }))}
      ownTeam={ownTeam}
      initialStage={resolveTeamStage(dept, stages)}
      canUnlock={user.role === 'admin' || user.role === 'manager'}
    />
  )
}
