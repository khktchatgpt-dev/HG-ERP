import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify bàn giao công đoạn (0084 — job done per dòng SP):
 *  - production.stage.done → tổ phụ trách công đoạn KẾ TIẾP ("đến lượt tổ
 *    mình") + quản đốc (GĐ/QL). Công đoạn cuối → chỉ quản đốc.
 * Sự cố xưởng KHÔNG còn trong hệ (báo cáo riêng ngoài hệ thống — user chốt
 * 07/2026).
 */
export function registerProductionNotificationHandlers(): void {
  on('production.stage.done', async (e) => {
    const nextLabels = e.next_stage_labels.join(', ')
    const handoffTitle = `${e.code} — ${e.stage_label} xong, đến lượt ${nextLabels}`
    const coordTitle = e.next_stages.length
      ? handoffTitle
      : `${e.code} — ${e.stage_label} xong (công đoạn cuối lộ trình)`
    await Promise.all([
      ...e.notify_next_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.done_by,
          type: 'stage_handoff',
          payload: { title: handoffTitle, production_order_id: e.production_order_id },
        }),
      ),
      ...e.coordinator_ids
        .filter((id) => !e.notify_next_ids.includes(id))
        .map((rid) =>
          notificationsService.notify({
            recipientId: rid,
            actorId: e.done_by,
            type: 'stage_handoff',
            payload: { title: coordTitle, production_order_id: e.production_order_id },
          }),
        ),
    ])
  })
}
