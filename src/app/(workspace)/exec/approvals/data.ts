import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { filesService } from '@/modules/core/files/files.service'
import { poLineAmount } from '@/lib/po-line'
import type { User } from '@/modules/core/users/users.repo'
import type { PendingLsx, PendingPo } from '../approval-types'

/**
 * Nạp CHI TIẾT 1 phiếu chờ duyệt (LSX/PO) cho trang riêng
 * /exec/approvals/{lsx,po}/[id]. Cùng phép làm giàu với danh sách phê duyệt
 * (page.tsx) nhưng cho một phiếu: chỉ trả về khi phiếu còn ở trạng thái
 * chờ duyệt (null → trang gọi notFound()).
 */

export async function loadPendingPoDetail(
  _user: User,
  id: string,
): Promise<PendingPo | null> {
  const po = await posRepo.findById(id)
  if (!po || po.status !== 'pending_approval') return null

  const [lines, creatorName] = await Promise.all([
    posRepo.listLines(id),
    po.created_by
      ? usersRepo
          .displayNamesByIds([po.created_by])
          .then((m) => m.get(po.created_by!) ?? null)
      : Promise.resolve(null),
  ])

  return {
    id: po.id,
    code: po.code,
    supplier_name: po.supplier_name,
    lsx_code: po.lsx_code,
    order_code: po.order_code,
    expected_at: po.expected_at,
    created_at: po.created_at,
    currency: po.currency,
    total: lines.reduce((s, l) => s + poLineAmount(l), 0),
    lines_count: lines.length,
    lines,
    created_by_name: creatorName,
    note: po.note,
  }
}

export async function loadPendingLsxDetail(
  user: User,
  id: string,
): Promise<PendingLsx | null> {
  const lsx = await productionRepo.findById(id)
  if (!lsx || lsx.status !== 'pending_approval') return null

  const [orderLines, printLines, orders, issuedByName] = await Promise.all([
    ordersRepo.listLinesByOrders(lsx.order_ids),
    lsxLinesRepo.listLines(lsx.id),
    ordersRepo.listByProductionOrder(lsx.id),
    lsx.issued_by
      ? usersRepo
          .displayNamesByIds([lsx.issued_by])
          .then((m) => m.get(lsx.issued_by!) ?? null)
      : Promise.resolve(null),
  ])
  // Dòng lệnh trỏ ngược về dòng đơn → lấy được đơn giá bán + trạng thái BOM.
  const bomByLineId = new Map(orderLines.map((ol) => [ol.id, ol]))
  const groupTitle = new Map(
    (await lsxLinesRepo.listGroups(lsx.id)).map((g) => [g.id, g.title ?? '']),
  )

  const fileIds = [
    ...new Set(printLines.map((pl) => pl.image_file_id).filter((x): x is string => !!x)),
  ]
  let imageUrls: Record<string, string> = {}
  try {
    if (fileIds.length) imageUrls = await filesService.getDownloadUrls(user, fileIds)
  } catch {
    /* ảnh lỗi không chặn duyệt */
  }

  // Lệnh gộp nhiều đơn: khối "thông tin thương mại" bám đơn đầu tiên (điều
  // khoản thường giống nhau vì cùng khách), còn `orders` liệt kê đủ cả nhóm.
  const order = orders[0] ?? null
  const ownerName = order?.created_by
    ? ((await usersRepo.displayNamesByIds([order.created_by])).get(order.created_by) ??
      null)
    : null
  const valueByOrder = new Map<string, number>()
  const linesByOrder = new Map<string, number>()
  for (const ol of orderLines) {
    valueByOrder.set(
      ol.order_id,
      (valueByOrder.get(ol.order_id) ?? 0) + ol.qty * ol.unit_price,
    )
    linesByOrder.set(ol.order_id, (linesByOrder.get(ol.order_id) ?? 0) + 1)
  }

  return {
    id: lsx.id,
    code: lsx.code,
    order_codes: lsx.order_codes,
    customer_name: lsx.customer_name,
    created_at: lsx.created_at,
    issued_by_name: issuedByName,
    ship_date: lsx.ship_date,
    container_summary: lsx.container_summary,
    note: lsx.note,
    received_date: lsx.received_date,
    order_value: orderLines.reduce((s, ol) => s + ol.qty * ol.unit_price, 0),
    bom_pending: orderLines.filter((ol) => ol.bom_status !== 'done').length,
    order: order
      ? {
          customer_po_no: order.customer_po_no,
          order_created_at: order.created_at,
          due_date: order.due_date,
          currency: order.currency,
          payment_terms: order.payment_terms,
          deposit_percent: order.deposit_percent,
          price_term: order.price_term,
          payment_method: order.payment_method,
          port_of_loading: order.port_of_loading,
          port_of_discharge: order.port_of_discharge,
          qty_tolerance_pct: order.qty_tolerance_pct,
          partial_shipment: order.partial_shipment,
          transhipment: order.transhipment,
          required_docs: order.required_docs,
          quote_code: order.quote_code,
          owner_name: ownerName,
        }
      : null,
    orders: orders.map((o) => ({
      code: o.code,
      due_date: o.due_date,
      currency: o.currency,
      value: valueByOrder.get(o.id) ?? 0,
      line_count: linesByOrder.get(o.id) ?? 0,
    })),
    lines: printLines.map((pl) => {
      const ol = pl.sales_order_line_id
        ? bomByLineId.get(pl.sales_order_line_id)
        : undefined
      return {
        order_code: groupTitle.get(pl.group_id) ?? '',
        product_code: pl.product_code,
        product_name: pl.name_vi ?? pl.product_code,
        product_unit: pl.unit,
        qty: pl.qty,
        unit_price: ol?.unit_price ?? 0,
        bom_status: ol?.bom_status ?? 'none',
        image_url: pl.image_file_id ? (imageUrls[pl.image_file_id] ?? null) : null,
        spec: pl.specs,
      }
    }),
  }
}
