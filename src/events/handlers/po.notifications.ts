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
          payload: {
            title: `${e.code} — ${e.supplier_name} ${e.lsx_code ? `(LSX ${e.lsx_code})` : '(ngoài LSX)'}`,
          },
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

  // Rút đơn về nháp (0128): báo người duyệt để họ khỏi xử lý bản đã rút.
  on('po.withdrawn', async (e) => {
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.withdrawn_by,
          type: 'po_withdrawn',
          payload: { title: e.code },
        }),
      ),
    )
  })

  // Bàn giao đơn (0128): báo người NHẬN phụ trách.
  on('po.reassigned', async (e) => {
    await notificationsService.notify({
      recipientId: e.to_user_id,
      actorId: e.reassigned_by,
      type: 'po_reassigned',
      payload: { title: e.code },
    })
  })
}
