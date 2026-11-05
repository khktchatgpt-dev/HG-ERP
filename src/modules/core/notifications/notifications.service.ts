import {
  notificationsRepo,
  type NotificationType,
} from '@/modules/core/notifications/notifications.repo'
import type { User } from '@/modules/core/users/users.repo'
import { BELL_TYPES } from '@/lib/bell-types'

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

  // ── CHUÔNG — chỉ việc giao đích danh (05/11/2026, xem `lib/bell-types`) ──
  // Trang Thông báo (/notifications) vẫn dùng listMine / markAllRead đủ loại;
  // "Đánh dấu đã đọc" trên chuông chỉ tắt loại việc giao, không tắt lặng lẽ
  // hàng nghìn cảnh báo kho / đơn mua người dùng chưa từng mở.
  async listBell(user: User) {
    return notificationsRepo.listForUser(user.id, { types: BELL_TYPES, limit: 20 })
  },

  async unreadBellCount(user: User) {
    return notificationsRepo.countUnread(user.id, BELL_TYPES)
  },

  async markBellRead(user: User) {
    await notificationsRepo.markAllRead(user.id, BELL_TYPES)
  },
}
