import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify luồng duyệt báo giá (0149 — duyệt GĐ tuỳ chọn, Sale tự quyết trình).
 * Cùng khuôn với po.notifications. Đăng ký 1 lần ở boot (src/events/register.ts).
 */
export function registerQuoteNotificationHandlers(): void {
  on('quote.submitted', async (e) => {
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'quote_submitted',
          payload: {
            title: `${e.code} — ${e.customer_name}${e.resubmitted ? ' (trình lại)' : ''}`,
          },
        }),
      ),
    )
  })

  on('quote.decided', async (e) => {
    if (!e.owner_id || e.owner_id === e.decided_by) return
    await notificationsService.notify({
      recipientId: e.owner_id,
      actorId: e.decided_by,
      type: e.decision === 'approved' ? 'quote_approved' : 'quote_rejected',
      payload: { title: e.code, reason: e.reason },
    })
  })
}
