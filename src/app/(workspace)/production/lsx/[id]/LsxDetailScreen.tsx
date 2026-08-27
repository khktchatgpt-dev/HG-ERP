import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { colKey, specColumnsOf } from '@/modules/dept/sales/lsx-template'
import { shipText } from '@/modules/dept/production/lsx-sheet-cells'
import { entriesService } from '@/modules/dept/production/entries.service'
import { isProductionStaff, canManagePlan } from '@/modules/dept/production/perms'
import { canAction } from '@/modules/core/rbac/rbac.service'
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
  variant: 'production' | 'exec' | 'planning' | 'team' | 'prodplan'
}) {
  const user = await authService.requirePageUser()

  let data
  try {
    data = await lsxService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx, jobs } = data

  const [sheet, stages, summary] = await Promise.all([
    lsxLinesService.sheet(user, id),
    productionRepo.listStages(),
    // Tổng hợp số liệu — lỗi không làm sập trang.
    entriesService.summary(user, id).catch(() => null),
  ])
  const groupTitle = new Map(sheet.groups.map((g) => [g.id, g.title ?? '']))
  const sheetLines = sheet.groups.flatMap((g) => g.lines)

  // Cung ứng / vật tư — shell GĐ + Kế hoạch thấy đủ (kèm tiền = cam kết chi);
  // shell XƯỞNG (GĐ1 plan-sx): quản đốc thấy PO + trạng thái + ngày về nhưng
  // KHÔNG thấy tiền, KHÔNG có nút chốt lại định mức.
  let supply: SupplyPanelData | null = null
  if (variant === 'exec' || variant === 'planning' || variant === 'production') {
    const showMoney = variant !== 'production'
    const { rows: poRows } = await posService.list(user, {
      production_order_id: id,
      page: 1,
      page_size: 100,
    })
    const totals = showMoney ? await posRepo.totalsByPoIds(poRows.map((p) => p.id)) : {}
    const [bomSnapshot, canResnapBom] = await Promise.all([
      lsxService.bomSnapshotInfo(user, id),
      showMoney ? canAction(user, 'production.lsx.bom_resnap') : Promise.resolve(false),
    ])
    supply = {
      hasBom: (summary?.components.length ?? 0) > 0,
      bomSnapshot,
      canResnapBom,
      showMoney,
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
    [...new Set(sheetLines.map((l) => l.image_file_id).filter(Boolean))].map(
      async (fid) => {
        try {
          imageUrls.set(
            fid as string,
            await filesService.getDownloadUrl(user, fid as string),
          )
        } catch {
          /* ignore */
        }
      },
    ),
  )

  // Quyền theo shell — khớp guard service; UI không hứa thứ server sẽ từ chối.
  const isMgr = user.role === 'admin' || user.role === 'manager'
  const isProd = await isProductionStaff(user)
  const canPlan = await canManagePlan(user)
  const flags = {
    production: {
      canApprove: false, // GĐ duyệt ở /exec
      canManage: isMgr || isProd,
      planHref: canPlan ? `/kehoach-sx/${id}` : null,
      // Màn định hình nằm trong khu /thongke đã xoá 26/08/2026.
      shapingHref: null,
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
      breadcrumbs: [{ label: 'Tổ sản xuất', href: '/to' }, { label: `LSX ${lsx.code}` }],
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
      shapingHref: null,
      breadcrumbs: [
        { label: 'Cung ứng', href: '/planning' },
        { label: `LSX ${lsx.code}` },
      ],
    },
  }[variant]

  // Người LẬP lệnh (0119) — null với lệnh nhập bằng script trước khi có cột này.
  const creator = lsx.created_by ? await usersRepo.findById(lsx.created_by) : null

  return (
    <LsxDetailView
      lsx={{
        id: lsx.id,
        code: lsx.code,
        status: lsx.status,
        orders: lsx.order_ids.map((oid, i) => ({ id: oid, code: lsx.order_codes[i] })),
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
        created_by_name: creator?.name ?? null,
      }}
      lines={sheetLines.map((l) => ({
        order_line_id: l.id,
        group_title: groupTitle.get(l.group_id) ?? '',
        product_code: l.product_code,
        name_vi: l.name_vi ?? l.product_code,
        unit: l.unit,
        qty: l.qty,
        // Đợt xuất là NGÀY (07/08/2026) — dùng chung `shipText` với phiếu in
        // và file Excel để ba nơi hiện y hệt nhau, không mỗi chỗ một kiểu.
        ship_text: shipText(l),
        image_url: l.image_file_id ? (imageUrls.get(l.image_file_id) ?? null) : null,
        spec: l.specs,
      }))}
      specColumns={specColumnsOf(sheet.template).map((c) => ({
        key: colKey(c),
        label: c.label,
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
