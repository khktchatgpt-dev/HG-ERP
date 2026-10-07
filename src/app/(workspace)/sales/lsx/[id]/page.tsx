import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { canMutateOwned } from '@/lib/record-ownership'
import { usersRepo } from '@/modules/core/users/users.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { HttpError } from '@/server/http'
import { shipText } from '@/lib/lsx-sheet-cells'
import { lotShipText } from '@/lib/lsx-lots'
import { khoaSp, kiemKeHoach } from '@/lib/ke-hoach-xuat'
import { LenhScreen } from './LenhScreen'

/**
 * Chi tiết LỆNH SẢN XUẤT phía Sale (khuôn D, kiểu ERP — 07/10/2026). Gác quyền
 * qua RBAC + chủ lệnh; tải song song: lệnh (kèm vết + lô) · dòng · đơn · công
 * đoạn · đơn mua · ứng viên gộp. Đợt xuất của dòng đọc theo LÔ (D1).
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
  const { lsx, jobs, changes, lots } = data

  const [sheet, orders, canApprove, canIssue, creator, { rows: pos }] = await Promise.all(
    [
      lsxLinesService.sheet(user, id),
      ordersRepo.listByProductionOrder(id),
      canAction(user, 'production.lsx.approve'),
      canAction(user, 'production.lsx.issue'),
      lsx.created_by ? usersRepo.findById(lsx.created_by) : null,
      posRepo.list({ production_order_id: id, page: 1, page_size: 200 }),
    ],
  )
  const canOwn = canIssue && canMutateOwned(user, lsx.created_by)
  const orderIds = orders.map((o) => o.id)
  const [orderLines, shippedByOrder, mergeCandidates] = await Promise.all([
    ordersRepo.listLinesByOrders(orderIds),
    ordersRepo.shippedByOrderIds(orderIds),
    canOwn && !['completed', 'cancelled'].includes(lsx.status)
      ? ordersRepo.listMergeCandidates(lsx.customer_id)
      : Promise.resolve([]),
  ])
  const mergeLineCounts = await productionRepo.linesCountByOrder(
    mergeCandidates.map((o) => o.id),
  )
  const qtyByOrder = new Map<string, number>()
  for (const l of orderLines)
    qtyByOrder.set(l.order_id, (qtyByOrder.get(l.order_id) ?? 0) + l.qty)

  // Lô lệch lệnh? Cùng hàm màn chia đợt dùng (kiemKeHoach) — đọc là kiểm.
  const sps = new Map<string, { key: string; code: string; qty: number }>()
  for (const l of sheet.groups.flatMap((g) => g.lines)) {
    const k = khoaSp(l)
    const sp = sps.get(k) ?? { key: k, code: k, qty: 0 }
    sp.qty += l.qty
    sps.set(k, sp)
  }
  const kiem = kiemKeHoach(
    lots.map((l) => ({
      po_no: l.po_no,
      po_ref: l.po_ref,
      order_no: l.order_no,
      ship_date: l.ship_date,
      note: l.note,
      lines: l.lines,
    })),
    [...sps.values()],
  )
  const orderCodeById = new Map(orders.map((o) => [o.id, o.code]))

  return (
    <LenhScreen
      lsx={{
        id: lsx.id,
        code: lsx.code,
        status: lsx.status,
        customer_id: lsx.customer_id,
        customer_name: lsx.customer_name,
        priority: lsx.priority,
        revision: lsx.revision,
        revision_note: lsx.revision_note,
        revised_at: lsx.revised_at,
        ship_date: lsx.ship_date,
        received_date: lsx.received_date,
        container_summary: lsx.container_summary,
        note: lsx.note,
        issued_at: lsx.issued_at,
        approved_at: lsx.approved_at,
        completed_at: lsx.completed_at,
        rejected_reason: lsx.rejected_reason,
        materials_due_at: lsx.materials_due_at,
        materials_received_at: lsx.materials_received_at,
        created_at: lsx.created_at,
        updated_at: lsx.updated_at,
        created_by_name: creator?.name ?? null,
      }}
      orders={orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        customer_po_no: o.customer_po_no,
        due_date: o.due_date,
        qty: qtyByOrder.get(o.id) ?? 0,
        shipped: shippedByOrder[o.id] ?? 0,
      }))}
      groups={sheet.groups.map((g) => ({
        id: g.id,
        title: g.title ?? '',
        po_no: g.po_no,
        buyer_name: g.buyer_name,
        sales_order_code: g.sales_order_id
          ? (orderCodeById.get(g.sales_order_id) ?? null)
          : null,
        lines: g.lines.map((l) => ({
          id: l.id,
          group_id: l.group_id,
          product_id: l.product_id,
          product_code: l.product_code,
          customer_item_code: l.customer_item_code,
          name_vi: l.name_vi,
          unit: l.unit,
          qty: l.qty,
          cbm: l.cbm,
          ship_text:
            lotShipText(l.product_code, lots) ||
            shipText(l) ||
            (g.ship_date ? shipText(g) : ''),
          changed_in_rev: l.changed_in_rev,
          spec_summary: Object.values(l.specs ?? {})
            .filter(Boolean)
            .join(' · '),
          bom_missing: !l.product_id,
        })),
      }))}
      lots={lots.map((l) => ({
        id: l.id,
        seq: l.seq,
        po: l.po_ref || l.po_no,
        ship_date: l.ship_date,
        note: l.note,
        qty: l.lines.reduce((s, x) => s + x.qty, 0),
        lines: l.lines,
      }))}
      lotIssues={kiem.loi}
      lotLeft={lots.length ? kiem.conLai : {}}
      jobs={{ done: jobs.filter((j) => j.status === 'done').length, total: jobs.length }}
      changes={changes.map((c) => ({
        id: c.id,
        changed_by_name: c.changed_by_name,
        change: c.change,
        note: c.note,
        created_at: c.created_at,
      }))}
      pos={pos.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        supplier_name: p.supplier_name,
      }))}
      mergeCandidates={mergeCandidates.map((o) => ({
        id: o.id,
        code: o.code,
        line_count: mergeLineCounts.get(o.id) ?? 0,
      }))}
      canApprove={canApprove}
      canOwn={canOwn}
      canIssue={canIssue}
    />
  )
}
