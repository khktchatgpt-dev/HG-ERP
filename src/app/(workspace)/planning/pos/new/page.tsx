import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { PoCreateForm } from './PoCreateForm'

const PO_OPEN = [
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
]

export default async function NewPoPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/planning/pos')
  const { supplier: defaultSupplierId } = await searchParams

  const [{ rows: suppliers }, { rows: lsxAll }, stock, { rows: allPos }, { rows: mats }] =
    await Promise.all([
      suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
      productionRepo.list({ page: 1, page_size: 200 }),
      // Vật tư kèm tồn kho realtime (warehouse_stock) — tự hiện khi chọn vật tư.
      stockRepo.list({ low_only: false }),
      posRepo.list({ page: 1, page_size: 500 }),
      // View stock không có price_unit/unit2_factor (giá đv kép 0053) — nạp
      // trực tiếp từ repo (read-only, service kho guard theo phòng Kho).
      materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    ])

  // Giá đv kép: material_id → {price_unit, unit2_factor} để form tự quy đổi.
  const dualPricing = new Map(mats.map((m) => [m.id, m]))

  // PO đang mở theo NCC — hiện ở thẻ tóm tắt để người mua cân nhắc dồn đơn.
  const openBySupplier = new Map<string, number>()
  for (const p of allPos) {
    if (!PO_OPEN.includes(p.status)) continue
    openBySupplier.set(p.supplier_id, (openBySupplier.get(p.supplier_id) ?? 0) + 1)
  }

  return (
    <PoCreateForm
      defaultSupplierId={defaultSupplierId}
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        rating: s.rating,
        lead_time_days: s.lead_time_days,
        payment_terms: s.payment_terms,
        phone: s.phone,
        open_po_count: openBySupplier.get(s.id) ?? 0,
      }))}
      // Chỉ LSX đã qua duyệt GĐ mới đặt vật tư được (service cũng chặn — BR-05).
      lsxs={lsxAll
        .filter((l) => l.status === 'approved' || l.status === 'in_progress')
        .map((l) => ({
          id: l.id,
          code: l.code,
          order_code: l.order_code,
          customer_name: l.customer_name,
        }))}
      materials={stock.map((s) => ({
        id: s.material_id,
        code: s.code,
        name: s.name,
        unit: s.unit,
        on_hand: s.on_hand,
        price_unit: dualPricing.get(s.material_id)?.price_unit ?? null,
        unit2_factor: dualPricing.get(s.material_id)?.unit2_factor ?? null,
      }))}
    />
  )
}
