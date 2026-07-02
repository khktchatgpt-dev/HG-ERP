import { notificationsRepo, type NotificationType } from '@/modules/core/notifications/notifications.repo'
import type { User } from '@/modules/core/users/users.repo'

export const notificationsService = {
  async notify(args: {
    recipientId: string
    actorId: string
    taskId?: string
    type: NotificationType
    payload?: Record<string, unknown>
  }) {
    return notificationsRepo.insert({
      user_id: args.recipientId,
      actor_id: args.actorId,
      task_id: args.taskId ?? null,
      type: args.type,
      payload: args.payload,
    })
  },

  async listMine(user: User, opts: { unreadOnly?: boolean } = {}) {
    return notificationsRepo.listForUser(user.id, opts)
  },

  async unreadCount(user: User) {
    return notificationsRepo.countUnread(user.id)
  },

  async markRead(user: User, id: string) {
    await notificationsRepo.markRead(id, user.id)
  },

  async markAllRead(user: User) {
    await notificationsRepo.markAllRead(user.id)
  },
}
