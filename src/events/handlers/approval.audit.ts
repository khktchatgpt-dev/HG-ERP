import { on } from '../bus'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'

/**
 * Ghi LỊCH SỬ PHÊ DUYỆT (audit) khi có quyết định duyệt/từ chối.
 * Nghe po.decided + lsx.decided — 1 nguồn ghi duy nhất, không đụng service.
 * Đăng ký 1 lần ở boot (xem src/events/register.ts).
 */
export function registerApprovalAuditHandlers(): void {
  on('po.decided', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'po',
      entity_id: e.po_id,
      entity_code: e.code,
      action: e.decision,
      actor_id: e.decided_by,
      reason: e.reason,
    })
  })

  on('lsx.decided', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'lsx',
      entity_id: e.production_order_id,
      entity_code: e.code,
      action: e.decision,
      actor_id: e.decided_by,
      reason: e.reason,
    })
  })
}
