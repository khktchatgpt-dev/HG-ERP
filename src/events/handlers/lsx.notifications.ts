import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify luồng duyệt Lệnh sản xuất (FR-SAL-06): Sales phát → GĐ duyệt.
 *  - lsx.submitted → báo GĐ (chờ duyệt).
 *  - lsx.decided (approved) → báo Cung ứng + Kỹ thuật (đặt vật tư / chuẩn bị BOM).
 *  - lsx.decided (rejected) → báo người phát (Sales).
 *  - lsx.orders.changed → lệnh đang chạy được gộp thêm/gỡ đơn (0113): báo Kế
 *    hoạch + Cung ứng + xưởng để soát lại việc và vật tư.
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
            title: `${e.code} — ${e.customer_name} (${e.order_codes.length > 1 ? `${e.order_codes.length} đơn: ` : 'đơn '}${e.order_codes.join(', ')})${bom}${resub}`,
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

  on('lsx.revised', async (e) => {
    await Promise.all(
      e.notify_ids
        .filter((id) => id !== e.revised_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.revised_by,
            type: 'lsx_revised',
            payload: {
              title: `${e.code} — bản chỉnh sửa lần ${e.revision}, ${e.changed_lines} dòng đổi (in lại phiếu)`,
              reason: e.note ?? undefined,
            },
          }),
        ),
    )
  })

  on('lsx.orders.changed', async (e) => {
    const parts = [
      e.added.length ? `gộp thêm ${e.added.join(', ')}` : '',
      e.removed.length ? `gỡ ${e.removed.join(', ')}` : '',
    ].filter(Boolean)
    await Promise.all(
      e.notify_ids
        .filter((id) => id !== e.changed_by)
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.changed_by,
            type: 'lsx_orders_changed',
            payload: { title: `${e.code} — ${parts.join(' · ')}` },
          }),
        ),
    )
  })
}
