import { on } from '../bus'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'

/**
 * Ghi LỊCH SỬ PHÊ DUYỆT (audit) khi có quyết định duyệt/từ chối.
 * Nghe po.decided + lsx.decided — 1 nguồn ghi duy nhất, không đụng service.
 * Đăng ký 1 lần ở boot (xem src/events/register.ts).
 */
export function registerApprovalAuditHandlers(): void {
  // 0128 — các mốc vòng đời PO ngoài duyệt/từ chối, để truy được "ai gửi/rút/
  // bàn giao đơn lúc nào" (trước đây chỉ quyết định duyệt mới có vết).
  on('po.submitted', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'po',
      entity_id: e.po_id,
      entity_code: e.code,
      action: 'submitted',
      actor_id: e.submitted_by,
    })
  })

  on('po.withdrawn', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'po',
      entity_id: e.po_id,
      entity_code: e.code,
      action: 'withdrawn',
      actor_id: e.withdrawn_by,
    })
  })

  on('po.reassigned', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'po',
      entity_id: e.po_id,
      entity_code: e.code,
      action: 'reassigned',
      actor_id: e.reassigned_by,
    })
  })

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

  // 0149 — báo giá trình GĐ (tuỳ chọn) cũng để lại vết như PO/LSX.
  on('quote.submitted', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'quote',
      entity_id: e.quote_id,
      entity_code: e.code,
      action: 'submitted',
      actor_id: e.submitted_by,
    })
  })

  on('quote.decided', async (e) => {
    await approvalEventsRepo.log({
      entity_type: 'quote',
      entity_id: e.quote_id,
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
