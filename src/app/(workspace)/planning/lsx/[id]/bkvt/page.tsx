import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxPlanService } from '@/modules/dept/supply/lsx-plan.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { BkvtManager } from './BkvtManager'

/**
 * Bảng kê vật tư của một LSX — màn của phòng Cung ứng: gán NCC từng dòng rồi
 * tách thành đơn đặt. Nằm trong shell Kế hoạch - Cung ứng, cạnh hồ sơ lệnh.
 */
export default async function BkvtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = (await authService.currentUser())!

  const lsx = await productionRepo.findById(id)
  if (!lsx) notFound()

  const [rows, suppliers] = await Promise.all([
    lsxPlanService.list(user, id),
    suppliersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <BkvtManager
      lsxId={id}
      lsxCode={lsx.code}
      rows={rows}
      suppliers={suppliers.rows.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
    />
  )
}
