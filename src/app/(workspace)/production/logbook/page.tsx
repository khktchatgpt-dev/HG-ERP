import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { defectCodesRepo } from '@/modules/dept/production/defect-codes.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { canRecordHere, loadRunningLsx } from '../entry/shared'
import { LogbookScreen } from './LogbookScreen'

/**
 * SỔ GHI SẢN LƯỢNG toàn xưởng (07/2026) — màn chốt số cuối ngày của thống kê:
 * lọc Ngày/Tổ/Công đoạn/LSX → lưới nhập nhanh kiểu bảng tính (bàn phím) →
 * footer Chốt sổ ngày theo tổ. Dữ liệu ghi vẫn đi qua sổ per-LSX (append-only).
 */
export default async function LogbookPage() {
  const user = (await authService.currentUser())!
  const [lsxList, canRecord, stages, dept, allDepts, defectCodes] = await Promise.all([
    loadRunningLsx(),
    canRecordHere(),
    productionRepo.listStages(),
    user.department_id ? departmentsRepo.findById(user.department_id) : null,
    departmentsRepo.list(),
    defectCodesRepo.listActive(),
  ])
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
      defectCodes={defectCodes.map((c) => ({
        code: c.code,
        label: c.label,
        stage_code: c.stage_code,
      }))}
      ownTeam={ownTeam}
      initialStage={resolveTeamStage(dept, stages)}
      canUnlock={user.role === 'admin' || user.role === 'manager'}
    />
  )
}
