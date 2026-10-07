import { notFound } from 'next/navigation'
import { canMutateOwned } from '@/lib/record-ownership'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { jobsRepo } from '@/modules/dept/production/jobs.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { HttpError } from '@/server/http'
import { fileImageSrc } from '@/server/file-image'
import { DonHangScreen } from './DonHangScreen'
import type { CancelImpact, ChangeView } from './don-hang.shared'

/**
 * Chi tiết đơn bán (khuôn D · Chứng từ, kiểu ERP — 07/10/2026). Gác quyền + tải
 * dữ liệu song song; chỉ truyền xuống thứ màn cần.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  let data
  try {
    data = await ordersService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { order, lines, changes, shipments, shippedByLine } = data

  // Mọi cờ đi qua RBAC — cùng cửa với service, nút nào hiện thì bấm được.
  // Sửa/huỷ: quyền quản lý đơn VÀ là người tạo đơn (quản lý gánh mọi đơn).
  const [canManage, canIssue, canShip, canDeliver, lsx, owner] = await Promise.all([
    canAction(user, 'sales.order.manage'),
    canAction(user, 'production.lsx.issue'),
    canAction(user, 'sales.order.ship'),
    canAction(user, 'sales.order.confirm_delivery'),
    productionRepo.findByOrder(order.id),
    order.created_by ? usersRepo.findById(order.created_by) : null,
  ])
  const canEdit = canManage && canMutateOwned(user, order.created_by)

  // Đơn cùng khách chưa có lệnh — Sale tick để gộp chung một lệnh (0113).
  const mergeCandidates =
    canIssue && order.status === 'confirmed' && !lsx
      ? (await ordersRepo.listMergeCandidates(order.customer_id)).filter(
          (o) => o.id !== order.id,
        )
      : []
  const [mergeLineCounts, jobs] = await Promise.all([
    productionRepo.linesCountByOrder(mergeCandidates.map((o) => o.id)),
    lsx ? jobsRepo.listByLsx(lsx.id) : Promise.resolve([]),
  ])

  // Hệ quả nếu huỷ đơn — khối huỷ nói thật thay vì câu chung chung.
  let cancelImpact: CancelImpact | null = null
  if (lsx && order.status !== 'delivered' && order.status !== 'cancelled') {
    const { rows: pos } = await posRepo.list({
      production_order_id: lsx.id,
      page: 1,
      page_size: 200,
    })
    const lsxShared = lsx.order_ids.some((oid) => oid !== order.id)
    cancelImpact = {
      lsx_active: ['pending_approval', 'approved', 'in_progress'].includes(lsx.status),
      lsx_shared: lsxShared,
      pos_auto: lsxShared
        ? []
        : pos
            .filter((p) => p.status === 'pending_approval' || p.status === 'approved')
            .map((p) => p.code),
      pos_manual: lsxShared
        ? []
        : pos
            .filter((p) =>
              ['ordered', 'confirmed', 'in_transit', 'partial'].includes(p.status),
            )
            .map((p) => p.code),
    }
  }

  return (
    <DonHangScreen
      order={{
        id: order.id,
        code: order.code,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        quote_code: order.quote_code,
        customer_po_no: order.customer_po_no,
        status: order.status,
        currency: order.currency,
        fx_rate: order.fx_rate,
        fx_date: order.fx_date,
        due_date: order.due_date,
        deposit_percent: order.deposit_percent,
        price_term: order.price_term,
        payment_terms: order.payment_terms,
        payment_method: order.payment_method,
        qty_tolerance_pct: order.qty_tolerance_pct,
        partial_shipment: order.partial_shipment,
        transhipment: order.transhipment,
        port_of_loading: order.port_of_loading,
        port_of_discharge: order.port_of_discharge,
        required_docs: order.required_docs,
        container_summary: order.container_summary,
        note: order.note,
        owner_name: owner?.name ?? null,
        created_at: order.created_at,
      }}
      lines={lines.map((l) => ({
        id: l.id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        customer_item_code: l.customer_item_code,
        barcode: l.barcode,
        bom_status: l.bom_status,
        image_url: l.image_file_id ? fileImageSrc(l.image_file_id) : null,
        qty: l.qty,
        unit_price: l.unit_price,
        ship_date: l.ship_date,
        shipped: shippedByLine[l.id] ?? 0,
        note: l.note,
      }))}
      shipments={shipments.map((s) => ({
        id: s.id,
        order_line_id: s.order_line_id,
        qty: s.qty,
        shipped_at: s.shipped_at,
        note: s.note,
        created_by_name: s.created_by_name,
      }))}
      changes={changes.map((c) => ({
        id: c.id,
        changed_by_name: c.changed_by_name,
        change: c.change as ChangeView['change'],
        note: c.note,
        created_at: c.created_at,
      }))}
      lsx={
        lsx
          ? {
              id: lsx.id,
              code: lsx.code,
              status: lsx.status,
              issued_at: lsx.issued_at,
              approved_at: lsx.approved_at,
              completed_at: lsx.completed_at,
              rejected_reason: lsx.rejected_reason,
              ship_date: lsx.ship_date,
              materials_received_at: lsx.materials_received_at,
              jobs_done: jobs.filter((j) => j.status === 'done').length,
              jobs_total: jobs.length,
              other_orders: lsx.order_ids
                .map((oid, i) => ({ id: oid, code: lsx.order_codes[i] ?? oid }))
                .filter((o) => o.id !== order.id),
            }
          : null
      }
      cancelImpact={cancelImpact}
      mergeCandidates={mergeCandidates.map((o) => ({
        id: o.id,
        code: o.code,
        due_date: o.due_date,
        line_count: mergeLineCounts.get(o.id) ?? 0,
      }))}
      canEdit={canEdit}
      canIssue={canIssue}
      canShip={canShip}
      canDeliver={canDeliver}
    />
  )
}
