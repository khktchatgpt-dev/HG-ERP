import type { FeedbackStatus } from '@/lib/feedback-labels'

/**
 * LUẬT NGHIỆP VỤ CỦA GÓP Ý — thuần, không DB, để test được đúng các hành vi
 * bản gốc đã chốt với người dùng thật (README gói, mục 4 & 8):
 *   · cửa xác nhận tuỳ chọn (có người xác nhận = bật),
 *   · người viết tự sửa / xoá khi chưa ai phản hồi,
 *   · "vẫn cần chỉnh thêm" mở lại CÙNG góp ý (vòng +1), có cửa thì qua cửa trước,
 *   · người viết bấm "Đã ổn" mới là xong.
 * Service chỉ nạp dữ liệu, gọi vào đây rồi ghi patch trả về.
 */

export type FeedbackCore = {
  id: string
  status: FeedbackStatus
  created_by: string | null
  reopen_count: number
  reopened_at: string | null
  done_at: string | null
  gate_passed_at: string | null
  admin_reply: string | null
  submitted_at: string
  confirmed_ok_at: string | null
  is_private: boolean
}

export type CommentCore = {
  id: string
  kind: 'comment' | 'reply' | 'needs_more' | 'confirmed' | 'status'
  author_id: string | null
  created_at: string
}

/** Người đang thao tác, đã quy về ba cờ mà luật cần. */
export type Actor = {
  id: string
  /** admin / BOD (quyền `feedback.manage`). */
  canManage: boolean
  /** nằm trong danh sách người xác nhận. */
  isReviewer: boolean
}

export type FeedbackPatch = Partial<
  Pick<
    FeedbackCore,
    'status' | 'reopen_count' | 'reopened_at' | 'done_at' | 'gate_passed_at' | 'confirmed_ok_at'
  >
> & { returned_reason?: string | null; returned_at?: string | null }

/** Cửa bật và người viết không phải người xác nhận / admin → chờ xác nhận. */
export function initialStatus(gateEnabled: boolean, actor: Actor): FeedbackStatus {
  return gateEnabled && !actor.canManage && !actor.isReviewer ? 'pending_review' : 'new'
}

/** Ai xem được: công khai thì mọi người; riêng tư thì người viết + admin + người xác nhận. */
export function canView(fb: Pick<FeedbackCore, 'is_private' | 'created_by'>, actor: Actor): boolean {
  if (!fb.is_private) return true
  return fb.created_by === actor.id || actor.canManage || actor.isReviewer
}

/** Chưa được tiếp nhận: chờ xác nhận, bị trả lại, hoặc mới mà chưa qua cửa. */
export function isPendingIntake(fb: FeedbackCore): boolean {
  return (
    fb.status === 'pending_review' ||
    fb.status === 'returned' ||
    (fb.status === 'new' && !fb.gate_passed_at)
  )
}

/** Đang chờ xác nhận vì một VÒNG MỞ LẠI (không phải lần gửi đầu). */
export function isPendingReopen(fb: FeedbackCore): boolean {
  if (fb.status !== 'pending_review' || !fb.reopened_at) return false
  return !fb.done_at || fb.reopened_at > fb.done_at
}

/** Có ai KHÁC người viết góp gì vào luồng kể từ lần gửi / gửi lại gần nhất không (mốc trạng thái không tính). */
function othersRepliedSince(fb: FeedbackCore, comments: readonly CommentCore[]): boolean {
  return comments.some(
    (c) => c.kind !== 'status' && c.author_id !== fb.created_by && c.created_at >= fb.submitted_at,
  )
}

/**
 * Người viết tự sửa nội dung khi: bị trả lại (luôn được); hoặc chờ xác nhận lần
 * đầu / mới chưa qua cửa — VÀ chưa có trả lời admin VÀ chưa ai khác viết gì từ
 * lần gửi gần nhất. Admin sửa được mọi lúc.
 */
export function canEditContent(
  fb: FeedbackCore,
  comments: readonly CommentCore[],
  actor: Actor,
): boolean {
  if (actor.canManage) return true
  if (fb.created_by !== actor.id) return false
  if (fb.status === 'returned') return true
  const firstPending = fb.status === 'pending_review' && fb.reopen_count === 0
  const freshNew = fb.status === 'new' && !fb.gate_passed_at
  if (!firstPending && !freshNew) return false
  if (fb.admin_reply) return false
  return !othersRepliedSince(fb, comments)
}

/** Người viết xoá khi chưa tiếp nhận; admin xoá bất kỳ. */
export function canDelete(fb: FeedbackCore, actor: Actor): boolean {
  if (actor.canManage) return true
  return fb.created_by === actor.id && isPendingIntake(fb)
}

/** Sửa / xoá một dòng trao đổi: chỉ người viết dòng, khi chưa ai khác viết sau nó. */
export function canEditComment(
  comment: CommentCore,
  comments: readonly CommentCore[],
  actorId: string,
): boolean {
  if (comment.author_id !== actorId) return false
  if (comment.kind === 'status') return false
  return !comments.some(
    (c) =>
      c.kind !== 'status' &&
      c.author_id !== actorId &&
      (c.created_at > comment.created_at ||
        (c.created_at === comment.created_at && c.id > comment.id)),
  )
}

/** Người viết bấm "Đã ổn" — chỉ khi đã đẩy online và chưa bấm. */
export function canConfirmOk(fb: FeedbackCore, actor: Actor): boolean {
  return fb.created_by === actor.id && fb.status === 'done' && !fb.confirmed_ok_at
}

/** Người viết bấm "Vẫn cần chỉnh thêm" — chỉ khi đã đẩy online. */
export function canAskMore(fb: FeedbackCore, actor: Actor): boolean {
  return fb.created_by === actor.id && fb.status === 'done'
}

/**
 * "Vẫn cần chỉnh thêm": mở lại cùng góp ý, vòng +1, xoá "Đã ổn". Cửa bật và
 * người viết không phải người xác nhận / admin → qua cửa trước (pending_review).
 */
export function applyNeedsMore(
  fb: FeedbackCore,
  actor: Actor,
  gateEnabled: boolean,
  now: string,
): FeedbackPatch {
  const viaGate = gateEnabled && !actor.canManage && !actor.isReviewer
  return {
    status: viaGate ? 'pending_review' : 'reopened',
    reopen_count: fb.reopen_count + 1,
    reopened_at: now,
    confirmed_ok_at: null,
  }
}

/**
 * Người xác nhận xử lý góp ý đang chờ: đồng ý → vào đội phát triển (mới, hoặc
 * "cần chỉnh thêm" nếu là vòng mở lại); trả lại → về người viết, riêng vòng mở
 * lại bị trả lại thì về DONE và vòng −1 (như chưa từng mở lại).
 */
export function applyReview(
  fb: FeedbackCore,
  approve: boolean,
  reason: string,
  now: string,
): FeedbackPatch {
  const reopen = isPendingReopen(fb)
  if (approve) {
    return {
      status: reopen ? 'reopened' : 'new',
      gate_passed_at: now,
      returned_reason: null,
      returned_at: null,
    }
  }
  if (reopen) {
    return {
      status: 'done',
      reopen_count: Math.max(0, fb.reopen_count - 1),
      reopened_at: null,
      returned_reason: reason,
      returned_at: now,
    }
  }
  return { status: 'returned', returned_reason: reason, returned_at: now }
}

/** Người viết gửi lại góp ý bị trả lại → chờ xác nhận, mốc gửi mới. */
export function canResubmit(fb: FeedbackCore, actor: Actor): boolean {
  return fb.created_by === actor.id && fb.status === 'returned'
}

/**
 * Admin đặt trạng thái: DONE ghi `done_at`; REOPENED là vòng mới (+1, xoá "Đã
 * ổn"); đặt gì cũng coi như đã qua cửa (admin không cần người xác nhận).
 */
export function applyManagerStatus(
  fb: FeedbackCore,
  to: FeedbackStatus,
  now: string,
): FeedbackPatch {
  const patch: FeedbackPatch = { status: to, gate_passed_at: fb.gate_passed_at ?? now }
  if (to === 'done') patch.done_at = now
  if (to === 'reopened') {
    patch.reopen_count = fb.reopen_count + 1
    patch.reopened_at = now
    patch.confirmed_ok_at = null
  }
  return patch
}

/** Người xác nhận được bấm Đồng ý / Trả lại trên góp ý này không. */
export function canReview(fb: FeedbackCore, actor: Actor): boolean {
  return fb.status === 'pending_review' && (actor.isReviewer || actor.canManage)
}
