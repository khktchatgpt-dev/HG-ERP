import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { routesRepo } from '@/modules/dept/production/routes.repo'
import { canEditComponents } from '@/modules/dept/production/components.service'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'

const LSX_BADGE: Record<
  string,
  { label: string; tone: 'gray' | 'blue' | 'amber' | 'green' }
> = {
  pending_approval: { label: 'Chờ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt', tone: 'blue' },
  in_progress: { label: 'Đang sản xuất', tone: 'green' },
}

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[rootCrumb, { label: 'Định hình sản xuất' }]}
        title="Định hình sản xuất"
        description="Kế hoạch lên bảng chi tiết (cụm → chi tiết → định mức) và chốt lộ trình giai đoạn cho từng SP — xong mới tới lượt xưởng nhập sản lượng."
      />

      {active.length === 0 ? (
        <EmptyState
          icon="▣"
          title="Không có lệnh nào cần định hình"
          description="Lệnh sản xuất mới do Sales phát sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                <th className="px-4 py-2.5">Số LSX</th>
                <th className="px-4 py-2.5">Đơn hàng / Khách</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5">Bảng chi tiết</th>
                <th className="px-4 py-2.5">Lộ trình giai đoạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {active.map((r) => {
                const comps = componentCounts.get(r.id) ?? 0
                const routes = routeCounts.get(r.id) ?? 0
                const badge = LSX_BADGE[r.status] ?? {
                  label: r.status,
                  tone: 'gray' as const,
                }
                return (
                  <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`${base}/${r.id}`}
                        className="font-mono font-medium text-sky-600 hover:underline dark:text-sky-400"
                      >
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs text-zinc-400">
                        {r.order_code}
                      </div>
                      <div className="truncate">{r.customer_name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {comps > 0 ? (
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {comps} dòng chi tiết
                        </span>
                      ) : (
                        <Badge tone="amber">Chưa nhập</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const total = lineCounts.get(r.sales_order_id) ?? 0
                        if (routes === 0) return <Badge tone="amber">Chưa chốt</Badge>
                        if (total > 0 && routes < total)
                          return (
                            <Badge tone="amber">
                              Đã chốt {routes}/{total} SP
                            </Badge>
                          )
                        return (
                          <Badge tone="green">
                            Đã chốt {total > 0 ? `${routes}/${total}` : routes} SP
                          </Badge>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-zinc-400">
          Bạn đang xem — định hình là việc của phòng Kế hoạch - Cung ứng / Ban quản lý.
        </p>
      )}
    </div>
  )
}
