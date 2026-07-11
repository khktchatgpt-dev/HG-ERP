import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import { LsxDetailView } from '@/components/production/LsxDetailView'

/**
 * Chi tiết LSX cho XƯỞNG (plan-production-workspace P2): tái dùng LsxDetailView
 * — chỉ thao tác tiến độ (cập nhật giai đoạn / nhận vật tư / hoàn thành).
 * Không duyệt (GĐ làm ở /exec), không sửa spec (Sales làm ở /sales/lsx).
 * Layout đã gate admin/manager/xưởng; canManage khớp canTrackProgress ở service.
 */
export default async function ProductionLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params

  let data
  try {
    data = await productionService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx, progress } = data

  const [lines, stages] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    productionRepo.listStages(),
  ])

  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* ignore */
      }
    }),
  )

  return (
    <LsxDetailView
      lsx={{
        id: lsx.id,
        code: lsx.code,
        status: lsx.status,
        order_id: lsx.sales_order_id,
        order_code: lsx.order_code,
        customer_name: lsx.customer_name,
        current_stage: lsx.current_stage,
        ship_date: lsx.ship_date,
        received_date: lsx.received_date,
        completed_at: lsx.completed_at,
        approved_at: lsx.approved_at,
        rejected_reason: lsx.rejected_reason,
        container_summary: lsx.container_summary,
        note: lsx.note,
        created_at: lsx.created_at,
      }}
      lines={lines.map((l) => ({
        order_line_id: l.order_line_id,
        product_code: l.product_code,
        name_vi: l.name_vi,
        unit: l.unit,
        qty: l.qty,
        image_url: l.image_file_id ? (imageUrls.get(l.image_file_id) ?? null) : null,
        spec: {
          machine: l.tech_spec.machine ?? '',
          cushion: l.tech_spec.cushion ?? '',
          paint: l.tech_spec.paint ?? '',
          glass: l.tech_spec.glass ?? '',
          wood: l.tech_spec.wood ?? '',
        },
      }))}
      progress={progress.map((p) => ({
        id: p.id,
        stage: p.stage,
        action: p.action,
        note: p.note,
        by: p.updated_by_name,
        at: p.created_at,
      }))}
      stages={stages}
      canApprove={false}
      canManage
      canEditSpec={false}
      // Xưởng XEM bảng chi tiết (biết phải làm gì) — nhập là việc của Kế hoạch.
      canEditComponents={false}
      breadcrumbs={[
        { label: 'Sản xuất', href: '/production' },
        { label: `LSX ${lsx.code}` },
      ]}
    />
  )
}
