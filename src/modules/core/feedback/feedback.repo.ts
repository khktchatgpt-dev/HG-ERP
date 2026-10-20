import { db } from '@/server/db'
import type { CommentKind, FeedbackStatus } from '@/lib/feedback-labels'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'

export type FeedbackRow = {
  id: string
  kind: string
  type: string
  severity: string
  title: string
  content: string
  page_url: string | null
  page_title: string | null
  is_private: boolean
  topic: string | null
  status: FeedbackStatus
  reopen_count: number
  reopened_at: string | null
  confirmed_ok_at: string | null
  gate_passed_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  returned_reason: string | null
  returned_at: string | null
  submitted_at: string
  admin_reply: string | null
  admin_reply_by: string | null
  admin_replied_at: string | null
  done_at: string | null
  created_by: string | null
  department_id: string | null
  file_ids: string[]
  edited_at: string | null
  created_at: string
  updated_at: string
}

export type FeedbackCommentRow = {
  id: string
  feedback_id: string
  kind: CommentKind
  content: string | null
  author_id: string | null
  is_admin: boolean
  round: number
  from_status: string | null
  to_status: string | null
  file_ids: string[]
  mention_ids: string[]
  edited_at: string | null
  created_at: string
}

export type WeeklyUpdateRow = {
  id: string
  week_start: string
  title: string | null
  content: string
  author_id: string | null
  created_at: string
  updated_at: string
}

/** Tóm tắt luồng trao đổi của một góp ý — đủ để xếp cột, đếm và xét luật sửa. */
export type CommentDigest = {
  count: number
  participants: string[]
  last_at: string | null
}

const COLS = '*'
const SETTINGS_KEY = 'feedback_reviewers'

export const feedbackRepo = {
  async insert(row: {
    kind: string
    type: string
    severity: string
    title: string
    content: string
    page_url: string | null
    page_title: string | null
    is_private: boolean
    topic: string | null
    status: FeedbackStatus
    created_by: string
    department_id: string | null
    file_ids: string[]
  }): Promise<FeedbackRow> {
    const { data, error } = await db().from('feedback').insert(row).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'feedback insert failed')
    return data as FeedbackRow
  },

  async findById(id: string): Promise<FeedbackRow | null> {
    const { data } = await db().from('feedback').select(COLS).eq('id', id).maybeSingle()
    return (data as FeedbackRow | null) ?? null
  },

  async update(id: string, patch: Partial<FeedbackRow>): Promise<FeedbackRow> {
    const { data, error } = await db()
      .from('feedback')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'feedback update failed')
    return data as FeedbackRow
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('feedback').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Mới nhất trước. `since` lọc theo ngày tạo (xuất Markdown N ngày). */
  async list(opts: { since?: string; limit?: number } = {}): Promise<FeedbackRow[]> {
    let q = db().from('feedback').select(COLS).order('created_at', { ascending: false })
    if (opts.since) q = q.gte('created_at', opts.since)
    const { data } = await q.limit(opts.limit ?? 2000)
    return (data ?? []) as FeedbackRow[]
  },

  // ── Vote "tôi cũng gặp" ──────────────────────────────────────────────────

  async votesFor(ids: string[]): Promise<Map<string, string[]>> {
    const m = new Map<string, string[]>()
    if (ids.length === 0) return m
    const { data } = await db()
      .from('feedback_votes')
      .select('feedback_id, user_id')
      .in('feedback_id', ids)
    for (const r of (data ?? []) as { feedback_id: string; user_id: string }[]) {
      const arr = m.get(r.feedback_id) ?? []
      arr.push(r.user_id)
      m.set(r.feedback_id, arr)
    }
    return m
  },

  /** Bật / tắt vote. Trả `true` nếu sau thao tác đang vote. */
  async toggleVote(feedbackId: string, userId: string): Promise<boolean> {
    const { data } = await db()
      .from('feedback_votes')
      .select('user_id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) {
      await db()
        .from('feedback_votes')
        .delete()
        .eq('feedback_id', feedbackId)
        .eq('user_id', userId)
      return false
    }
    const { error } = await db()
      .from('feedback_votes')
      .insert({ feedback_id: feedbackId, user_id: userId })
    if (error) throw new Error(error.message)
    return true
  },

  // ── Trao đổi ─────────────────────────────────────────────────────────────

  async commentsFor(feedbackId: string): Promise<FeedbackCommentRow[]> {
    const { data } = await db()
      .from('feedback_comments')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true })
    return (data ?? []) as FeedbackCommentRow[]
  },

  /** Toàn bộ dòng trao đổi của một nhóm góp ý — một query cho cả trang danh sách. */
  async commentsForMany(ids: string[]): Promise<Map<string, FeedbackCommentRow[]>> {
    const m = new Map<string, FeedbackCommentRow[]>()
    if (ids.length === 0) return m
    const { data } = await db()
      .from('feedback_comments')
      .select('id, feedback_id, kind, author_id, created_at, is_admin, round, content, from_status, to_status, file_ids, mention_ids, edited_at')
      .in('feedback_id', ids)
      .order('created_at', { ascending: true })
      .limit(20000)
    for (const r of (data ?? []) as FeedbackCommentRow[]) {
      const arr = m.get(r.feedback_id) ?? []
      arr.push(r)
      m.set(r.feedback_id, arr)
    }
    return m
  },

  async findComment(id: string): Promise<FeedbackCommentRow | null> {
    const { data } = await db().from('feedback_comments').select('*').eq('id', id).maybeSingle()
    return (data as FeedbackCommentRow | null) ?? null
  },

  async insertComment(row: {
    feedback_id: string
    kind: CommentKind
    content: string | null
    author_id: string
    is_admin: boolean
    round: number
    from_status?: string | null
    to_status?: string | null
    file_ids?: string[]
    mention_ids?: string[]
  }): Promise<FeedbackCommentRow> {
    const { data, error } = await db()
      .from('feedback_comments')
      .insert(row)
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'comment insert failed')
    return data as FeedbackCommentRow
  },

  async updateComment(
    id: string,
    patch: { content?: string; file_ids?: string[]; mention_ids?: string[]; edited_at: string },
  ): Promise<FeedbackCommentRow> {
    const { data, error } = await db()
      .from('feedback_comments')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'comment update failed')
    return data as FeedbackCommentRow
  },

  async deleteComment(id: string): Promise<void> {
    const { error } = await db().from('feedback_comments').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  // ── Tóm tắt tuần ─────────────────────────────────────────────────────────

  async weeklySince(weekStart: string): Promise<WeeklyUpdateRow[]> {
    const { data } = await db()
      .from('feedback_weekly_updates')
      .select('*')
      .gte('week_start', weekStart)
      .order('week_start', { ascending: false })
    return (data ?? []) as WeeklyUpdateRow[]
  },

  async weeklyUpsert(row: {
    week_start: string
    title: string | null
    content: string
    author_id: string
  }): Promise<WeeklyUpdateRow> {
    const { data, error } = await db()
      .from('feedback_weekly_updates')
      .upsert(row, { onConflict: 'week_start' })
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'weekly upsert failed')
    return data as WeeklyUpdateRow
  },

  // ── Người xác nhận (bảng settings, key feedback_reviewers) ───────────────

  async reviewerIds(): Promise<string[]> {
    const { data } = await db()
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    const v = (data as { value: unknown } | null)?.value
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  },

  async setReviewerIds(ids: string[]): Promise<void> {
    const { error } = await db()
      .from('settings')
      .upsert({ key: SETTINGS_KEY, value: ids })
    if (error) throw new Error(error.message)
  },

  /**
   * Người XỬ LÝ góp ý: admin (cột users.role) + ai được cấp `feedback.manage`
   * qua RBAC (seed: director). Chỉ tài khoản đang hoạt động.
   */
  async managerIds(): Promise<string[]> {
    const [{ data }, byPerm] = await Promise.all([
      db().from('users').select('id').eq('role', 'admin').eq('is_active', true).is('deleted_at', null),
      rbacRepo.userIdsWithPermission('feedback.manage'),
    ])
    const ids = new Set<string>((data ?? []).map((u: { id: string }) => u.id))
    for (const id of byPerm) ids.add(id)
    return [...ids]
  },

  /** Số góp ý đã đẩy online theo mốc done_at trong [from, to). */
  async doneBetween(from: string, to: string): Promise<number> {
    const { count } = await db()
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .gte('done_at', from)
      .lt('done_at', to)
    return count ?? 0
  },
}
