import { on } from '../bus'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

/**
 * Notify tách vai sản xuất (07/2026):
 *  - production.stage.done → tổ phụ trách công đoạn KẾ TIẾP ("đến lượt tổ
 *    mình") + quản đốc (GĐ/QL). Công đoạn cuối → chỉ quản đốc.
 *  - production.incident.reported → quản đốc.
 *  - production.incident.resolved → người báo sự cố.
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

  on('production.incident.reported', async (e) => {
    const where = [e.lsx_code, e.department_name].filter(Boolean).join(' · ')
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.reported_by,
          type: 'incident_reported',
          payload: {
            title: where ? `${where}: ${e.message}` : e.message,
            incident_id: e.incident_id,
          },
        }),
      ),
    )
  })

  on('production.incident.resolved', async (e) => {
    await Promise.all(
      e.notify_ids.map((rid) =>
        notificationsService.notify({
          recipientId: rid,
          actorId: e.resolved_by,
          type: 'incident_resolved',
          payload: {
            title: e.lsx_code ? `${e.lsx_code}: ${e.message}` : e.message,
            incident_id: e.incident_id,
          },
        }),
      ),
    )
  })
}
