import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { MaterialsManager } from './MaterialsManager'

export default async function MaterialsPage() {
  const user = (await authService.currentUser())!
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || (user.role === 'manager' && isWh)
  const { rows } = await materialsService.list(user, {
    page: 1,
    page_size: 1000,
    active_only: false,
  })
  return <MaterialsManager materials={rows} canEdit={canEdit} />
}
