import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { DocsManager } from './DocsManager'

/** Phiếu kho: lập phiếu nhập (PNK) / xuất (PXK) nhiều dòng + danh sách phiếu. */
export default async function WarehouseDocsPage() {
  const user = (await authService.currentUser())!
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || (user.role === 'manager' && isWh)

  const [{ rows: docs }, { rows: materials }, pos, { rows: lsxAll }] = await Promise.all([
    stockService.listDocs(user, { page: 1, page_size: 100 }),
    materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    supplyRepo.listOpenPos(),
    productionRepo.list({ page: 1, page_size: 200 }),
  ])

  return (
    <DocsManager
      docs={docs}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        shelf_location: m.shelf_location,
      }))}
      pos={pos}
      lsxs={lsxAll
        .filter((l) => l.status !== 'completed')
        .map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name }))}
      canEdit={canEdit}
    />
  )
}
