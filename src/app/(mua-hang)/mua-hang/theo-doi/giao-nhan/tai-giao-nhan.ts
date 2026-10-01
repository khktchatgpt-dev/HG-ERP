import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadReceiptBatches } from '@/modules/dept/supply/po-receipts.service'
import { poTrackingService } from '@/modules/dept/supply/po-tracking.service'
import { HttpError } from '@/server/http'

/**
 * NẠP HỘP GIAO NHẬN của một đơn (01/10/2026, bản vẽ H1 canvas "Cung ứng ·
 * Hàng về" › Bản 5) — mở trên Theo dõi đơn hàng bằng `?don=<id>`.
 *
 * KHÔNG TRUY VẤN MỚI: đúng các hàm trang chi tiết đơn dùng cho mục Giao & nhận
 * (`posService.detail` / `listShipments` / `shipmentReceipts`,
 * `loadReceiptBatches`, `poTrackingService.forPo`) — hai chỗ không thể đếm khác.
 * Quyền ghi cùng luật trang đơn: nhân sự Cung ứng VÀ (thao tác mọi đơn HOẶC
 * người phụ trách đơn).
 *
 * Trả `null` khi đơn không tồn tại — màn Theo dõi bỏ qua tham số hỏng thay vì
 * vỡ cả trang.
 */
export async function taiGiaoNhan(user: User, poId: string) {
  let detail
  try {
    detail = await posService.detail(user, poId)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null
    throw e
  }
  const { po, lines, status_lines, warehouse_docs } = detail
  const [
    isSupply,
    manageAny,
    canIssue,
    canReceive,
    shipments,
    shipmentReceipts,
    batches,
    tracking,
  ] = await Promise.all([
    user.role === 'admin' ? Promise.resolve(true) : isSupplyStaff(user),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'supply.po.manage_any'),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'supply.po_issue.manage'),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    posService.listShipments(user, po.id),
    posService.shipmentReceipts(user, po.id),
    loadReceiptBatches([po.id]).then((r) => r[po.id] ?? []),
    poTrackingService.forPo(user, po.id),
  ])
  return {
    po: {
      id: po.id,
      code: po.code,
      status: po.status as string,
      supplier_name: po.supplier_name,
      lsx_code: po.lsx_code,
      expected_at: po.expected_at,
      confirmed_at: po.confirmed_at ?? null,
      confirmed_note: po.confirmed_note ?? null,
      currency: po.currency,
      assignee_name: po.assignee_name ?? null,
    },
    lines: lines.flatMap((l) =>
      l.id
        ? [
            {
              id: l.id,
              material_id: l.material_id,
              code: l.material_code || null,
              name: l.material_name,
              unit: l.material_unit,
              qty_ordered: Number(l.qty_ordered),
            },
          ]
        : [],
    ),
    statusLines: status_lines.map((s) => ({
      id: s.id,
      material_id: s.material_id,
      qty_received: Number(s.qty_received ?? 0),
      qty_missing: Number(s.qty_missing ?? 0),
      qty_open: Number(s.qty_open ?? 0),
      closed_short_at: s.closed_short_at,
    })),
    shipments: shipments.map((s) => ({
      id: s.id,
      code: s.code ?? null,
      seq: s.seq,
      expected_date: s.expected_date,
      status: s.status,
      note: s.note,
      lines: s.lines,
    })),
    shipmentReceipts,
    receiptBatches: batches,
    warehouseDocs: warehouse_docs,
    issues: tracking.issues,
    canEdit:
      isSupply && (manageAny || (po.assigned_to != null && po.assigned_to === user.id)),
    canIssue,
    canReceive,
  }
}

export type GiaoNhanData = NonNullable<Awaited<ReturnType<typeof taiGiaoNhan>>>
