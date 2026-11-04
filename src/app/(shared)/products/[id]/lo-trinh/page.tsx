import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { canEditBom, productsService } from '@/modules/dept/technical/technical.service'
import { resolveStageConfigs } from '@/lib/stage-config'
import { HttpError } from '@/server/http'
import { LoTrinhScreen } from './LoTrinhScreen'

/**
 * Tab LỘ TRÌNH (0288, B2 — docs/san-xuat-cau-hinh-thiet-ke.md, bản vẽ C2).
 *
 * Kỹ thuật — "SP này mỗi cụm đi qua công đoạn nào?" Ma trận cụm × công đoạn,
 * đánh x. Chi tiết rời theo nhóm vật tư, ghi đè được. Không kit; CSS riêng của
 * màn. Quyền sửa = quyền sửa định mức (`technical.bom.save`).
 */
export default async function ProductRoutesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  let data
  try {
    data = await productsService.getPartsInfo(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const [canEdit, catalog, routeSource] = await Promise.all([
    canEditBom(user),
    catalogsService.list(user, 'production_stage'),
    productsService.latestRouteSource(user, id),
  ])
  const stages = resolveStageConfigs(catalog.filter((s) => s.is_active))

  return (
    <LoTrinhScreen
      productId={id}
      productCode={data.product.code}
      productName={data.product.name}
      bomRev={data.product.bom_rev ?? null}
      locked={data.product.locked_at != null}
      clusters={data.clusters.map((c) => ({
        id: c.id,
        name: c.name,
        qty_per_product: c.qty_per_product,
        stages: c.stages ?? null,
      }))}
      parts={data.parts.map((p) => ({
        id: p.id,
        part_name: p.part_name,
        group_code: p.group_code,
        cluster_id: p.cluster_id,
        qty: p.qty,
        stages: p.stages ?? null,
      }))}
      groupLabels={Object.fromEntries(data.groups.map((g) => [g.code, g.label]))}
      stages={stages}
      // 04/11/2026 (bản vẽ gộp, câu 2): hồ sơ SP không còn là chỗ sửa lộ trình —
      // Kế hoạch khai trên lệnh, hồ sơ nhận theo. Tab này để Kỹ thuật tra cứu.
      canEdit={false}
      chiDoc={
        canEdit && data.product.locked_at == null
          ? 'Lộ trình cụm được khai trên lệnh đang chạy (Sản xuất › Lộ trình công đoạn), hồ sơ SP tự cập nhật theo.'
          : data.product.locked_at != null
            ? 'Hồ sơ đã khoá; lộ trình cụm khai trên lệnh đang chạy.'
            : 'Lộ trình cụm khai trên lệnh đang chạy (Sản xuất › Lộ trình công đoạn).'
      }
      routeSource={routeSource}
    />
  )
}
