import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { MaterialsManager } from '@/app/(workspace)/warehouse/materials/MaterialsManager'
import { PAGE_SIZE } from '@/app/(workspace)/warehouse/materials/constants'

/**
 * Vật tư & giá mua — VIEW MUA HÀNG của danh mục vật tư dùng chung (không tách
 * bảng). Cung ứng sửa nhóm trường mua hàng (NCC mặc định, VAT, profile giá…);
 * trường tồn trữ (min/max, kệ, barcode) khoá — Kho quản ở /warehouse/materials.
 *
 * Lọc + phân trang ở SERVER — lý do xem `warehouse/materials/page.tsx`.
 */
export default async function PlanningMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; page?: string }>
}) {
  const sp = await searchParams
  const user = (await authService.currentUser())!
  const canEdit = await canAction(user, 'warehouse.material.update_purchasing')

  const q = sp.q?.trim() || undefined
  const group = sp.group?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const [{ rows }, counts, { rows: suppliers }, tax] = await Promise.all([
    materialsService.list(user, {
      q,
      group_name: group,
      page,
      page_size: PAGE_SIZE,
      active_only: false,
    }),
    materialsService.counts(user, { q, group_name: group }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    materialTaxonomy(),
  ])

  return (
    <MaterialsManager
      materials={rows}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canEdit={canEdit}
      scope="purchasing"
      counts={counts}
      page={page}
      filters={{ q: sp.q ?? '', group: sp.group ?? '' }}
      taxonomy={tax}
    />
  )
}
