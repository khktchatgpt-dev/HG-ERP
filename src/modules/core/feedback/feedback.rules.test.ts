import { describe, expect, it } from 'vitest'
import {
  applyManagerStatus,
  applyNeedsMore,
  applyReview,
  canDelete,
  canEditComment,
  canEditContent,
  canView,
  initialStatus,
  isPendingIntake,
  isPendingReopen,
  type Actor,
  type CommentCore,
  type FeedbackCore,
} from './feedback.rules'

const T0 = '2026-10-20T08:00:00.000Z'
const T1 = '2026-10-20T09:00:00.000Z'
const T2 = '2026-10-20T10:00:00.000Z'

const author: Actor = { id: 'u1', canManage: false, isReviewer: false }
const other: Actor = { id: 'u2', canManage: false, isReviewer: false }
const admin: Actor = { id: 'adm', canManage: true, isReviewer: false }
const reviewer: Actor = { id: 'rev', canManage: false, isReviewer: true }

const fb = (over: Partial<FeedbackCore> = {}): FeedbackCore => ({
  id: 'f1',
  status: 'new',
  created_by: 'u1',
  reopen_count: 0,
  reopened_at: null,
  done_at: null,
  gate_passed_at: null,
  admin_reply: null,
  submitted_at: T0,
  confirmed_ok_at: null,
  is_private: false,
  ...over,
})
const cm = (over: Partial<CommentCore>): CommentCore => ({
  id: 'c',
  kind: 'comment',
  author_id: 'u2',
  created_at: T1,
  ...over,
})

describe('cửa xác nhận (GopYCuaXacNhanTest)', () => {
  it('cửa tắt → mới; cửa bật → chờ xác nhận, trừ admin và người xác nhận', () => {
    expect(initialStatus(false, author)).toBe('new')
    expect(initialStatus(true, author)).toBe('pending_review')
    expect(initialStatus(true, admin)).toBe('new')
    expect(initialStatus(true, reviewer)).toBe('new')
  })

  it('đồng ý lần đầu → mới, ghi mốc qua cửa; trả lại → trả lại người viết kèm lý do', () => {
    const p = fb({ status: 'pending_review' })
    expect(applyReview(p, true, '', T1)).toMatchObject({ status: 'new', gate_passed_at: T1 })
    expect(applyReview(p, false, 'thiếu ảnh', T1)).toMatchObject({
      status: 'returned',
      returned_reason: 'thiếu ảnh',
    })
  })

  it('vòng mở lại qua cửa: đồng ý → cần chỉnh thêm; trả lại → về DONE, vòng −1', () => {
    const p = fb({
      status: 'pending_review',
      reopen_count: 1,
      done_at: T0,
      reopened_at: T1,
      gate_passed_at: T0,
    })
    expect(isPendingReopen(p)).toBe(true)
    expect(applyReview(p, true, '', T2).status).toBe('reopened')
    expect(applyReview(p, false, 'đã đúng rồi', T2)).toMatchObject({
      status: 'done',
      reopen_count: 0,
      reopened_at: null,
    })
  })

  it('lần gửi đầu không phải vòng mở lại dù reopened_at cũ hơn done_at', () => {
    expect(isPendingReopen(fb({ status: 'pending_review' }))).toBe(false)
    expect(
      isPendingReopen(fb({ status: 'pending_review', reopened_at: T0, done_at: T1 })),
    ).toBe(false)
  })
})

describe('"vẫn cần chỉnh thêm" (GopYTraoDoiTest)', () => {
  it('cửa tắt → cần chỉnh thêm ngay, vòng +1, xoá đã ổn', () => {
    const done = fb({ status: 'done', done_at: T0, confirmed_ok_at: T0, gate_passed_at: T0 })
    expect(applyNeedsMore(done, author, false, T1)).toEqual({
      status: 'reopened',
      reopen_count: 1,
      reopened_at: T1,
      confirmed_ok_at: null,
    })
  })
  it('cửa bật → qua chờ xác nhận trước; người xác nhận viết thì vào thẳng', () => {
    const done = fb({ status: 'done', done_at: T0, gate_passed_at: T0 })
    expect(applyNeedsMore(done, author, true, T1).status).toBe('pending_review')
    expect(applyNeedsMore({ ...done, created_by: 'rev' }, reviewer, true, T1).status).toBe(
      'reopened',
    )
  })
  it('admin đặt DONE ghi done_at; đặt REOPENED là vòng mới', () => {
    expect(applyManagerStatus(fb(), 'done', T1)).toMatchObject({ status: 'done', done_at: T1 })
    expect(
      applyManagerStatus(fb({ status: 'done', confirmed_ok_at: T0 }), 'reopened', T1),
    ).toMatchObject({ status: 'reopened', reopen_count: 1, confirmed_ok_at: null })
  })
})

describe('luật tự sửa / xoá (GopYSuaTest)', () => {
  it('người viết sửa được khi mới chưa qua cửa và chưa ai phản hồi', () => {
    expect(canEditContent(fb(), [], author)).toBe(true)
    expect(canEditContent(fb(), [], other)).toBe(false)
  })
  it('người khác đã viết sau lần gửi → hết sửa; mốc trạng thái không tính; chính mình viết không tính', () => {
    expect(canEditContent(fb(), [cm({})], author)).toBe(false)
    expect(canEditContent(fb(), [cm({ kind: 'status', author_id: 'adm' })], author)).toBe(true)
    expect(canEditContent(fb(), [cm({ author_id: 'u1' })], author)).toBe(true)
  })
  it('có trả lời admin → hết sửa; đã qua cửa (NEW) → hết sửa; bị trả lại → luôn sửa được', () => {
    expect(canEditContent(fb({ admin_reply: 'ok' }), [], author)).toBe(false)
    expect(canEditContent(fb({ gate_passed_at: T0 }), [], author)).toBe(false)
    expect(canEditContent(fb({ status: 'returned', gate_passed_at: T0 }), [cm({})], author)).toBe(
      true,
    )
  })
  it('chờ xác nhận lần đầu sửa được, vòng mở lại thì không', () => {
    expect(canEditContent(fb({ status: 'pending_review' }), [], author)).toBe(true)
    expect(
      canEditContent(fb({ status: 'pending_review', reopen_count: 1, reopened_at: T1 }), [], author),
    ).toBe(false)
  })
  it('phản hồi TRƯỚC lần gửi lại không đếm (gửi lại = mốc mới)', () => {
    const resent = fb({ status: 'pending_review', submitted_at: T2 })
    expect(canEditContent(resent, [cm({ created_at: T1 })], author)).toBe(true)
  })
  it('xoá: người viết khi chưa tiếp nhận, admin bất kỳ', () => {
    expect(isPendingIntake(fb())).toBe(true)
    expect(canDelete(fb(), author)).toBe(true)
    expect(canDelete(fb({ gate_passed_at: T0 }), author)).toBe(false)
    expect(canDelete(fb({ status: 'reviewing', gate_passed_at: T0 }), admin)).toBe(true)
    expect(canDelete(fb({ status: 'returned' }), author)).toBe(true)
  })
  it('sửa dòng trao đổi: chỉ của mình, khi chưa ai khác viết sau', () => {
    const mine = cm({ id: 'a', author_id: 'u1', created_at: T1 })
    const later = cm({ id: 'b', author_id: 'u2', created_at: T2 })
    const marker = cm({ id: 'm', kind: 'status', author_id: 'adm', created_at: T2 })
    expect(canEditComment(mine, [mine], 'u1')).toBe(true)
    expect(canEditComment(mine, [mine, marker], 'u1')).toBe(true)
    expect(canEditComment(mine, [mine, later], 'u1')).toBe(false)
    expect(canEditComment(mine, [mine], 'u2')).toBe(false)
  })
  it('"vẫn cần chỉnh thêm" / "đã ổn" / mốc trạng thái là vết của luồng — không sửa được', () => {
    const more = cm({ id: 'n', kind: 'needs_more', author_id: 'u1', created_at: T1 })
    const ok = cm({ id: 'o', kind: 'confirmed', author_id: 'u1', created_at: T1 })
    expect(canEditComment(more, [more], 'u1')).toBe(false)
    expect(canEditComment(ok, [ok], 'u1')).toBe(false)
  })
})

describe('riêng tư', () => {
  it('chỉ người viết, admin, người xác nhận thấy', () => {
    const p = fb({ is_private: true })
    expect(canView(p, author)).toBe(true)
    expect(canView(p, admin)).toBe(true)
    expect(canView(p, reviewer)).toBe(true)
    expect(canView(p, other)).toBe(false)
    expect(canView(fb(), other)).toBe(true)
  })
})
