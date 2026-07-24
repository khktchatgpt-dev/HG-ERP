import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { canEditComponents } from '@/modules/dept/production/perms'
import { ShapingManager, type ShapingItem } from './ShapingManager'

export const dynamic = 'force-dynamic'

/**
 * ĐỊNH HÌNH CHI TIẾT (vai Thống kê xưởng — 0084): lệnh đã duyệt chờ chốt bảng
 * chi tiết/định mức (kéo từ BOM Kỹ thuật + sửa). Lệnh chưa có bảng nổi lên đầu.
 */
export default async function ShapingPage() {
  const user = (await authService.currentUser())!
  const [{ rows }, counts, canEdit] = await Promise.all([
    productionRepo.list({ page: 1, page_size: 200 }),
    componentsRepo.countsByLsx(),
    canEditComponents(user),
  ])
  const items: ShapingItem[] = rows
    .filter((r) => r.status === 'approved' || r.status === 'in_progress')
    .map((r) => ({
      id: r.id,
      code: r.code,
      order_code: r.order_code,
      customer_name: r.customer_name,
      status: r.status,
      ship_date: r.ship_date,
      comps: counts.get(r.id) ?? 0,
    }))
  return <ShapingManager items={items} canEdit={canEdit} />
}
