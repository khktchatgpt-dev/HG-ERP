import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { MaterialsManager } from './MaterialsManager'

export default async function MaterialsPage() {
  const user = (await authService.currentUser())!
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || (user.role === 'manager' && isWh)
  const [{ rows }, { rows: suppliers }] = await Promise.all([
    materialsService.list(user, { page: 1, page_size: 1000, active_only: false }),
    // NCC đang hoạt động — cho ô "NCC mặc định" của vật tư (tự-điền lên đơn).
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
  ])
  return (
    <MaterialsManager
      materials={rows}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canEdit={canEdit}
    />
  )
}
