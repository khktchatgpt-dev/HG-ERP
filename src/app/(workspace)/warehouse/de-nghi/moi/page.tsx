import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { DeNghiScreen } from '../DeNghiScreen'
import { phieuMoi } from '../tai-phieu'

export const metadata = { title: 'Kho · Lập đề nghị mua' }
export const dynamic = 'force-dynamic'

/** Lập "Giấy đề nghị mua vật tư" mới (0236, bản vẽ DN-1). */
export default async function DeNghiMoiPage() {
  const user = await authService.requirePageUser()
  const [lsx, canManage] = await Promise.all([
    productionRepo.listActive(),
    canAction(user, 'warehouse.request.manage'),
  ])
  return (
    <DeNghiScreen
      phieu={phieuMoi(user.name ?? user.email)}
      lsx={lsx.map((l) => ({ id: l.id, code: l.code }))}
      canManage={canManage}
    />
  )
}
