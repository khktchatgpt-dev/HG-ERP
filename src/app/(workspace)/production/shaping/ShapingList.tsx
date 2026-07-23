import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { routesRepo } from '@/modules/dept/production/routes.repo'
import { canEditComponents } from '@/modules/dept/production/components.service'
import { ShapingManager, type ShapingItem } from './ShapingManager'

/**
 * Định hình sản xuất (SRS): QL Kế hoạch lên bảng chi tiết cụm/chi tiết + chốt
 * lộ trình giai đoạn cho từng SP của lệnh, TRƯỚC khi xưởng nhập sản lượng.
 * Danh sách chỉ các lệnh còn cần định hình (chờ duyệt / đã duyệt / đang chạy).
 *
 * Tách khỏi page.tsx để tham số hoá `base` (link dòng + breadcrumb) — hiện chỉ
 * shell Sản xuất dùng (/production/shaping; user chốt Cung ứng KHÔNG mang giao
 * diện sản xuất — planner định hình thì chuyển sang ws Sản xuất).
 */
export async function ShapingList({
  base,
  rootCrumb,
}: {
  base: string
  rootCrumb: { label: string; href: string }
}) {
  const user = (await authService.currentUser())!
  const canEdit = await canEditComponents(user)

  const [{ rows }, componentCounts, routeCounts] = await Promise.all([
    productionService.list(user, { page: 1, page_size: 200 }),
    componentsRepo.countsByLsx(),
    routesRepo.countsByLsx(),
  ])
  const active = rows.filter(
    (r) =>
      r.status === 'pending_approval' ||
      r.status === 'approved' ||
      r.status === 'in_progress',
  )
  // Tổng dòng SP per lệnh — để cột lộ trình nói "đã chốt x/y SP" thay vì con
  // số trần: 1/4 nghĩa là còn 3 SP chưa định hình, nhìn là biết còn việc.
  const lineCounts = await productionRepo.linesCountByOrder(
    active.map((r) => r.sales_order_id),
  )

  const items: ShapingItem[] = active.map((r) => ({
    id: r.id,
    code: r.code,
    order_code: r.order_code,
    customer_name: r.customer_name,
    status: r.status,
    comps: componentCounts.get(r.id) ?? 0,
    routes: routeCounts.get(r.id) ?? 0,
    line_total: lineCounts.get(r.sales_order_id) ?? 0,
  }))

  return (
    <ShapingManager base={base} rootCrumb={rootCrumb} canEdit={canEdit} items={items} />
  )
}
