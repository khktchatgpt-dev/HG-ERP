import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify luồng duyệt đơn đặt vật tư (BR-05, FR-ADM-03).
 * Đăng ký 1 lần ở boot (xem `src/events/register.ts`).
 */
export function registerPoNotificationHandlers(): void {
  on('po.submitted', async (e) => {
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'po_submitted',
          payload: { title: `${e.code} — ${e.supplier_name} (LSX ${e.lsx_code})` },
        }),
      ),
    )
  })

  on('po.decided', async (e) => {
    if (!e.created_by || e.created_by === e.decided_by) return
    await notificationsService.notify({
      recipientId: e.created_by,
      actorId: e.decided_by,
      type: e.decision === 'approved' ? 'po_approved' : 'po_rejected',
      payload: { title: e.code, reason: e.reason },
    })
  })
}
