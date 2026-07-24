import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { entriesService } from '@/modules/dept/production/entries.service'
import {
  isProductionStaff,
  canManagePlan,
  canEditComponents,
} from '@/modules/dept/production/perms'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import {
  LsxDetailView,
  type SupplyPanelData,
} from '@/components/production/LsxDetailView'

/**
 * Màn HỒ SƠ LỆNH dùng chung 3 shell — "mỗi bộ phận một màn riêng":
 *   production  /production/lsx/[id]  — xưởng theo dõi (kế hoạch/jobs + số liệu)
 *   exec        /exec/lsx/[id]        — GĐ thẩm định + DUYỆT ngay trong shell GĐ
 *   planning    /planning/lsx/[id]    — Kế hoạch/Cung ứng tra cứu (+ panel PO)
 * Bản của Sales (/sales/lsx) vẫn riêng vì có sửa spec + gửi duyệt lại.
 */
export async function LsxDetailScreen({
  id,
  variant,
}: {
  id: string
  variant: 'production' | 'exec' | 'planning' | 'team' | 'stat' | 'prodplan'
}) {
  const user = (await authService.currentUser())!

  let data
  try {
    data = await lsxService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx, jobs } = data

  const [lines, stages, summary] = await Promise.all([
    listLsxPrintLines(id, lsx.sales_order_id),
    productionRepo.listStages(),
    // Tổng hợp số liệu — lỗi không làm sập trang.
    entriesService.summary(user, id).catch(() => null),
  ])

  // Cung ứng / vật tư — CHỈ shell GĐ + Kế hoạch (PO có tiền = cam kết chi).
  let supply: SupplyPanelData | null = null
  if (variant === 'exec' || variant === 'planning') {
    const { rows: poRows } = await posService.list(user, {
      production_order_id: id,
      page: 1,
      page_size: 100,
    })
    const totals = await posRepo.totalsByPoIds(poRows.map((p) => p.id))
    supply = {
      hasBom: (summary?.components.length ?? 0) > 0,
      pos: poRows.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        status: p.status,
        expected_at: p.expected_at,
        total: totals[p.id] ?? 0,
        currency: p.currency,
      })),
    }
  }

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

  // Quyền theo shell — khớp guard service; UI không hứa thứ server sẽ từ chối.
  const isMgr = user.role === 'admin' || user.role === 'manager'
  const isProd = await isProductionStaff(user)
  const canPlan = await canManagePlan(user)
  const canShape = await canEditComponents(user)
  const flags = {
    production: {
      canApprove: false, // GĐ duyệt ở /exec
      canManage: isMgr || isProd,
      planHref: canPlan ? `/kehoach-sx/${id}` : null,
      shapingHref: canShape ? `/thongke/dinh-hinh/${id}` : null,
      breadcrumbs: [
        { label: 'Sản xuất', href: '/production' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    // 3 shell gia đình SX (mỗi vai một workspace — 07/2026).
    team: {
      canApprove: false,
      canManage: isMgr || isProd,
      planHref: null,
      shapingHref: null,
      breadcrumbs: [
        { label: 'Tổ sản xuất', href: '/to' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    stat: {
      canApprove: false,
      canManage: isMgr || isProd,
      planHref: null,
      shapingHref: canShape ? `/thongke/dinh-hinh/${id}` : null,
      breadcrumbs: [
        { label: 'Thống kê xưởng', href: '/thongke' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    prodplan: {
      canApprove: false,
      canManage: isMgr,
      planHref: canPlan ? `/kehoach-sx/${id}` : null,
      shapingHref: null,
      breadcrumbs: [
        { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    exec: {
      canApprove: isMgr,
      canManage: isMgr,
      planHref: null,
      shapingHref: null,
      breadcrumbs: [
        { label: 'Ban Giám đốc', href: '/exec' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    planning: {
      canApprove: false,
      canManage: user.role === 'admin',
      planHref: canPlan ? `/kehoach-sx/${id}` : null,
      shapingHref: canShape ? `/thongke/dinh-hinh/${id}` : null,
      breadcrumbs: [
        { label: 'Kế hoạch - Cung ứng', href: '/planning' },
        { label: `LSX ${lsx.code}` },
      ],
    },
  }[variant]

  return (
    <LsxDetailView
      lsx={{
        id: lsx.id,
        code: lsx.code,
        status: lsx.status,
        order_id: lsx.sales_order_id,
        order_code: lsx.order_code,
        customer_name: lsx.customer_name,
        priority: lsx.priority,
        ship_date: lsx.ship_date,
        received_date: lsx.received_date,
        completed_at: lsx.completed_at,
        approved_at: lsx.approved_at,
        rejected_reason: lsx.rejected_reason,
        materials_received_at: lsx.materials_received_at,
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
      jobs={jobs}
      stages={stages}
      components={summary?.components ?? []}
      synced={summary?.synced_by_line ?? []}
      supply={supply}
      breadcrumbs={flags.breadcrumbs}
      canApprove={flags.canApprove}
      canManage={flags.canManage}
      planHref={flags.planHref}
      shapingHref={flags.shapingHref}
    />
  )
}
