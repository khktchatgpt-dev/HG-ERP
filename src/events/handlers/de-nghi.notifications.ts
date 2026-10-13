import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Thông báo ĐỀ NGHỊ MUA VẬT TƯ (0236 · Đ2, loại 0237). Mỗi thông báo mang `href`
 * mở thẳng phiếu — lãnh đạo bấm trên điện thoại là tới màn duyệt, không phải đi
 * tìm. Handler lỗi bị bus nuốt: phiếu vẫn đổi trạng thái.
 */
export function registerDeNghiNotificationHandlers() {
  on('de_nghi.submitted', async (e) => {
    const tien = e.tong > 0 ? ` · dự kiến ${e.tong.toLocaleString('vi-VN')} đ` : ''
    await Promise.all(
      e.approver_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.submitted_by,
          type: 'dnm_submitted',
          payload: {
            title: `${e.code} — ${e.department} · ${e.so_dong} dòng${tien}`,
            href: `/duyet/de-nghi/${e.request_id}`,
          },
        }),
      ),
    )
  })

  on('de_nghi.decided', async (e) => {
    const jobs: Promise<unknown>[] = []
    if (e.requester_id && e.requester_id !== e.decided_by)
      jobs.push(
        notificationsService.notify({
          recipientId: e.requester_id,
          actorId: e.decided_by,
          type: e.decision === 'approved' ? 'dnm_approved' : 'dnm_rejected',
          payload: {
            title: e.reason ? `${e.code} — ${e.reason}` : e.code,
            reason: e.reason,
            href: `/warehouse/de-nghi/${e.request_id}`,
          },
        }),
      )
    if (e.decision === 'approved')
      for (const sid of e.supply_ids)
        if (sid !== e.decided_by && sid !== e.requester_id)
          jobs.push(
            notificationsService.notify({
              recipientId: sid,
              actorId: e.decided_by,
              type: 'dnm_approved',
              payload: {
                title: `${e.code} — chờ Cung ứng lập đơn mua`,
                href: `/duyet/de-nghi/${e.request_id}`,
              },
            }),
          )
    await Promise.all(jobs)
  })
}
