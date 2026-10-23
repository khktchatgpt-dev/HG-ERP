import type { CommentKind, FeedbackStatus } from './feedback-labels'

/**
 * Hình dữ liệu API góp ý trả cho CLIENT — chép tay từ `feedback.service` (client
 * không được import `src/modules/*`). Đổi bên kia thì đổi đây.
 */
export type FeedbackItem = {
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
  author_name: string
  department_name: string | null
  vote_count: number
  voted: boolean
  comment_count: number
  participated: boolean
  last_activity_at: string
  can_edit: boolean
  can_delete: boolean
  can_confirm_ok: boolean
  can_ask_more: boolean
  can_review: boolean
  can_resubmit: boolean
}

export type FeedbackMeta = {
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

export type FeedbackComment = {
  id: string
  feedback_id: string
  kind: CommentKind
  content: string | null
  author_id: string | null
  author_name: string
  is_admin: boolean
  round: number
  from_status: string | null
  to_status: string | null
  file_ids: string[]
  mention_ids: string[]
  edited_at: string | null
  created_at: string
  can_edit: boolean
}

export type FeedbackPerson = { id: string; name: string; department_id: string | null }

export type FeedbackWeek = {
  week_start: string
  created: number
  done: number
  update: {
    id: string
    week_start: string
    title: string | null
    content: string
    author_id: string | null
    updated_at: string
  } | null
}
