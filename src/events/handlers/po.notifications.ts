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

  // Báo kết quả cho NGƯỜI PHỤ TRÁCH đơn (0128), không phải người tạo: đơn đã
  // bàn giao thì người tạo cũ chẳng còn làm gì với nó nữa.
  on('po.decided', async (e) => {
    if (!e.owner_id || e.owner_id === e.decided_by) return
    await notificationsService.notify({
      recipientId: e.owner_id,
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

  // Chốt PHẦN THIẾU (0154): báo Kho ngừng chờ lô này + GĐ/QL nắm.
  on('po.closed_short', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.closed_by,
          type: 'po_closed_short',
          payload: { title: `${e.code} — ${e.summary}: ${e.reason}` },
        }),
      ),
    )
  })
}
