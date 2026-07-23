import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { reservedByCommittedLsx } from '@/modules/dept/warehouse/stock.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { computeReorder, type ReorderInput } from '@/lib/reorder'

/**
 * Mua bù tồn (nghiệp vụ ①) — gợi ý cho PO NGOÀI LSX: vật tư có vị thế
 * (khả dụng + đang về) dưới ngưỡng đặt lại. Logic thuần ở @/lib/reorder;
 * đây chỉ lắp ráp: item master (ngưỡng/lô) + tồn + giữ chỗ LSX + PO mở.
 */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  await assertAction(user, 'supply.po.manage') // nguồn điền vào form tạo PO

  const [{ rows: mats }, stock, reserved, onOrder] = await Promise.all([
    materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    stockRepo.list({ low_only: false }),
    reservedByCommittedLsx(),
    supplyRepo.orderedPendingAll(),
  ])
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  const rows: ReorderInput[] = mats.map((m) => {
    const oh = onHand.get(m.id) ?? 0
    const res = reserved.get(m.id) ?? 0
    const oo = onOrder.get(m.id) ?? { ordered: 0, pending: 0 }
    return {
      material_id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      min_stock: m.min_stock,
      max_stock: m.max_stock,
      reorder_point: m.reorder_point,
      reorder_qty: m.reorder_qty,
      available: oh - res,
      ordered: oo.ordered,
      pending: oo.pending,
      default_supplier_id: m.default_supplier_id,
    }
  })
  return NextResponse.json({ items: computeReorder(rows) })
})
