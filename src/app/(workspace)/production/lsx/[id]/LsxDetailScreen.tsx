import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  productionService,
  isProductionStaff,
} from '@/modules/dept/production/production.service'
import {
  productionRepo,
  listLsxPrintLines,
} from '@/modules/dept/production/production.repo'
import { routesService } from '@/modules/dept/production/routes.service'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { filesService } from '@/modules/core/files/files.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { stageForDept } from '@/lib/stage-for-dept'
import { HttpError } from '@/server/http'
import {
  LsxDetailView,
  type SupplyPanelData,
} from '@/components/production/LsxDetailView'

/**
 * Màn chi tiết LSX dùng chung cho 3 shell — "mỗi bộ phận một màn riêng" (user
 * chốt 07/2026), không nhảy sang giao diện Sales:
 *   production  /production/lsx/[id]  — xưởng thực thi (nhập sổ, tiến độ)
 *   exec        /exec/lsx/[id]        — GĐ thẩm định + DUYỆT ngay trong shell GĐ
 *   planning    /planning/lsx/[id]    — Cung ứng tra cứu (+ sửa bảng chi tiết
 *                                       nếu là vai Kế hoạch)
 * Bản của Sales (/sales/lsx) vẫn riêng vì có sửa spec + gửi duyệt lại.
 */
export async function LsxDetailScreen({
  id,
  variant,
}: {
  id: string
  variant: 'production' | 'exec' | 'planning'
}) {
  const user = (await authService.currentUser())!

  let data
  try {
    data = await productionService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx, progress } = data

  // Vật tư nạp trực tiếp từ repo (read-only) cho bảng chi tiết — API kho guard
  // theo phòng Kho nên không gọi qua service (cùng lý do /sales/lsx).
  const [lines, stages, dept, allowedByLine, { rows: materials }, summary] =
    await Promise.all([
      listLsxPrintLines(id, lsx.sales_order_id),
      productionRepo.listStages(),
      user.department_id ? departmentsRepo.findById(user.department_id) : null,
      routesService.allowedStagesByLine(id),
      materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
      // Tiến độ "bộ đồng bộ" cho tab Tổng quan — lỗi không làm sập trang.
      outputsService.summary(user, id).catch(() => null),
    ])
  const withComps = summary?.synced_by_line.filter((l) => l.has_components) ?? []
  const syncProgress = withComps.length
    ? {
        sets: withComps.reduce((a, l) => a + l.synced_sets, 0),
        qty: withComps.reduce((a, l) => a + l.qty, 0),
      }
    : null
  // Lọc select giai đoạn chỉ khi TẤT CẢ SP đã chốt lộ trình (0063).
  const lineIds = [...new Set(lines.map((l) => l.order_line_id))]
  const routeStages =
    lineIds.length > 0 && lineIds.every((lid) => allowedByLine.has(lid))
      ? [...new Set([...allowedByLine.values()].flatMap((s) => [...s]))]
      : null

  // Cung ứng / vật tư cho panel ở Tổng quan — CHỈ shell GĐ + Kế hoạch (PO có tiền
  // = cam kết chi; xưởng/Sales không xem). Đọc PO mở cho mọi NV nên không guard.
  let supply: SupplyPanelData | null = null
  if (variant === 'exec' || variant === 'planning') {
    const { rows: poRows } = await posService.list(user, {
      production_order_id: id,
      page: 1,
      page_size: 100,
    })
    const totals = await posRepo.totalsByPoIds(poRows.map((p) => p.id))
    supply = {
      hasBom: withComps.length > 0,
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

  // Quyền theo shell — khớp guard service (canTrackProgress/canRecordOutput/
  // canEditComponents); UI không hứa thứ server sẽ từ chối.
  const isMgr = user.role === 'admin' || user.role === 'manager'
  const isProd = await isProductionStaff(user)
  const flags = {
    production: {
      canApprove: false, // GĐ duyệt ở /exec
      canManage: isMgr || isProd,
      canRecord: user.role === 'admin' || isProd,
      canEditComponents: false, // xưởng xem; Kế hoạch sửa ở màn Định hình
      defaultStage: stageForDept(dept?.name ?? null, stages),
      breadcrumbs: [
        { label: 'Sản xuất', href: '/production' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    exec: {
      canApprove: isMgr,
      canManage: isMgr,
      canRecord: user.role === 'admin',
      // GĐ chỉ THẨM ĐỊNH + DUYỆT — không sửa chi tiết & lộ trình (việc của Kế
      // hoạch ở màn Định hình). Tab "Chi tiết & lộ trình" hiển thị read-only.
      canEditComponents: false,
      defaultStage: null,
      breadcrumbs: [
        { label: 'Ban Giám đốc', href: '/exec' },
        { label: `LSX ${lsx.code}` },
      ],
    },
    planning: {
      canApprove: false,
      canManage: user.role === 'admin',
      canRecord: user.role === 'admin',
      // Vai Kế hoạch sửa được bảng chi tiết ngay tại đây (cùng guard shaping).
      canEditComponents: await canEditComponents(user),
      defaultStage: null,
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
      canApprove={flags.canApprove}
      canManage={flags.canManage}
      canRecord={flags.canRecord}
      canEditSpec={false}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
      }))}
      canEditComponents={flags.canEditComponents}
      defaultStage={flags.defaultStage}
      routeStages={routeStages}
      syncProgress={syncProgress}
      supply={supply}
      breadcrumbs={flags.breadcrumbs}
    />
  )
}
