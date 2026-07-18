import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { stageForDept } from '@/lib/stage-for-dept'
import { EntryWorkbench } from './EntryWorkbench'
import { canRecordHere, loadRunningLsx } from './shared'

/** Menu "Nhập sản lượng" — màn làm việc chính hằng ngày của thống kê/tổ. */
export default async function OutputEntryPage() {
  const user = (await authService.currentUser())!
  const [lsxList, canRecord, stages, dept] = await Promise.all([
    loadRunningLsx(),
    canRecordHere(),
    productionRepo.listStages(),
    user.department_id ? departmentsRepo.findById(user.department_id) : null,
  ])

  return (
    <EntryWorkbench
      kind="output"
      title="Nhập sản lượng"
      description="Chọn lệnh → ghi sản lượng ngày của tổ mình. Công đoạn tự chọn sẵn theo tổ; nhiều lệnh chạy song song thì đổi lệnh ngay tại đây."
      lsxList={lsxList}
      canRecord={canRecord}
      initialStage={stageForDept(dept?.name ?? null, stages)}
    />
  )
}
