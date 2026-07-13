import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { SupplierDetail } from './SupplierDetail'

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))

  const supplier = await suppliersRepo.findById(id)
  if (!supplier) notFound()

  const [{ rows: pos }, { rows: materials }, purchased] = await Promise.all([
    posRepo.list({ supplier_id: id, page: 1, page_size: 200 }),
    materialsService.list(user, { page: 1, page_size: 1000, active_only: true }),
    posRepo.materialsPurchasedBySupplier(id),
  ])
  const totals = await posRepo.totalsByPoIds(pos.map((p) => p.id))

  return (
    <SupplierDetail
      supplier={supplier}
      purchased={purchased}
      pos={pos.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        lsx_code: p.lsx_code,
        order_code: p.order_code,
        expected_at: p.expected_at,
        created_at: p.created_at,
        total: totals[p.id] ?? 0,
      }))}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
      }))}
      canEdit={!!canEdit}
    />
  )
}
