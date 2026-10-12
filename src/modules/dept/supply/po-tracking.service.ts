import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'
import { emit } from '@/events/bus'
import { ISSUE_KIND_LABEL } from '@/lib/po-tracking'
import { posRepo } from './pos.repo'
import { poTrackingRepo, type CommitLogRow, type PoIssue } from './po-tracking.repo'
import type { IssueInput } from './po-tracking.schema'

/**
 * THEO DÕI THỰC HIỆN ĐƠN MUA (0213) — sổ hẹn giao (chỉ đọc ở đây; ghi đi kèm
 * các thao tác đợt giao trong `pos.service`) và sổ sự cố giao hàng.
 *
 * Sự cố do Cung ứng HOẶC Kho ghi (`supply.po_issue.manage`): Kho là người thấy
 * hàng sai trước, Cung ứng là người đi nói với NCC.
 */
export const poTrackingService = {
  /** Cùng mức lộ với chi tiết đơn: ai mở được đơn cũng xem được. */
  async forPo(
    _user: User,
    poId: string,
  ): Promise<{ commits: CommitLogRow[]; issues: PoIssue[] }> {
    const [commits, issues] = await Promise.all([
      poTrackingRepo.commitLog(poId),
      poTrackingRepo.issues(poId),
    ])
    return { commits, issues }
  },

  async addIssue(user: User, poId: string, input: IssueInput): Promise<{ id: string }> {
    await assertAction(user, 'supply.po_issue.manage')
    const po = await posRepo.findById(poId)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    if (
      po.status === 'draft' ||
      po.status === 'pending_approval' ||
      po.status === 'approved'
    ) {
      throw BadRequest('Đơn chưa gửi NCC — chưa có gì giao để ghi sự cố')
    }
    if (input.po_line_id) {
      const lines = await posRepo.listLines(poId)
      if (!lines.some((l) => l.id === input.po_line_id))
        throw BadRequest('Dòng không thuộc đơn này')
    }
    const id = await poTrackingRepo.insertIssue({
      po_id: poId,
      po_line_id: input.po_line_id ?? null,
      kind: input.kind,
      qty: input.qty ?? null,
      description: input.description.trim(),
      created_by: user.id,
    })
    // Báo người phụ trách đơn (Kho đợt 2 · Bước 3). Ghi sổ TRƯỚC, báo SAU: bus nuốt
    // lỗi handler (vd. chưa áp 0231) — sự cố vẫn nằm trong sổ.
    await emit({
      name: 'po.issue_recorded',
      po_id: poId,
      code: po.code,
      supplier_name: po.supplier_name,
      owner_id: po.assigned_to ?? po.created_by ?? null,
      reported_by: user.id,
      kind_label: ISSUE_KIND_LABEL[input.kind],
      description: input.description.trim(),
    })
    return { id }
  },

  async resolveIssue(user: User, issueId: string, resolution: string): Promise<void> {
    await assertAction(user, 'supply.po_issue.manage')
    const issue = await poTrackingRepo.findIssue(issueId)
    if (!issue) throw NotFound('Sự cố không tồn tại')
    const ok = await poTrackingRepo.resolveIssue(issueId, user.id, resolution.trim())
    if (!ok) throw BadRequest('Sự cố đã được xử lý rồi')
  },
}
