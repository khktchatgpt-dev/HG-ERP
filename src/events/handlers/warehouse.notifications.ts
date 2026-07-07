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
