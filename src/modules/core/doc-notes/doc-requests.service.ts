import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { emit } from '@/events/bus'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { deriveFollowers, type DocType } from '@/lib/doc-notes'
import {
  actionBlock,
  allowedActions,
  dueBlock,
  matchesFilter,
  overdueDays,
  RECENT_DAYS,
  requestActionSchema,
  requestCreateSchema,
  requestListQuerySchema,
  requestRecipients,
  sortRequests,
  summarizeRequests,
  traceText,
  transitionPatch,
  type DocRequest,
  type RequestAction,
  type RequestDocType,
  type RequestFilter,
  type RequestTab,
} from '@/lib/doc-requests'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { docNotesRepo } from './doc-notes.repo'
import { docRequestsRepo } from './doc-requests.repo'
import { docCodesByIds, loadDocRef } from './doc-ref'

/**
 * YÊU CẦU VIỆC TRÊN CHỨNG TỪ (0281) — tầng nghiệp vụ. Luật ai-bấm-được-gì nằm ở
 * `@/lib/doc-requests` (thuần, có test); ở đây chỉ ghép luật với DB + sự kiện.
 *
 * QUYỀN GIAO = QUYỀN XEM CHỨNG TỪ (C5), giống ghi chú: không đẻ quyền mới để
 * admin phải cấp lại cho từng người. Người NHẬN thì không cần xem được chứng từ —
 * Sales không mở được đơn mua của Cung ứng, nên danh sách yêu cầu tự mang đủ
 * nội dung để làm.
 */

export type RequestListItem = DocRequest & {
  doc_code: string | null
  overdue_days: number
  /** Bước người đang xem bấm được — màn hình vẽ nút theo đây, không tự suy luật. */
  actions: RequestAction[]
}

export type RequestList = {
  tab: RequestTab
  filter: RequestFilter
  summary: Record<RequestFilter, number>
  items: RequestListItem[]
}

const actorOf = (user: User) => ({ id: user.id, isAdmin: user.role === 'admin' })

/** Người nhận phải còn đang làm — giao cho tài khoản đã khoá là giao vào hư không. */
async function activeAssignee(id: string): Promise<User> {
  const u = await usersRepo.findById(id)
  if (!u) throw BadRequest('Không thấy người nhận')
  if (!u.is_active || u.deleted_at) {
    throw BadRequest(`${u.name ?? 'Người này'} không còn hoạt động — chọn người khác`)
  }
  return u
}

export const docRequestsService = {
  async create(user: User, input: unknown): Promise<DocRequest> {
    const parsed = requestCreateSchema.parse(input)
    const due = dueBlock(parsed.due_on, todayVn())
    if (due) throw BadRequest(due)
    const doc = await loadDocRef(parsed.doc_type, parsed.doc_id)
    if (!doc) throw NotFound('Không thấy chứng từ')
    const assignee = await activeAssignee(parsed.assignee_id)

    const request = await docRequestsRepo.create({
      doc_type: parsed.doc_type,
      doc_id: parsed.doc_id,
      author_id: user.id,
      assignee_id: assignee.id,
      due_on: parsed.due_on ?? null,
      body: parsed.body,
    })
    // Người nhận thành người theo dõi chứng từ: việc giao cho mình thì chuyện
    // trên tờ đó là chuyện của mình — không bắt họ tự bấm theo dõi.
    await docNotesRepo.addFollowers(parsed.doc_type, parsed.doc_id, [
      ...deriveFollowers(doc.watchers),
      user.id,
      assignee.id,
    ])
    await emit({
      name: 'doc.request.created',
      request_id: request.id,
      doc_type: parsed.doc_type,
      doc_id: parsed.doc_id,
      doc_code: doc.code,
      body: request.body,
      due_on: request.due_on,
      actor_id: user.id,
      recipient_ids: requestRecipients(request, user.id),
    })
    return request
  },

  async act(user: User, id: string, input: unknown): Promise<DocRequest> {
    const parsed = requestActionSchema.parse(input)
    const r = await docRequestsRepo.findById(id)
    if (!r) throw NotFound('Không thấy yêu cầu')
    const block = actionBlock(r, parsed.action, actorOf(user))
    if (block)
      throw block.kind === 'who' ? Forbidden(block.message) : BadRequest(block.message)

    let next: User | null = null
    if (parsed.action === 'reassign') {
      if (parsed.assignee_id === r.assignee_id)
        throw BadRequest('Yêu cầu đang ở người này rồi')
      next = await activeAssignee(parsed.assignee_id)
    }

    const { expect, patch } = transitionPatch(
      parsed.action,
      user.id,
      new Date().toISOString(),
      next?.id,
    )
    const updated = await docRequestsRepo.applyPatch(id, expect, patch)
    if (!updated) throw Conflict('Yêu cầu vừa được người khác cập nhật — tải lại để xem')

    // Vết: một ghi chú thường trả lời yêu cầu, nằm trong dòng trao đổi của chứng từ.
    await docNotesRepo.create(
      {
        doc_type: r.doc_type,
        doc_id: r.doc_id,
        author_id: user.id,
        audience: 'internal',
        body: traceText(parsed.action, parsed.text, next?.name),
        reply_to: r.id,
      },
      user.name ?? null,
    )
    if (next) await docNotesRepo.addFollowers(r.doc_type, r.doc_id, [next.id])

    const codes = await docCodesByIds(r.doc_type, [r.doc_id])
    await emit({
      name: 'doc.request.changed',
      action: parsed.action,
      request_id: r.id,
      doc_type: r.doc_type as RequestDocType,
      doc_id: r.doc_id,
      doc_code: codes.get(r.doc_id) ?? '',
      body: r.body,
      text: parsed.text?.trim() || null,
      actor_id: user.id,
      recipient_ids: requestRecipients(r, user.id, [next?.id]),
    })
    return updated
  },

  /** "Giao cho tôi" / "Tôi đã giao" + số trên từng chip — cùng một phép lọc. */
  async listMine(user: User, query: unknown): Promise<RequestList> {
    const q = requestListQuerySchema.parse(query ?? {})
    const today = todayVn()
    // Lấy dư một ngày so với RECENT_DAYS; ranh giới chính xác theo ngày VN do
    // `matchesFilter` quyết.
    const since = new Date(Date.now() - (RECENT_DAYS + 1) * 86_400_000).toISOString()
    const rows = await docRequestsRepo.listForUser(q.tab, user.id, since)

    const picked = sortRequests(
      rows.filter((r) => matchesFilter(r, q.filter, today)),
      today,
    )
    const codes = new Map<string, string>()
    for (const dt of new Set(picked.map((r) => r.doc_type))) {
      const m = await docCodesByIds(
        dt,
        picked.filter((r) => r.doc_type === dt).map((r) => r.doc_id),
      )
      for (const [k, v] of m) codes.set(`${dt}:${k}`, v)
    }
    const actor = actorOf(user)
    return {
      tab: q.tab,
      filter: q.filter,
      summary: summarizeRequests(rows, today),
      items: picked.map((r) => ({
        ...r,
        doc_code: codes.get(`${r.doc_type}:${r.doc_id}`) ?? null,
        overdue_days: overdueDays(r, today),
        actions: allowedActions(r, actor),
      })),
    }
  },

  /**
   * Yêu cầu trên MỘT chứng từ — cho khối "Yêu cầu đang mở" trong trao đổi. Người
   * gọi đã tra chứng từ (quyền xem = quyền nói, như ghi chú) nên truyền luôn mã.
   */
  async listByDoc(
    user: User,
    docType: DocType,
    docId: string,
    docCode: string,
  ): Promise<RequestListItem[]> {
    const today = todayVn()
    const actor = actorOf(user)
    const rows = await docRequestsRepo.listByDoc(docType, docId)
    return sortRequests(rows, today).map((r) => ({
      ...r,
      doc_code: docCode,
      overdue_days: overdueDays(r, today),
      actions: allowedActions(r, actor),
    }))
  },

  /**
   * Ai giao được cho ai: mọi tài khoản đang hoạt động, mọi phòng (C1). Chỉ tên +
   * phòng — không email, không số điện thoại: ô chọn người không cần, và danh sách
   * này mở cho mọi nhân viên đã đăng nhập.
   */
  async people(): Promise<{ id: string; name: string; department: string | null }[]> {
    const [users, depts] = await Promise.all([
      usersRepo.list({ active_only: true }),
      departmentsRepo.list(),
    ])
    const deptName = new Map(depts.map((d) => [d.id, d.name]))
    return users
      .filter((u) => u.name?.trim())
      .map((u) => ({
        id: u.id,
        name: u.name!.trim(),
        department: u.department_id ? (deptName.get(u.department_id) ?? null) : null,
      }))
  },

  /**
   * Chứng từ bị huỷ → đóng mọi yêu cầu còn mở trên nó và báo người nhận.
   *
   * NUỐT LỖI có chủ ý: hàm nằm trên đường Huỷ đơn / Huỷ lệnh. Đóng yêu cầu hỏng
   * thì yêu cầu còn treo (người giao tự huỷ được), còn ném ra thì người dùng tưởng
   * huỷ chứng từ thất bại và bấm lại.
   */
  async closeByDoc(docType: DocType, docId: string, docCode: string, actorId: string) {
    try {
      const closed = await docRequestsRepo.closeOpenByDoc(docType, docId, actorId)
      for (const r of closed) {
        await docNotesRepo.create(
          {
            doc_type: docType,
            doc_id: docId,
            author_id: actorId,
            audience: 'internal',
            body: traceText('closed', null),
            reply_to: r.id,
          },
          null,
        )
        await emit({
          name: 'doc.request.changed',
          action: 'closed',
          request_id: r.id,
          doc_type: docType as RequestDocType,
          doc_id: docId,
          doc_code: docCode,
          body: r.body,
          text: null,
          actor_id: actorId,
          recipient_ids: requestRecipients(r, actorId),
        })
      }
    } catch (e) {
      console.error('[doc-requests] đóng yêu cầu theo chứng từ thất bại:', e)
    }
  },
}
