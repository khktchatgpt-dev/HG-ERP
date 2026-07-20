import { authService } from '@/modules/core/auth/auth.service'
import { defectCodesService } from '@/modules/dept/production/defect-codes.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { DefectCodesManager } from './DefectCodesManager'

/** Danh mục nguyên nhân lỗi SX (0067) — admin quản lý; sổ sản lượng tham chiếu code. */
export default async function AdminDefectCodesPage() {
  const user = (await authService.currentUser())!
  const [items, stages] = await Promise.all([
    defectCodesService.listAll(user),
    productionRepo.listStages(),
  ])
  return <DefectCodesManager items={items} stages={stages} />
}
