import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { canAction, assertAction } from '@/modules/core/rbac/rbac.service'
import { filesRepo } from '@/modules/core/files/files.repo'
import {
  deriveTitle,
  extractMentions,
  guessTopic,
  lastActivity,
  weekStartOf,
  type FeedbackStatus,
} from '@/lib/feedback-labels'
import {
  feedbackRepo,
  type FeedbackCommentRow,
  type FeedbackRow,
  type WeeklyUpdateRow,
} from './feedback.repo'
import {
  applyManagerStatus,
  applyNeedsMore,
  applyReview,
  canAskMore,
  canConfirmOk,
  canDelete,
  canEditComment,
  canEditContent,
  canResubmit,
  canReview,
  canView,
  initialStatus,
  type Actor,
} from './feedback.rules'
import { buildFeedbackMarkdown } from './feedback.export'
import type {
  FeedbackCommentCreateInput,
  FeedbackCreateInput,
  FeedbackProcessInput,
  FeedbackReviewInput,
  FeedbackUpdateInput,
} from './feedback.schema'

/**
 * GÓP Ý HỆ THỐNG — service: quyền kiểm ở ĐÂY (không chỉ ẩn nút), luồng trạng
 * thái gọi `feedback.rules` (thuần, có test), side-effect thông báo đi qua event
 * bus (handler `feedback.notifications`) nên lỗi báo không làm hỏng việc lưu.
 *
 * Ba vai: nhân viên (mọi người đăng nhập), người xác nhận (settings
 * `feedback_reviewers`, trống = tắt cửa), người xử lý (`feedback.manage`:
 * admin + director). Chỉ admin hệ thống (users.role = admin) đổi người xác nhận.
 */

export type FeedbackListItem = FeedbackRow & {
  author_name: string
  department_name: string | null
  vote_count: number
  voted: boolean
  comment_count: number
  /** Người xem đã viết trong luồng này. */
  participated: boolean
  last_activity_at: string
  can_edit: boolean
  can_delete: boolean
  can_confirm_ok: boolean
  can_ask_more: boolean
  can_review: boolean
  can_resubmit: boolean
}

export type FeedbackListMeta = {
  counts: Record<string, number>
  this_week: number
  done_this_week: number
  can_manage: boolean
  is_reviewer: boolean
  gate_enabled: boolean
  reviewers: { id: string; name: string }[]
  can_manage_reviewers: boolean
  me: string
}

export type FeedbackCommentView = FeedbackCommentRow & {
  author_name: string
  can_edit: boolean
}

type Ctx = { actor: Actor; reviewers: string[]; gateEnabled: boolean }

async function ctxOf(user: User): Promise<Ctx> {
  const [canManage, reviewers] = await Promise.all([
    canAction(user, 'feedback.manage'),
    feedbackRepo.reviewerIds(),
  ])
  return {
    actor: { id: user.id, canManage, isReviewer: reviewers.includes(user.id) },
    reviewers,
    gateEnabled: reviewers.length > 0,
  }
}

async function load(id: string): Promise<FeedbackRow> {
  const fb = await feedbackRepo.findById(id)
  if (!fb) throw NotFound('Góp ý không tồn tại')
  return fb
}

function assertView(fb: FeedbackRow, ctx: Ctx) {
  if (!canView(fb, ctx.actor)) throw Forbidden('Góp ý riêng tư — chỉ người viết và admin xem')
}

const participantsOf = (fb: FeedbackRow, comments: readonly FeedbackCommentRow[]) => {
  const ids = new Set<string>()
  if (fb.created_by) ids.add(fb.created_by)
  for (const c of comments) if (c.author_id && c.kind !== 'status') ids.add(c.author_id)
  return [...ids]
}

/** Ghi mốc đổi trạng thái vào luồng (mọi lần đổi đều để lại vết). */
async function statusMarker(
  fb: FeedbackRow,
  to: FeedbackStatus,
  actor: User,
  isAdmin: boolean,
  round: number,
) {
  if (fb.status === to) return
  await feedbackRepo.insertComment({
    feedback_id: fb.id,
    kind: 'status',
    content: null,
    author_id: actor.id,
    is_admin: isAdmin,
    round,
    from_status: fb.status,
    to_status: to,
  })
}

/** Nhận file đã tải lên (parent `none`) về góp ý này — chỉ file của chính người gửi. */
async function claimFiles(fileIds: string[], feedbackId: string, ownerId: string) {
  if (fileIds.length === 0) return [] as string[]
  return filesRepo.claimForFeedback(fileIds, feedbackId, ownerId)
}

export const feedbackService = {
  // ── Đọc ──────────────────────────────────────────────────────────────────

  async list(
    user: User,
    scope: 'all' | 'mine',
  ): Promise<{ items: FeedbackListItem[]; meta: FeedbackListMeta }> {
    const ctx = await ctxOf(user)
    const all = (await feedbackRepo.list()).filter((fb) => canView(fb, ctx.actor))
    const rows = scope === 'mine' ? all.filter((fb) => fb.created_by === user.id) : all
    const ids = rows.map((r) => r.id)
    const [votes, comments, depts, names] = await Promise.all([
      feedbackRepo.votesFor(ids),
      feedbackRepo.commentsForMany(ids),
      departmentsRepo.list(),
      usersRepo.displayNamesByIds([
        ...rows.map((r) => r.created_by).filter((x): x is string => !!x),
        ...ctx.reviewers,
      ]),
    ])
    const deptName = new Map(depts.map((d) => [d.id, d.name]))

    const items: FeedbackListItem[] = rows.map((fb) => {
      const cs = comments.get(fb.id) ?? []
      const real = cs.filter((c) => c.kind !== 'status')
      const voters = votes.get(fb.id) ?? []
      return {
        ...fb,
        author_name: (fb.created_by && names.get(fb.created_by)) || 'Ẩn danh',
        department_name: fb.department_id ? (deptName.get(fb.department_id) ?? null) : null,
        vote_count: voters.length,
        voted: voters.includes(user.id),
        comment_count: real.length,
        participated: real.some((c) => c.author_id === user.id),
        last_activity_at: lastActivity({
          created_at: fb.created_at,
          edited_at: fb.edited_at,
          updated_at: fb.updated_at,
          last_comment_at: cs.at(-1)?.created_at ?? null,
        }),
        can_edit: canEditContent(fb, cs, ctx.actor),
        can_delete: canDelete(fb, ctx.actor),
        can_confirm_ok: canConfirmOk(fb, ctx.actor),
        can_ask_more: canAskMore(fb, ctx.actor),
        can_review: canReview(fb, ctx.actor),
        can_resubmit: canResubmit(fb, ctx.actor),
      }
    })

    const weekStart = new Date(weekStartOf(new Date()) + 'T00:00:00')
    const counts: Record<string, number> = {}
    let thisWeek = 0
    let doneThisWeek = 0
    for (const fb of all) {
      counts[fb.status] = (counts[fb.status] ?? 0) + 1
      if (new Date(fb.created_at) >= weekStart) thisWeek++
      if (fb.done_at && new Date(fb.done_at) >= weekStart) doneThisWeek++
    }
    return {
      items,
      meta: {
        counts,
        this_week: thisWeek,
        done_this_week: doneThisWeek,
        can_manage: ctx.actor.canManage,
        is_reviewer: ctx.actor.isReviewer,
        gate_enabled: ctx.gateEnabled,
        reviewers: ctx.reviewers.map((id) => ({ id, name: names.get(id) ?? '—' })),
        can_manage_reviewers: user.role === 'admin',
        me: user.id,
      },
    }
  },

  async get(
    user: User,
    id: string,
  ): Promise<{ feedback: FeedbackListItem; comments: FeedbackCommentView[] }> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    const { items } = await this.list(user, 'all')
    const item = items.find((x) => x.id === id)
    if (!item) throw NotFound('Góp ý không tồn tại')
    const cs = await feedbackRepo.commentsFor(id)
    const names = await usersRepo.displayNamesByIds(
      cs.map((c) => c.author_id).filter((x): x is string => !!x),
    )
    return {
      feedback: item,
      comments: cs.map((c) => ({
        ...c,
        author_name: (c.author_id && names.get(c.author_id)) || 'Hệ thống',
        can_edit: canEditComment(c, cs, user.id),
      })),
    }
  },

  /** Danh sách người (đang hoạt động) cho nhắc tên @ và chọn người xác nhận. */
  async people(_user: User): Promise<{ id: string; name: string; department_id: string | null }[]> {
    const users = await usersRepo.list({ active_only: true })
    return users.map((u) => ({ id: u.id, name: u.name || u.email, department_id: u.department_id }))
  },

  // ── Ghi ──────────────────────────────────────────────────────────────────

  async create(user: User, input: FeedbackCreateInput): Promise<FeedbackRow> {
    const ctx = await ctxOf(user)
    const status = initialStatus(ctx.gateEnabled, ctx.actor)
    const fb = await feedbackRepo.insert({
      kind: input.kind,
      type: input.type,
      severity: input.severity,
      title: input.title || deriveTitle(input.content),
      content: input.content,
      page_url: input.page_url ?? null,
      page_title: input.page_title ?? null,
      is_private: input.is_private,
      topic: input.topic ?? guessTopic(input.page_url),
      status,
      created_by: user.id,
      department_id: user.department_id,
      file_ids: [],
    })
    const claimed = await claimFiles(input.file_ids, fb.id, user.id)
    const saved = claimed.length ? await feedbackRepo.update(fb.id, { file_ids: claimed }) : fb

    const gate = status === 'pending_review'
    const recipients = gate ? ctx.reviewers : await feedbackRepo.managerIds()
    await emit({
      name: 'feedback.created',
      feedback_id: saved.id,
      title: saved.title,
      actor_id: user.id,
      severity: saved.severity,
      gate,
      recipient_ids: recipients,
    })
    return saved
  },

  async update(user: User, id: string, input: FeedbackUpdateInput): Promise<FeedbackRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    const cs = await feedbackRepo.commentsFor(id)
    if (!canEditContent(fb, cs, ctx.actor)) {
      throw Forbidden('Góp ý đã có người phản hồi — không sửa được nữa, hãy trao đổi thêm bên dưới')
    }
    const patch: Partial<FeedbackRow> = { edited_at: new Date().toISOString() }
    if (input.kind !== undefined) patch.kind = input.kind
    if (input.type !== undefined) patch.type = input.type
    if (input.severity !== undefined) patch.severity = input.severity
    if (input.content !== undefined) patch.content = input.content
    if (input.title !== undefined) patch.title = input.title || deriveTitle(input.content ?? fb.content)
    if (input.is_private !== undefined) patch.is_private = input.is_private
    if (input.topic !== undefined) patch.topic = input.topic
    if (input.file_ids !== undefined) {
      const kept = input.file_ids.filter((f) => fb.file_ids.includes(f))
      const fresh = input.file_ids.filter((f) => !fb.file_ids.includes(f))
      patch.file_ids = [...kept, ...(await claimFiles(fresh, fb.id, user.id))]
    }
    return feedbackRepo.update(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    if (!canDelete(fb, ctx.actor)) {
      throw Forbidden('Góp ý đã được tiếp nhận — chỉ admin xoá được')
    }
    await feedbackRepo.delete(id)
  },

  async toggleVote(user: User, id: string): Promise<{ voted: boolean; count: number }> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    if (fb.created_by === user.id) throw BadRequest('Góp ý của chính bạn — không cần "tôi cũng gặp"')
    const voted = await feedbackRepo.toggleVote(id, user.id)
    const count = (await feedbackRepo.votesFor([id])).get(id)?.length ?? 0
    return { voted, count }
  },

  /** Admin / BOD xử lý: trạng thái, chủ đề, trả lời chính thức. */
  async process(user: User, id: string, input: FeedbackProcessInput): Promise<FeedbackRow> {
    await assertAction(user, 'feedback.manage')
    const fb = await load(id)
    const now = new Date().toISOString()
    const patch: Partial<FeedbackRow> = {}
    let round = fb.reopen_count
    if (input.status && input.status !== fb.status) {
      const p = applyManagerStatus(fb, input.status as FeedbackStatus, now)
      Object.assign(patch, p)
      round = p.reopen_count ?? fb.reopen_count
      await statusMarker(fb, input.status as FeedbackStatus, user, true, round)
    }
    if (input.topic !== undefined) patch.topic = input.topic
    if (input.reply) {
      patch.admin_reply = input.reply
      patch.admin_reply_by = user.id
      patch.admin_replied_at = now
      await feedbackRepo.insertComment({
        feedback_id: fb.id,
        kind: 'reply',
        content: input.reply,
        author_id: user.id,
        is_admin: true,
        round,
      })
    }
    const saved = Object.keys(patch).length ? await feedbackRepo.update(id, patch) : fb
    if (input.status || input.reply) {
      const cs = await feedbackRepo.commentsFor(id)
      await emit({
        name: 'feedback.processed',
        feedback_id: saved.id,
        title: saved.title,
        actor_id: user.id,
        status: saved.status,
        round: saved.reopen_count,
        replied: !!input.reply,
        recipient_ids: participantsOf(saved, cs),
      })
    }
    return saved
  },

  /** Người xác nhận: đồng ý → đội phát triển; trả lại → người viết. */
  async review(user: User, id: string, input: FeedbackReviewInput): Promise<FeedbackRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    if (!canReview(fb, ctx.actor)) {
      throw Forbidden('Chỉ người xác nhận xử lý góp ý đang chờ xác nhận')
    }
    const now = new Date().toISOString()
    const p = applyReview(fb, input.approve, input.note, now)
    const patch: Partial<FeedbackRow> = { ...p, reviewed_by: user.id, reviewed_at: now }
    if (input.approve && input.severity) patch.severity = input.severity
    await statusMarker(fb, p.status!, user, ctx.actor.canManage, p.reopen_count ?? fb.reopen_count)
    if (input.note) {
      await feedbackRepo.insertComment({
        feedback_id: fb.id,
        kind: 'comment',
        content: input.approve ? `Đã xác nhận: ${input.note}` : `Trả lại: ${input.note}`,
        author_id: user.id,
        is_admin: ctx.actor.canManage,
        round: p.reopen_count ?? fb.reopen_count,
      })
    }
    const saved = await feedbackRepo.update(id, patch)
    const cs = await feedbackRepo.commentsFor(id)
    const recipients = input.approve
      ? [...(await feedbackRepo.managerIds()), ...(saved.created_by ? [saved.created_by] : [])]
      : participantsOf(saved, cs)
    await emit({
      name: 'feedback.reviewed',
      feedback_id: saved.id,
      title: saved.title,
      actor_id: user.id,
      approved: input.approve,
      reason: input.note,
      recipient_ids: recipients,
    })
    return saved
  },

  async resubmit(user: User, id: string, content?: string): Promise<FeedbackRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    if (!canResubmit(fb, ctx.actor)) throw Forbidden('Chỉ gửi lại góp ý của mình đang bị trả lại')
    const now = new Date().toISOString()
    await statusMarker(fb, 'pending_review', user, false, fb.reopen_count)
    const saved = await feedbackRepo.update(id, {
      status: 'pending_review',
      submitted_at: now,
      returned_reason: null,
      returned_at: null,
      ...(content ? { content, edited_at: now } : {}),
    })
    await emit({
      name: 'feedback.resubmitted',
      feedback_id: saved.id,
      title: saved.title,
      actor_id: user.id,
      recipient_ids: ctx.reviewers,
    })
    return saved
  },

  /** Người viết bấm "Đã ổn" — khép vòng. */
  async confirmOk(user: User, id: string): Promise<FeedbackRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    if (!canConfirmOk(fb, ctx.actor)) throw Forbidden('Chỉ người viết bấm Đã ổn khi góp ý đã đẩy online')
    const now = new Date().toISOString()
    await feedbackRepo.insertComment({
      feedback_id: fb.id,
      kind: 'confirmed',
      content: 'Đã ổn',
      author_id: user.id,
      is_admin: false,
      round: fb.reopen_count,
    })
    const saved = await feedbackRepo.update(id, { confirmed_ok_at: now })
    await emit({
      name: 'feedback.confirmed',
      feedback_id: saved.id,
      title: saved.title,
      actor_id: user.id,
      recipient_ids: await feedbackRepo.managerIds(),
    })
    return saved
  },

  // ── Trao đổi ─────────────────────────────────────────────────────────────

  async addComment(
    user: User,
    id: string,
    input: FeedbackCommentCreateInput,
  ): Promise<FeedbackCommentRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    const now = new Date().toISOString()
    let patch: Partial<FeedbackRow> | null = null
    let round = fb.reopen_count
    if (input.needs_more) {
      if (!canAskMore(fb, ctx.actor)) {
        throw Forbidden('"Vẫn cần chỉnh thêm" chỉ dành cho người viết khi góp ý đã đẩy online')
      }
      patch = applyNeedsMore(fb, ctx.actor, ctx.gateEnabled, now)
      round = patch.reopen_count ?? round
      await statusMarker(fb, patch.status!, user, false, round)
    }
    const people = await usersRepo.list({ active_only: true })
    const mentionIds = extractMentions(
      input.content,
      people.map((p) => ({ id: p.id, name: p.name || p.email })),
    ).filter((m) => m !== user.id)
    const files = await claimFiles(input.file_ids, fb.id, user.id)
    const comment = await feedbackRepo.insertComment({
      feedback_id: fb.id,
      kind: input.needs_more ? 'needs_more' : ctx.actor.canManage ? 'reply' : 'comment',
      content: input.content || null,
      author_id: user.id,
      is_admin: ctx.actor.canManage,
      round,
      file_ids: files,
      mention_ids: mentionIds,
    })
    if (patch) await feedbackRepo.update(id, patch)
    else await feedbackRepo.update(id, { updated_at: now })

    const cs = await feedbackRepo.commentsFor(id)
    const recipients = new Set(participantsOf(fb, cs))
    // Nhân viên viết → báo cả người xử lý; góp ý còn ở cửa → báo người xác nhận thay.
    if (!ctx.actor.canManage) {
      const atGate = (patch?.status ?? fb.status) === 'pending_review' || fb.status === 'returned'
      for (const idm of atGate ? ctx.reviewers : await feedbackRepo.managerIds()) recipients.add(idm)
    }
    await emit({
      name: 'feedback.commented',
      feedback_id: fb.id,
      title: fb.title,
      actor_id: user.id,
      is_admin: ctx.actor.canManage,
      needs_more: input.needs_more,
      recipient_ids: [...recipients],
      mention_ids: mentionIds,
    })
    return comment
  },

  async updateComment(
    user: User,
    id: string,
    commentId: string,
    input: { content: string; file_ids?: string[] },
  ): Promise<FeedbackCommentRow> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    const cs = await feedbackRepo.commentsFor(id)
    const c = cs.find((x) => x.id === commentId)
    if (!c) throw NotFound('Dòng trao đổi không tồn tại')
    if (!canEditComment(c, cs, user.id)) {
      throw Forbidden('Đã có người viết sau dòng này — không sửa được nữa')
    }
    const people = await usersRepo.list({ active_only: true })
    const mentionIds = extractMentions(
      input.content,
      people.map((p) => ({ id: p.id, name: p.name || p.email })),
    ).filter((m) => m !== user.id)
    let fileIds = c.file_ids
    if (input.file_ids) {
      const kept = input.file_ids.filter((f) => c.file_ids.includes(f))
      const fresh = input.file_ids.filter((f) => !c.file_ids.includes(f))
      fileIds = [...kept, ...(await claimFiles(fresh, fb.id, user.id))]
    }
    return feedbackRepo.updateComment(commentId, {
      content: input.content,
      file_ids: fileIds,
      mention_ids: mentionIds,
      edited_at: new Date().toISOString(),
    })
  },

  async deleteComment(user: User, id: string, commentId: string): Promise<void> {
    const ctx = await ctxOf(user)
    const fb = await load(id)
    assertView(fb, ctx)
    const cs = await feedbackRepo.commentsFor(id)
    const c = cs.find((x) => x.id === commentId)
    if (!c) throw NotFound('Dòng trao đổi không tồn tại')
    if (!canEditComment(c, cs, user.id) && !ctx.actor.canManage) {
      throw Forbidden('Đã có người viết sau dòng này — không xoá được nữa')
    }
    if (c.kind !== 'comment' && c.kind !== 'reply') {
      throw BadRequest('Mốc trạng thái / xác nhận không xoá được')
    }
    await feedbackRepo.deleteComment(commentId)
  },

  // ── Người xác nhận ───────────────────────────────────────────────────────

  async reviewers(user: User): Promise<{
    ids: string[]
    candidates: { id: string; name: string }[]
    can_manage: boolean
  }> {
    const ids = await feedbackRepo.reviewerIds()
    const users = await usersRepo.list({ active_only: true })
    return {
      ids,
      candidates: users.map((u) => ({ id: u.id, name: u.name || u.email })),
      can_manage: user.role === 'admin',
    }
  },

  async setReviewers(user: User, ids: string[]): Promise<string[]> {
    if (user.role !== 'admin') throw Forbidden('Chỉ quản trị hệ thống đổi người xác nhận')
    const users = await usersRepo.list({ active_only: true })
    const valid = new Set(users.map((u) => u.id))
    const clean = [...new Set(ids)].filter((id) => valid.has(id))
    await feedbackRepo.setReviewerIds(clean)
    return clean
  },

  // ── Tóm tắt tuần ─────────────────────────────────────────────────────────

  async weekly(
    _user: User,
    weeks: number,
  ): Promise<
    { week_start: string; created: number; done: number; update: WeeklyUpdateRow | null }[]
  > {
    const start = new Date(weekStartOf(new Date()) + 'T00:00:00')
    start.setDate(start.getDate() - 7 * (weeks - 1))
    const sinceIso = start.toISOString()
    const [rows, updates] = await Promise.all([
      feedbackRepo.list({ since: sinceIso }),
      feedbackRepo.weeklySince(weekStartOf(start)),
    ])
    const allForDone = await feedbackRepo.list()
    const byWeek = new Map(updates.map((u) => [u.week_start, u]))
    const out = []
    for (let i = 0; i < weeks; i++) {
      const ws = new Date(start)
      ws.setDate(start.getDate() + 7 * i)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 7)
      const key = weekStartOf(ws)
      out.push({
        week_start: key,
        created: rows.filter((r) => {
          const d = new Date(r.created_at)
          return d >= ws && d < we
        }).length,
        done: allForDone.filter((r) => {
          if (!r.done_at) return false
          const d = new Date(r.done_at)
          return d >= ws && d < we
        }).length,
        update: byWeek.get(key) ?? null,
      })
    }
    return out.reverse()
  },

  async weeklyUpsert(
    user: User,
    input: { week_start: string; title: string; content: string },
  ): Promise<WeeklyUpdateRow> {
    await assertAction(user, 'feedback.manage')
    return feedbackRepo.weeklyUpsert({
      week_start: input.week_start,
      title: input.title || null,
      content: input.content,
      author_id: user.id,
    })
  },

  // ── Xuất cho AI ──────────────────────────────────────────────────────────

  async exportMarkdown(user: User, days: number): Promise<string> {
    await assertAction(user, 'feedback.manage')
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const items = await feedbackRepo.list({ since })
    const ids = items.map((i) => i.id)
    const [comments, votes, depts] = await Promise.all([
      feedbackRepo.commentsForMany(ids),
      feedbackRepo.votesFor(ids),
      departmentsRepo.list(),
    ])
    const userIds = new Set<string>()
    for (const it of items) {
      if (it.created_by) userIds.add(it.created_by)
      if (it.admin_reply_by) userIds.add(it.admin_reply_by)
    }
    for (const cs of comments.values()) for (const c of cs) if (c.author_id) userIds.add(c.author_id)
    const names = await usersRepo.displayNamesByIds([...userIds])
    return buildFeedbackMarkdown({
      items,
      comments,
      names,
      departments: new Map(depts.map((d) => [d.id, d.name])),
      votes,
      days,
      now: new Date(),
    })
  },

  // ── Cho module tệp ───────────────────────────────────────────────────────

  /** Ai xem được góp ý thì xem được tệp kèm (ảnh chụp màn hình). */
  async assertCanViewFile(user: User, feedbackId: string): Promise<void> {
    const ctx = await ctxOf(user)
    const fb = await load(feedbackId)
    assertView(fb, ctx)
  },

  /** Ai xem được thì đính được tệp (vào dòng trao đổi của mình). */
  async assertCanAttach(user: User, feedbackId: string): Promise<void> {
    await this.assertCanViewFile(user, feedbackId)
  },
}
