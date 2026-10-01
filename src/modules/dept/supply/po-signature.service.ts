import { posRepo, type Po } from './pos.repo'
import { supplyRepo } from './supply.repo'
import { approverIds, assertPoOwner, assertSupplierCanOrder } from './pos.service'
import {
  canSignLate,
  canUnapprove,
  canUrgentSend,
  questionKindFor,
  QUESTION_LABEL,
  type PoQuestionThread,
} from '@/lib/po-signature'
import { reasonLine } from '@/lib/po-note'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { docNotesRepo } from '@/modules/core/doc-notes/doc-notes.repo'
import type { DocNote } from '@/lib/doc-notes'
import type { User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import '@/events/register'
import { BadRequest, NotFound } from '@/server/http'

/**
 * ĐƠN MUA SAU CHỮ KÝ (0218, chủ dự án chốt 01/10/2026) — bốn việc của Giám đốc
 * và trưởng phòng Cung ứng quanh chữ ký, tách khỏi `pos.service` (đã ~1.500
 * dòng) vì chúng là MỘT cụm nghiệp vụ: thu hồi chữ ký · gửi gấp ký bù · hỏi
 * lại / yêu cầu xem lại · trả lời.
 *
 * Luật nằm ở `lib/po-signature` (thuần, có test); đây chỉ đọc dữ liệu, gọi
 * luật, ghi, phát sự kiện. Nút ở màn gọi CÙNG các hàm luật đó, nên câu "vì sao
 * không bấm được" và câu lỗi của server luôn là một.
 */

async function load(id: string) {
  const [po, urgent] = await Promise.all([
    posRepo.findById(id),
    posRepo.urgentByIds([id]),
  ])
  if (!po) throw NotFound('Đơn đặt không tồn tại')
  // Ba cột gửi gấp đọc riêng (pos.repo `urgentByIds`) rồi ghép vào.
  return { ...po, ...urgent.get(id) }
}

const ownerOf = (p: Pick<Po, 'assigned_to' | 'created_by'>) =>
  p.assigned_to ?? p.created_by

/** Ghi chú nội bộ dạng `[nhãn] nội dung` — cùng lối với "[Huỷ]", "[Trả lại để sửa]". */
async function trace(user: User, poId: string, label: string, body: string) {
  const line = reasonLine(label, body)
  if (!line) return
  await docNotesRepo.create(
    {
      doc_type: 'po',
      doc_id: poId,
      author_id: user.id,
      audience: 'internal',
      body: line,
    },
    user.name ?? null,
  )
}

export type { PoQuestionThread }

/**
 * Gom câu hỏi + các câu trả lời (ghi chú `reply_to` câu hỏi) thành từng mạch,
 * MỚI NHẤT TRƯỚC. Loại câu hỏi ("Hỏi lại" / "Yêu cầu xem lại") suy từ nhãn đầu
 * dòng mà `ask` đã đóng dấu, để đọc lại vẫn biết lúc hỏi đơn đang ở đâu.
 */
export function threadsOf(notes: DocNote[]): PoQuestionThread[] {
  const live = notes.filter((n) => !n.deleted_at)
  return live
    .filter((n) => n.kind === 'question')
    .map((q) => ({
      id: q.id,
      kind: q.body.startsWith(`[${QUESTION_LABEL.review}]`) ? ('review' as const) : ('ask' as const), // prettier-ignore
      body: q.body.replace(/^\[[^\]]+\]\s*/, ''),
      author_id: q.author_id,
      author_name: q.author_name,
      created_at: q.created_at,
      resolved_at: q.resolved_at ?? null,
      resolved_how: q.resolved_how ?? null,
      answers: live
        .filter((a) => a.reply_to === q.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((a) => ({ id: a.id, body: a.body, author_name: a.author_name, created_at: a.created_at })), // prettier-ignore
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export const poSignatureService = {
  /** Mọi mạch câu hỏi của một đơn — ai xem được đơn thì đọc được. */
  async questions(_user: User, poId: string): Promise<PoQuestionThread[]> {
    await load(poId)
    return threadsOf(await docNotesRepo.list('po', poId))
  },

  /**
   * THU HỒI CHỮ KÝ — đơn đã duyệt, chưa gửi NCC → về CHỜ DUYỆT (không về nháp:
   * thứ sai là quyết định của người ký, không phải số trên đơn). Bất kỳ ai có
   * quyền duyệt đều thu hồi được (ba người chung một hộp ký); vết ghi rõ ai
   * thu hồi chữ ký của ai.
   */
  async unapprove(user: User, id: string, reason: string): Promise<Po> {
    await assertAction(user, 'supply.po.approve')
    if (!reason.trim()) throw BadRequest('Phải ghi lý do thu hồi chữ ký')
    const before = await load(id)
    const guard = canUnapprove({
      status: before.status,
      receiptDocs: (await supplyRepo.docsByPo(id)).length,
    })
    if (!guard.ok) throw BadRequest(guard.reason)

    const po = await posRepo.patch(id, {
      status: 'pending_approval',
      approved_by: null,
      approved_at: null,
    })
    await trace(user, id, 'Thu hồi chữ ký', reason)
    await emit({
      name: 'po.unapproved',
      po_id: id,
      code: before.code,
      unapproved_by: user.id,
      signed_by: before.approved_by,
      reason: reason.trim(),
      owner_id: ownerOf(before),
    })
    return po
  },

  /**
   * GỬI GẤP, KÝ BÙ SAU — trưởng phòng Cung ứng gửi NCC trước khi có chữ ký.
   * Đơn sang `ordered` như gửi thường (cùng `po.ordered` để giá mua gần nhất
   * của danh mục cập nhật), cộng ba cột `urgent_*` để hộp ký nhận ra nó.
   */
  async urgentSend(user: User, id: string, reason: string): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    if (!reason.trim()) throw BadRequest('Phải ghi vì sao không chờ ký được')
    const before = await load(id)
    const isLead =
      user.role === 'admin' || (await canAction(user, 'supply.po.manage_any'))
    const lines = await posRepo.listLines(id)
    const guard = canUrgentSend({
      status: before.status,
      isLead,
      hasEta: !!before.expected_at,
      lineCount: lines.length,
    })
    if (!guard.ok) throw BadRequest(guard.reason)
    await assertSupplierCanOrder(before.supplier_id)

    const now = new Date().toISOString()
    const po = await posRepo.patch(id, {
      status: 'ordered',
      ordered_at: now,
      urgent_sent_at: now,
      urgent_sent_by: user.id,
      urgent_reason: reason.trim(),
    })
    await trace(user, id, 'Gửi gấp chưa ký', reason)
    await emit({
      name: 'po.urgent_sent',
      po_id: id,
      code: before.code,
      sent_by: user.id,
      reason: reason.trim(),
      approver_ids: await approverIds(user.id),
    })
    await emit({
      name: 'po.ordered',
      po_id: id,
      code: before.code,
      currency: before.currency ?? 'VND',
      ordered_by: user.id,
      lines: lines.map((l) => ({ material_id: l.material_id, unit_price: l.unit_price })),
    })
    return po
  },

  /**
   * KÝ BÙ — gắn chữ ký lên đơn đã gửi gấp, TRẠNG THÁI GIỮ NGUYÊN (hàng có thể
   * đang về). Vết dùng lại 'approved' để đếm số chữ ký không bị tách đôi; dòng
   * thời gian tự gọi là "Ký bù" vì có mốc gửi gấp đứng trước.
   */
  async signLate(user: User, id: string): Promise<Po> {
    await assertAction(user, 'supply.po.approve')
    const before = await load(id)
    const guard = canSignLate(before)
    if (!guard.ok) throw BadRequest(guard.reason)
    const po = await posRepo.patch(id, {
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    await docNotesRepo.resolveQuestions('po', id, user.id, 'decided')
    await emit({
      name: 'po.decided',
      po_id: id,
      code: before.code,
      decision: 'approved',
      decided_by: user.id,
      owner_id: ownerOf(before),
    })
    return po
  },

  /**
   * HỎI LẠI / YÊU CẦU XEM LẠI — một câu hỏi gửi người phụ trách, KHÔNG đổi
   * trạng thái đơn. Tên theo chỗ đơn đang đứng (`questionKindFor`).
   */
  async ask(user: User, id: string, body: string): Promise<PoQuestionThread> {
    await assertAction(user, 'supply.po.approve')
    const text = body.trim()
    if (!text) throw BadRequest('Câu hỏi đang trống')
    const before = await load(id)
    const kind = questionKindFor(before)
    if (!kind) throw BadRequest('Đơn nháp hoặc đã huỷ — không có gì để hỏi')

    const note = await docNotesRepo.create(
      {
        doc_type: 'po',
        doc_id: id,
        author_id: user.id,
        audience: 'internal',
        kind: 'question',
        body: `[${QUESTION_LABEL[kind]}] ${text}`,
      },
      user.name ?? null,
    )
    // Người hỏi và người phụ trách cùng theo dõi đơn: trao đổi sau đó tới cả hai.
    await docNotesRepo.addFollowers('po', id, [user.id, ownerOf(before)].filter(Boolean) as string[]) // prettier-ignore
    await emit({
      name: 'po.question',
      po_id: id,
      code: before.code,
      question_id: note.id,
      asked_by: user.id,
      kind,
      body: text,
      owner_id: ownerOf(before),
    })
    return threadsOf([note])[0]
  },

  /**
   * TRẢ LỜI — người phụ trách (hoặc trưởng phòng / admin, như mọi thao tác trên
   * đơn). Câu hỏi đóng ('answered'), người hỏi nhận thông báo; bóng về lại tay
   * Giám đốc.
   */
  async answer(user: User, id: string, questionId: string, body: string): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const text = body.trim()
    if (!text) throw BadRequest('Câu trả lời đang trống')
    const before = await load(id)
    await assertPoOwner(user, before)
    const q = (await docNotesRepo.list('po', id)).find(
      (n) => n.id === questionId && n.kind === 'question' && !n.deleted_at,
    )
    if (!q) throw NotFound('Không thấy câu hỏi trên đơn này')

    await docNotesRepo.create(
      { doc_type: 'po', doc_id: id, author_id: user.id, audience: 'internal', body: text, reply_to: questionId }, // prettier-ignore
      user.name ?? null,
    )
    await docNotesRepo.resolveQuestions('po', id, user.id, 'answered', questionId)
    await emit({
      name: 'po.answered',
      po_id: id,
      code: before.code,
      question_id: questionId,
      answered_by: user.id,
      asker_id: q.author_id,
      body: text,
    })
  },
}
