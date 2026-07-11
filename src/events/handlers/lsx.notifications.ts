import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify luồng duyệt Lệnh sản xuất (FR-SAL-06): Sales phát → GĐ duyệt.
 *  - lsx.submitted → báo GĐ (chờ duyệt).
 *  - lsx.decided (approved) → báo Cung ứng + Kỹ thuật (đặt vật tư / chuẩn bị BOM).
 *  - lsx.decided (rejected) → báo người phát (Sales).
 */
export function registerLsxNotificationHandlers(): void {
  on('lsx.submitted', async (e) => {
    const bom = e.lines_bom_pending > 0 ? ` · thiếu BOM ${e.lines_bom_pending} SP` : ''
    const resub = e.resubmitted ? ' · gửi duyệt lại' : ''
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'lsx_submitted',
          payload: {
            title: `${e.code} — ${e.customer_name} (đơn ${e.order_code})${bom}${resub}`,
          },
        }),
      ),
    )
  })

  on('lsx.decided', async (e) => {
    await Promise.all(
      e.notify_ids
        .filter((id) => id !== e.decided_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.decided_by,
            type: e.decision === 'approved' ? 'lsx_approved' : 'lsx_rejected',
            payload: { title: e.code, reason: e.reason },
          }),
        ),
    )
  })
}
