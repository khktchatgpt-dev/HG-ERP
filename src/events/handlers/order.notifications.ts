import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify vòng đời đơn hàng sau khi phát LSX (plan-order-lsx-lifecycle P2/P3):
 *  - order.changed_after_lsx → Cung ứng + GĐ/QL (vật tư có thể đã đặt theo số cũ).
 *  - order.cancelled → Cung ứng + GĐ/QL (LSX/PO dừng theo; PO đã gửi NCC xử lý tay).
 */
export function registerOrderNotificationHandlers(): void {
  on('order.changed_after_lsx', async (e) => {
    const what = [
      e.lines_changed ? 'dòng SP' : null,
      e.changed_fields.includes('due_date') ? 'hạn giao' : null,
    ]
      .filter(Boolean)
      .join(' + ')
    await Promise.all(
      e.notify_ids
        .filter((id) => id !== e.changed_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.changed_by,
            type: 'order_changed',
            payload: {
              title: `${e.order_code} (LSX ${e.lsx_code}) — đổi ${what} sau khi phát LSX, kiểm tra vật tư & tiến độ`,
            },
          }),
        ),
    )
  })

  on('order.cancelled', async (e) => {
    const parts = [
      e.lsx_cancelled && e.lsx_code ? `LSX ${e.lsx_code} dừng` : null,
      e.pos_cancelled.length ? `tự huỷ PO: ${e.pos_cancelled.join(', ')}` : null,
      e.pos_manual.length
        ? `PO đã gửi NCC cần xử lý tay: ${e.pos_manual.join(', ')}`
        : null,
    ].filter(Boolean)
    await Promise.all(
      e.notify_ids
        .filter((id) => id !== e.cancelled_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.cancelled_by,
            type: 'order_cancelled',
            payload: {
              title: `${e.order_code} — ${e.reason}${parts.length ? ` · ${parts.join(' · ')}` : ''}`,
            },
          }),
        ),
    )
  })
}
