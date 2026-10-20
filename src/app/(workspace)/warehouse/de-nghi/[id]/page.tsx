import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { DeNghiScreen } from '../DeNghiScreen'
import { phieuForm } from '../tai-phieu'

export const metadata = { title: 'Kho · Đề nghị mua' }
export const dynamic = 'force-dynamic'

/** Một phiếu đề nghị mua: sửa khi còn nháp, xem khi đã gửi (0236, DN-1). */
export default async function DeNghiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [{ phieu, canManage, canNhap }, lsx] = await Promise.all([
    deNghiService.get(user, id),
    productionRepo.listActive(),
  ])
  return (
    <DeNghiScreen
      phieu={phieuForm(phieu)}
      lsx={lsx.map((l) => ({ id: l.id, code: l.code }))}
      canManage={canManage}
      canNhap={canNhap}
    />
  )
}
