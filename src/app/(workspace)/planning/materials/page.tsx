import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { MaterialsManager } from '@/app/(workspace)/warehouse/materials/MaterialsManager'

/**
 * Vật tư & giá mua — VIEW MUA HÀNG của danh mục vật tư dùng chung (không tách
 * bảng). Cung ứng sửa nhóm trường mua hàng (NCC mặc định, VAT, profile giá…);
 * trường tồn trữ (min/max, kệ, barcode) khoá — Kho quản ở /warehouse/materials.
 */
export default async function PlanningMaterialsPage() {
  const user = (await authService.currentUser())!
  const canEdit = await canAction(user, 'warehouse.material.update_purchasing')
  const [{ rows }, { rows: suppliers }] = await Promise.all([
    materialsService.list(user, { page: 1, page_size: 1000, active_only: false }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
  ])
  return (
    <MaterialsManager
      materials={rows}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canEdit={canEdit}
      scope="purchasing"
    />
  )
}
