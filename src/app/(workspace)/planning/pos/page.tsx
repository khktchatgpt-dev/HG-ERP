import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { PosManager } from './PosManager'

export default async function PlanningPosPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  const canApprove = user.role === 'admin' || user.role === 'manager'

  const [{ rows: pos }, { rows: suppliers }, { rows: lsxAll }, { rows: materials }] =
    await Promise.all([
      posService.list(user, { page: 1, page_size: 300 }),
      suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
      productionRepo.list({ page: 1, page_size: 200 }),
      materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    ])

  // Tổng tiền từng PO (1 truy vấn gộp) — cho cột Giá trị.
  const totals = await posRepo.totalsByPoIds(pos.map((p) => p.id))

  return (
    <PosManager
      pos={pos.map((p) => ({ ...p, total: totals[p.id] ?? 0 }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      lsxs={lsxAll
        .filter((l) => l.status !== 'completed')
        .map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name }))}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        price_unit: m.price_unit,
        unit2_factor: m.unit2_factor,
      }))}
      canEdit={!!canEdit}
      canApprove={canApprove}
    />
  )
}
