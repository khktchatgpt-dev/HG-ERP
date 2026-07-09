import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { SuppliersManager } from './SuppliersManager'

export default async function PlanningSuppliersPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))

  const [{ rows: suppliers }, { rows: pos }, { rows: materials }] = await Promise.all([
    suppliersService.list(user, { page: 1, page_size: 500 }),
    posRepo.list({ page: 1, page_size: 500 }),
    materialsService.list(user, { page: 1, page_size: 1000, active_only: true }),
  ])

  // Lịch sử mua gọn: đếm PO + PO gần nhất theo NCC (FR-SUP-06)
  const poStats = new Map<string, { count: number; last_code: string; last_at: string }>()
  for (const p of pos) {
    const cur = poStats.get(p.supplier_id)
    if (!cur) {
      poStats.set(p.supplier_id, { count: 1, last_code: p.code, last_at: p.created_at })
    } else {
      cur.count++
    }
  }

  return (
    <SuppliersManager
      suppliers={suppliers.map((s) => ({
        ...s,
        po_count: poStats.get(s.id)?.count ?? 0,
        last_po: poStats.get(s.id)?.last_code ?? null,
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
