import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canMutateOwned } from '@/lib/record-ownership'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { colKey, specColumnsOf } from '@/modules/dept/sales/lsx-template'
import { shipText } from '@/modules/dept/production/lsx-sheet-cells'
import { entriesService } from '@/modules/dept/production/entries.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import { LsxDetailView } from '@/components/production/LsxDetailView'

/**
 * Trang chi tiết LSX của SALES: xem hồ sơ + GỬI DUYỆT LẠI khi bị từ chối
 * (sửa kèm header). Thao tác xưởng/kế hoạch nằm bên workspace Sản xuất.
 */
export default async function LsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  let data
  try {
    data = await lsxService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { lsx, jobs } = data

  const [sheet, stages, summary, dept] = await Promise.all([
    lsxLinesService.sheet(user, id),
    productionRepo.listStages(),
    entriesService.summary(user, id).catch(() => null),
    user.department_id ? departmentsRepo.findById(user.department_id) : null,
  ])
  const groupTitle = new Map(sheet.groups.map((g) => [g.id, g.title ?? '']))
  const sheetLines = sheet.groups.flatMap((g) => g.lines)

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

  const isMgr = user.role === 'admin' || user.role === 'manager'
  // Của ai người đó sửa (07/08/2026): sửa đầu lệnh / soạn dòng / gộp-gỡ đơn chỉ
  // dành cho NGƯỜI LẬP lệnh (quản lý gánh mọi lệnh). Duyệt/từ chối là việc của GĐ,
  // không đi qua cửa này.
  const isSales = user.role === 'admin' || dept?.name === 'Bán Hàng'
  const isOwner = isSales && canMutateOwned(user, lsx.created_by)

  // Người LẬP lệnh (0119) — null với lệnh nhập bằng script trước khi có cột này.
  const creator = lsx.created_by ? await usersRepo.findById(lsx.created_by) : null

  // Đơn cùng khách chưa thuộc lệnh nào — Sales gộp thêm vào lệnh này (0113).
  const ordersEditable = lsx.status !== 'completed' && lsx.status !== 'cancelled'
  const candidates =
    isSales && ordersEditable ? await ordersRepo.listMergeCandidates(lsx.customer_id) : []
  const candidateLineCounts = await productionRepo.linesCountByOrder(
    candidates.map((o) => o.id),
  )

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
      supply={null}
      breadcrumbs={[{ label: 'Bán hàng', href: '/sales' }, { label: `LSX ${lsx.code}` }]}
      canApprove={isMgr}
      canManage={isMgr}
      canResubmit={isOwner}
      canEditOrders={isOwner}
      linesHref={isOwner ? `/sales/lsx/${lsx.id}/dong` : null}
      mergeCandidates={candidates.map((o) => ({
        id: o.id,
        code: o.code,
        line_count: candidateLineCounts.get(o.id) ?? 0,
      }))}
    />
  )
}
