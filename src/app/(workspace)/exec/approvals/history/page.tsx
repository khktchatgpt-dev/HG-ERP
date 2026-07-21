import { authService } from '@/modules/core/auth/auth.service'
import { approvalHistoryService } from '@/modules/core/approvals/approvals.service'
import { HistoryManager } from './HistoryManager'

/**
 * Lịch sử phê duyệt (FR-ADM-03) — GĐ soi ai duyệt/từ chối phiếu nào, khi nào,
 * lý do gì. Nguồn: bảng approval_events (ghi khi po.decided / lsx.decided).
 */
export default async function ApprovalHistoryPage() {
  const user = (await authService.currentUser())!
  const events = await approvalHistoryService.list(user, { limit: 300 })
  return <HistoryManager events={events} />
}
