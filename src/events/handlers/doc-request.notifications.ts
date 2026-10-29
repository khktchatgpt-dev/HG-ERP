import { on } from '../bus'
import type { EventOf } from '../types'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import type { NotificationType } from '@/modules/core/notifications/notifications.repo'
import { requestHref } from '@/lib/doc-requests'

/**
 * Chuông YÊU CẦU VIỆC (0281). Mỗi thông báo mang `payload.href` tới trang "Yêu cầu
 * việc" ở đúng yêu cầu — KHÔNG tới chứng từ: người nhận có thể không mở được chứng
 * từ đó (Sales với đơn mua của Cung ứng), còn trang yêu cầu thì ai được giao cũng
 * mở được. Lỗi ở đây bus nuốt + log — không bao giờ làm hỏng việc giao.
 */

const CHANGED_TYPE: Record<EventOf<'doc.request.changed'>['action'], NotificationType> = {
  done: 'doc_request_done',
  reopen: 'doc_request_reopened',
  reassign: 'doc_request_reassigned',
  cancel: 'doc_request_cancelled',
  closed: 'doc_request_cancelled',
}

/** Tiêu đề chuông: mã chứng từ + đầu câu việc — đủ để biết việc nào mà khỏi mở. */
export function requestTitle(docCode: string, body: string): string {
  const one = body.replace(/\s+/g, ' ').trim()
  const cut = one.length > 80 ? `${one.slice(0, 79)}…` : one
  return docCode ? `${docCode} · ${cut}` : cut
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function registerDocRequestNotificationHandlers(): void {
  async function fanOut(
    recipientIds: string[],
    actorId: string,
    type: NotificationType,
    payload: { title: string; reason?: string | null; href: string; doc_type: string; doc_id: string }, // prettier-ignore
  ) {
    const uniq = [...new Set(recipientIds)].filter((id) => id && id !== actorId)
    await Promise.all(
      uniq.map((recipientId) =>
        notificationsService.notify({ recipientId, actorId, type, payload }),
      ),
    )
  }

  on('doc.request.created', async (e) => {
    await fanOut(e.recipient_ids, e.actor_id, 'doc_request', {
      title: requestTitle(e.doc_code, e.body),
      reason: e.due_on ? `Hạn ${dm(e.due_on)}` : null,
      href: requestHref(e.request_id),
      doc_type: e.doc_type,
      doc_id: e.doc_id,
    })
  })

  on('doc.request.changed', async (e) => {
    await fanOut(e.recipient_ids, e.actor_id, CHANGED_TYPE[e.action], {
      title: requestTitle(e.doc_code, e.body),
      reason: e.action === 'closed' ? 'Chứng từ đã huỷ — yêu cầu tự đóng' : e.text,
      href: requestHref(e.request_id),
      doc_type: e.doc_type,
      doc_id: e.doc_id,
    })
  })
}
