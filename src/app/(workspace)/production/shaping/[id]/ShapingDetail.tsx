import { notFound } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { canEditComponents } from '@/modules/dept/production/components.service'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { HttpError } from '@/server/http'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { LsxComponentsPanel } from '@/components/production/LsxComponentsPanel'
import { LsxRoutePanel } from '@/components/production/LsxRoutePanel'

/**
 * Màn định hình 1 lệnh: (1) lộ trình giai đoạn per SP, (2) bảng chi tiết
 * cụm → chi tiết → định mức. QL Kế hoạch sửa; người khác xem. Sau khi định
 * hình xong, xưởng nhập sản lượng ở /production/lsx/[id] — sổ chỉ nhận giai
 * đoạn thuộc lộ trình đã chốt.
 *
 * Tách khỏi page.tsx để tham số hoá `base` + `rootCrumb` — hiện chỉ shell Sản
 * xuất dùng (user chốt Cung ứng không mang giao diện sản xuất).
 */
export async function ShapingDetail({
  id,
  base,
  rootCrumb,
}: {
  id: string
  base: string
  rootCrumb: { label: string; href: string }
}) {
  const user = (await authService.currentUser())!
  const canEdit = await canEditComponents(user)

  let data
  try {
    data = await productionService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx } = data
  const locked = lsx.status === 'completed' || lsx.status === 'cancelled'

  // Vật tư nạp trực tiếp từ repo (read-only) cho grid — cùng lý do trang
  // /sales/lsx/[id]: API kho guard theo phòng Kho nên không gọi qua service.
  const [lines, stages, { rows: materials }] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    productionRepo.listStages(),
    materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          rootCrumb,
          { label: 'Định hình sản xuất', href: base },
          { label: lsx.code },
        ]}
        title={`Định hình — ${lsx.code}`}
        description={`${lsx.order_code} · ${lsx.customer_name ?? ''}`}
        actions={
          <Link
            href={`/production/lsx/${lsx.id}`}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Xem LSX đầy đủ
          </Link>
        }
      />

      {locked && (
        <div>
          <Badge tone="gray">LSX đã kết thúc — chỉ còn tra cứu</Badge>
        </div>
      )}

      <LsxRoutePanel
        lsxId={lsx.id}
        stages={stages}
        canEdit={canEdit}
        locked={locked}
        title="Bước 1 — Lộ trình giai đoạn"
      />

      <LsxComponentsPanel
        lsxId={lsx.id}
        orderLines={lines.map((l) => ({
          id: l.order_line_id,
          product_code: l.product_code,
          product_name: l.name_vi,
          qty: l.qty,
        }))}
        materials={materials.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          unit: m.unit,
        }))}
        stages={stages}
        canEdit={canEdit}
        locked={locked}
        title="Bước 2 — Bảng chi tiết & định mức"
      />
    </div>
  )
}
