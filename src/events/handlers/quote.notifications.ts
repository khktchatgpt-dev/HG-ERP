import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify cho luồng duyệt báo giá (FR-SAL-03).
 * Đăng ký 1 lần ở boot (xem `src/events/register.ts`).
 */
export function registerQuoteNotificationHandlers(): void {
  on('quote.submitted', async (e) => {
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'quote_submitted',
          payload: { title: `${e.code} — ${e.customer_name}` },
        }),
      ),
    )
  })

  on('quote.decided', async (e) => {
    if (!e.created_by || e.created_by === e.decided_by) return
    await notificationsService.notify({
      recipientId: e.created_by,
      actorId: e.decided_by,
      type: e.decision === 'approved' ? 'quote_approved' : 'quote_rejected',
      payload: { title: e.code, reason: e.reason },
    })
  })
}
