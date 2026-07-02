import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Đăng ký handler notify cho các event liên quan task.
 * Gọi 1 lần ở boot (xem `src/events/register.ts`).
 */
export function registerTaskNotificationHandlers(): void {
  on('task.created', async (e) => {
    if (e.kind === 'self') return // self-task không cần notif
    await notificationsService.notify({
      recipientId: e.assignee_id,
      actorId: e.assigner_id,
      taskId: e.task_id,
      type: 'assigned',
      payload: { title: e.title },
    })
  })

  on('task.submitted', async (e) => {
    await notificationsService.notify({
      recipientId: e.assigner_id,
      actorId: e.submitted_by,
      taskId: e.task_id,
      type: 'submitted',
      payload: { title: e.title },
    })
  })

  on('task.approved', async (e) => {
    await notificationsService.notify({
      recipientId: e.assignee_id,
      actorId: e.approved_by,
      taskId: e.task_id,
      type: 'approved',
      payload: { title: e.title },
    })
  })

  on('task.rejected', async (e) => {
    await notificationsService.notify({
      recipientId: e.assignee_id,
      actorId: e.rejected_by,
      taskId: e.task_id,
      type: 'rejected',
      payload: { title: e.title, reason: e.reason },
    })
  })

  on('task.reassigned', async (e) => {
    await notificationsService.notify({
      recipientId: e.new_assignee_id,
      actorId: e.reassigned_by,
      taskId: e.task_id,
      type: 'reassigned',
      payload: { title: e.title },
    })
  })

  on('task.commented', async (e) => {
    // Fan-out cho mỗi recipient (skip actor — repo tự loại self-notify)
    await Promise.all(
      e.recipient_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.comment_by,
          taskId: e.task_id,
          type: 'commented',
          payload: { title: e.title, kind: e.comment_kind },
        }),
      ),
    )
  })

  on('task.status_changed', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.changed_by,
          taskId: e.task_id,
          type: 'status_changed',
          payload: {
            title: e.title,
            from: e.from_status,
            to: e.to_status,
          },
        }),
      ),
    )
  })
}
