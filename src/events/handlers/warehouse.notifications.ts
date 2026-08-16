import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify nghiệp vụ Kho: hàng về (phiếu nhập) + tồn dưới mức tối thiểu
 * (FR-WMS-08 — đề xuất mua gửi Cung ứng). Đăng ký 1 lần ở boot.
 */
export function registerWarehouseNotificationHandlers(): void {
  on('warehouse.receipt.created', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.created_by,
          type: 'wh_receipt',
          payload: { title: e.po_code ? `${e.code} (theo ${e.po_code})` : e.code },
        }),
      ),
    )
  })

  // Trả hàng NCC (⑤, 0080) — báo GĐ/QL: PO có thể quay lại partial chờ giao bù.
  on('warehouse.return.created', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.created_by,
          type: 'wh_return',
          payload: { title: `${e.code} — trả hàng NCC theo ${e.po_code}: ${e.reason}` },
        }),
      ),
    )
  })

  // Phiếu đảo (0161/K1): sổ vừa lùi một phiếu — quản lý Kho (+ owner đơn) phải biết.
  on('warehouse.doc.reversed', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.reversed_by,
          type: 'wh_doc_reversed',
          payload: { title: `${e.reversal_code} đảo ${e.original_code}: ${e.reason}` },
        }),
      ),
    )
  })

  // Vòng duyệt kiểm kê (0157): lập → báo người duyệt; duyệt/từ chối → báo người lập.
  on('warehouse.stocktake.pending', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.created_by,
          type: 'wh_stocktake_pending',
          payload: { title: `${e.code} — biên bản kiểm kê chờ duyệt` },
        }),
      ),
    )
  })

  on('warehouse.stocktake.decided', async (e) => {
    await notificationsService.notify({
      recipientId: e.recipient_id,
      actorId: e.decided_by,
      type: e.decision === 'approved' ? 'wh_stocktake_approved' : 'wh_stocktake_rejected',
      payload: {
        title: e.reason ? `${e.code}: ${e.reason}` : e.code,
      },
    })
  })

  on('warehouse.stock.low', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.caused_by,
          type: 'wh_stock_low',
          payload: {
            title: `${e.material_code} — ${e.material_name}: còn ${e.on_hand} (min ${e.min_stock})`,
          },
        }),
      ),
    )
  })
}
