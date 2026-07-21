import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionService } from '@/modules/dept/production/production.service'
import { listLsxPrintLines } from '@/modules/dept/production/production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { filesService } from '@/modules/core/files/files.service'
import { poLineAmount } from '@/lib/po-line'
import { ApprovalsManager } from '../ApprovalsManager'

/**
 * Màn phê duyệt tập trung (FR-ADM-03): duyệt Lệnh sản xuất (FR-SAL-06) +
 * đơn đặt vật tư (BR-05). Báo giá bán KHÔNG qua đây — hồ sơ riêng của Sales.
 * (Dời từ /exec về đây 07/2026 — /exec giờ là Toàn cảnh điều hành.)
 */
export default async function ExecApprovalsPage() {
  const user = (await authService.currentUser())!

  const [{ rows: pendingPos }, { rows: pendingLsx }] = await Promise.all([
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
    productionService.list(user, {
      status: 'pending_approval',
      page: 1,
      page_size: 200,
    }),
  ])

  // GĐ cần PHÂN TÍCH trước khi duyệt, nên nạp sẵn dòng phiếu server-side:
  //  • PO: dòng vật tư (tính tiền qua poLineAmount — nguồn chuẩn, đúng cả đv2).
  //  • LSX: dòng SP của đơn (đơn giá bán + BOM từ orderLines) hoà với ảnh +
  //    thông số kỹ thuật (tech_spec) từ listLsxPrintLines — cùng nguồn/nhìn với
  //    hồ sơ LSX đầy đủ (tab Thông số SX).
  // + tên người lập (PO.created_by / LSX.issued_by) để GĐ biết ai gửi phiếu.
  const [poEnrich, lsxEnrich, creatorNames] = await Promise.all([
    Promise.all(
      pendingPos.map(async (p) => {
        const lines = await posRepo.listLines(p.id)
        return {
          id: p.id,
          lines,
          total: lines.reduce((s, l) => s + poLineAmount(l), 0),
        }
      }),
    ),
    Promise.all(
      pendingLsx.map(async (l) => {
        const [orderLines, printLines, order] = await Promise.all([
          ordersRepo.listLines(l.sales_order_id),
          listLsxPrintLines(l.id, l.sales_order_id),
          ordersRepo.findById(l.sales_order_id),
        ])
        return {
          id: l.id,
          printLines,
          order,
          bomByLineId: new Map(orderLines.map((ol) => [ol.id, ol])),
          order_value: orderLines.reduce((s, ol) => s + ol.qty * ol.unit_price, 0),
          bom_pending: orderLines.filter((ol) => ol.bom_status !== 'done').length,
        }
      }),
    ),
    usersRepo.displayNamesByIds(
      [
        ...pendingPos.map((p) => p.created_by),
        ...pendingLsx.map((l) => l.issued_by),
      ].filter((x): x is string => !!x),
    ),
  ])
  const poById = new Map(poEnrich.map((t) => [t.id, t]))
  const lsxById = new Map(lsxEnrich.map((t) => [t.id, t]))

  // Tên người phụ trách đơn (order.created_by) cho khối "Thông tin đơn hàng".
  const ownerNames = await usersRepo.displayNamesByIds(
    lsxEnrich.map((e) => e.order?.created_by).filter((x): x is string => !!x),
  )

  // Ảnh SP: ký URL 1 lượt cho mọi dòng LSX (lỗi ảnh không chặn duyệt).
  const lsxFileIds = [
    ...new Set(
      lsxEnrich.flatMap((e) =>
        e.printLines.map((pl) => pl.image_file_id).filter((x): x is string => !!x),
      ),
    ),
  ]
  let imageUrls: Record<string, string> = {}
  try {
    if (lsxFileIds.length)
      imageUrls = await filesService.getDownloadUrls(user, lsxFileIds)
  } catch {
    /* ảnh lỗi không chặn phê duyệt */
  }

  return (
    <ApprovalsManager
      pos={pendingPos.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        lsx_code: p.lsx_code,
        order_code: p.order_code,
        expected_at: p.expected_at,
        created_at: p.created_at,
        currency: p.currency,
        total: poById.get(p.id)?.total ?? 0,
        lines_count: poById.get(p.id)?.lines.length ?? 0,
        lines: poById.get(p.id)?.lines ?? [],
        created_by_name: p.created_by ? (creatorNames.get(p.created_by) ?? null) : null,
        note: p.note,
      }))}
      lsxs={pendingLsx.map((l) => {
        const e = lsxById.get(l.id)
        return {
          id: l.id,
          code: l.code,
          order_code: l.order_code,
          customer_name: l.customer_name,
          created_at: l.created_at,
          issued_by_name: l.issued_by ? (creatorNames.get(l.issued_by) ?? null) : null,
          ship_date: l.ship_date,
          container_summary: l.container_summary,
          note: l.note,
          received_date: l.received_date,
          order_value: e?.order_value ?? 0,
          bom_pending: e?.bom_pending ?? 0,
          order: e?.order
            ? {
                customer_po_no: e.order.customer_po_no,
                order_created_at: e.order.created_at,
                due_date: e.order.due_date,
                currency: e.order.currency,
                payment_terms: e.order.payment_terms,
                deposit_percent: e.order.deposit_percent,
                price_term: e.order.price_term,
                payment_method: e.order.payment_method,
                port_of_loading: e.order.port_of_loading,
                port_of_discharge: e.order.port_of_discharge,
                qty_tolerance_pct: e.order.qty_tolerance_pct,
                partial_shipment: e.order.partial_shipment,
                transhipment: e.order.transhipment,
                required_docs: e.order.required_docs,
                quote_code: e.order.quote_code,
                owner_name: e.order.created_by
                  ? (ownerNames.get(e.order.created_by) ?? null)
                  : null,
              }
            : null,
          lines: (e?.printLines ?? []).map((pl) => {
            const ol = e?.bomByLineId.get(pl.order_line_id)
            return {
              product_code: pl.product_code,
              product_name: pl.name_vi,
              product_unit: pl.unit,
              qty: pl.qty,
              unit_price: ol?.unit_price ?? 0,
              bom_status: ol?.bom_status ?? 'none',
              image_url: pl.image_file_id ? (imageUrls[pl.image_file_id] ?? null) : null,
              spec: {
                machine: pl.tech_spec.machine ?? '',
                cushion: pl.tech_spec.cushion ?? '',
                paint: pl.tech_spec.paint ?? '',
                glass: pl.tech_spec.glass ?? '',
                wood: pl.tech_spec.wood ?? '',
              },
            }
          }),
        }
      })}
    />
  )
}
