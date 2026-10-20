import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import type { NotificationType } from '@/modules/core/notifications/notifications.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { STATUS_LABEL, type FeedbackStatus } from '@/lib/feedback-labels'

/**
 * Thông báo cho GÓP Ý HỆ THỐNG. Mỗi thông báo mang `payload.href` = `/gop-y?id=`
 * để chuông mở đúng góp ý (chuông mặc định chỉ biết `task_id`). Tiền tố trong
 * tiêu đề giữ đúng bản gốc: `[Chặn việc]`, `[Chờ xác nhận]`, `[Cần chỉnh thêm]`.
 *
 * Lỗi ở đây được bus nuốt + log — không bao giờ làm hỏng việc lưu góp ý.
 */
export function registerFeedbackNotificationHandlers(): void {
  const href = (id: string) => `/gop-y?id=${id}`

  async function fanOut(
    recipientIds: string[],
    actorId: string,
    type: NotificationType,
    feedbackId: string,
    title: string,
  ) {
    const uniq = [...new Set(recipientIds)].filter((id) => id && id !== actorId)
    await Promise.all(
      uniq.map((recipientId) =>
        notificationsService.notify({
          recipientId,
          actorId,
          type,
          payload: { title, href: href(feedbackId), feedback_id: feedbackId },
        }),
      ),
    )
  }

  const nameOf = async (id: string) =>
    (await usersRepo.displayNamesByIds([id])).get(id) ?? 'Ai đó'

  on('feedback.created', async (e) => {
    const author = await nameOf(e.actor_id)
    const prefix = e.gate ? '[Chờ xác nhận] ' : e.severity === 'blocking' ? '[Chặn việc] ' : ''
    await fanOut(e.recipient_ids, e.actor_id, 'feedback_new', e.feedback_id, `${prefix}${e.title} — ${author}`)
  })

  on('feedback.reviewed', async (e) => {
    const reviewer = await nameOf(e.actor_id)
    const text = e.approved
      ? `${e.title} — ${reviewer} đã xác nhận, chuyển đội phát triển`
      : `${e.title} — ${reviewer} trả lại: ${e.reason}`
    await fanOut(e.recipient_ids, e.actor_id, 'feedback_reviewed', e.feedback_id, text)
  })

  on('feedback.resubmitted', async (e) => {
    const author = await nameOf(e.actor_id)
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'feedback_new',
      e.feedback_id,
      `[Gửi lại · chờ xác nhận] ${e.title} — ${author}`,
    )
  })

  on('feedback.processed', async (e) => {
    const st = STATUS_LABEL[e.status as FeedbackStatus] ?? e.status
    const round = e.round > 0 ? ` (vòng ${e.round + 1})` : ''
    const tail =
      e.status === 'done'
        ? ' — vào xem rồi bấm Đã ổn hoặc Vẫn cần chỉnh thêm'
        : e.replied
          ? ' — có trả lời mới'
          : ''
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'feedback_processed',
      e.feedback_id,
      `${e.title} — ${st.toLowerCase()}${round}${tail}`,
    )
  })

  on('feedback.commented', async (e) => {
    const author = await nameOf(e.actor_id)
    const prefix = e.needs_more ? '[Cần chỉnh thêm] ' : e.is_admin ? 'Admin trả lời: ' : 'Trao đổi mới: '
    const mentioned = new Set(e.mention_ids)
    await fanOut(
      e.recipient_ids.filter((id) => !mentioned.has(id)),
      e.actor_id,
      'feedback_commented',
      e.feedback_id,
      `${prefix}${e.title} — ${author}`,
    )
    await fanOut(
      e.mention_ids,
      e.actor_id,
      'feedback_mentioned',
      e.feedback_id,
      `${author} nhắc bạn trong góp ý: ${e.title}`,
    )
  })

  on('feedback.confirmed', async (e) => {
    const author = await nameOf(e.actor_id)
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'feedback_confirmed',
      e.feedback_id,
      `Đã ổn: ${e.title} — ${author} xác nhận`,
    )
  })
}
