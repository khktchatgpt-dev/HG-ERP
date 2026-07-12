import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { PoCreateForm } from './PoCreateForm'

export default async function NewPoPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/planning/pos')

  const [{ rows: suppliers }, { rows: lsxAll }, stock] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.list({ page: 1, page_size: 200 }),
    // Vật tư kèm tồn kho realtime (warehouse_stock) — tự hiện khi chọn vật tư.
    stockRepo.list({ low_only: false }),
  ])

  return (
    <PoCreateForm
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      // Chỉ LSX đã qua duyệt GĐ mới đặt vật tư được (service cũng chặn — BR-05).
      lsxs={lsxAll
        .filter((l) => l.status === 'approved' || l.status === 'in_progress')
        .map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name }))}
      materials={stock.map((s) => ({
        id: s.material_id,
        code: s.code,
        name: s.name,
        unit: s.unit,
        on_hand: s.on_hand,
      }))}
    />
  )
}
