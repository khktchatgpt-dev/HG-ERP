import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import type { NotificationType } from '@/modules/core/notifications/notifications.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { shortMoney } from '@/lib/may-moc'

/**
 * Thông báo khu MÁY MÓC (0270). Mỗi thông báo mang `payload.href` tới đúng
 * phiếu báo hỏng (`/may-moc/bao-hong?id=`) để chuông mở thẳng chỗ cần làm.
 * Lỗi ở đây bus nuốt + log — không bao giờ làm hỏng việc ghi phiếu.
 */
export function registerAssetNotificationHandlers(): void {
  const href = (id: string) => `/may-moc/bao-hong?id=${id}`

  async function fanOut(
    recipientIds: string[],
    actorId: string,
    type: NotificationType,
    issueId: string,
    title: string,
  ) {
    const uniq = [...new Set(recipientIds)].filter((id) => id && id !== actorId)
    await Promise.all(
      uniq.map((recipientId) =>
        notificationsService.notify({
          recipientId,
          actorId,
          type,
          payload: { title, href: href(issueId), asset_issue_id: issueId },
        }),
      ),
    )
  }
  const nameOf = async (id: string) =>
    (await usersRepo.displayNamesByIds([id])).get(id) ?? 'Ai đó'

  on('asset.issue.reported', async (e) => {
    const who = await nameOf(e.actor_id)
    const prefix = e.stops ? '[Dừng máy] ' : ''
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'asset_issue_new',
      e.issue_id,
      `${prefix}${e.no} · ${e.label} — ${who}`,
    )
  })

  on('asset.issue.approval_needed', async (e) => {
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'asset_issue_approval',
      e.issue_id,
      `${e.no} · ${e.label} — dự toán ${shortMoney(e.estimate)} chờ duyệt`,
    )
  })

  on('asset.issue.decided', async (e) => {
    const text = e.approved
      ? `${e.no} · ${e.label} — GĐ đã duyệt, tiến hành sửa`
      : `${e.no} · ${e.label} — GĐ không duyệt: ${e.reason ?? ''}`
    await fanOut(e.recipient_ids, e.actor_id, 'asset_issue_decided', e.issue_id, text)
  })

  on('asset.issue.done', async (e) => {
    await fanOut(
      e.recipient_ids,
      e.actor_id,
      'asset_issue_done',
      e.issue_id,
      `${e.no} · ${e.label} — đã sửa xong, máy chạy lại (${shortMoney(e.cost)})`,
    )
  })
}
