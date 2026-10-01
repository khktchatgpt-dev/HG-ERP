import { authService } from '@/modules/core/auth/auth.service'
import { approvalHistoryService } from '@/modules/core/approvals/approvals.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { poWhereNow } from '@/lib/po-signature'
import { PO_STATUS_LABEL } from '@/lib/po-status'
import { HistoryManager, type PoNow } from './HistoryManager'

/**
 * Lịch sử phê duyệt (FR-ADM-03) — GĐ soi ai duyệt/từ chối phiếu nào, khi nào,
 * lý do gì. Nguồn: bảng approval_events (ghi khi po.decided / lsx.decided).
 *
 * 0218 (01/10/2026): mã đơn mua bấm được → màn ký chỉ đọc; cột "Hiện ở đâu"
 * nói đơn đã ký giờ đã gửi, đã về, hay còn thu hồi được.
 */
export default async function ApprovalHistoryPage() {
  const user = await authService.requirePageUser()
  const events = await approvalHistoryService.list(user, { limit: 300 })
  const poIds = [...new Set(events.filter((e) => e.entity_type === 'po').map((e) => e.entity_id))] // prettier-ignore
  const brief = await posRepo.briefByIds(poIds)
  const poNow: PoNow = Object.fromEntries(
    [...brief].map(([id, p]) => [id, poWhereNow(p, PO_STATUS_LABEL)]),
  )
  return <HistoryManager events={events} poNow={poNow} />
}
