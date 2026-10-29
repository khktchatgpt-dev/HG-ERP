import { describe, expect, it } from 'vitest'
import {
  actionBlock,
  allowedActions,
  dueBlock,
  matchesFilter,
  overdueDays,
  requestActionSchema,
  requestCreateSchema,
  requestRecipients,
  requestState,
  sortRequests,
  summarizeRequests,
  traceText,
  transitionPatch,
  type DocRequest,
} from './doc-requests'

/*
  Ví dụ bám bản vẽ duyệt 29/10: Thảo (quản lý Cung ứng) giao Phương (Bán hàng)
  bổ sung ảnh trên lệnh 01/26-27 - LAURA. UUID thật — Zod 4 kiểm bit phiên bản.
*/
const LSX = '3a1ec4a4-83c7-4f94-bb36-74b204ee6311'
const TODAY = '2026-10-29'

const REQ = (over: Partial<DocRequest> = {}): DocRequest => ({
  id: 'r1',
  doc_type: 'lsx',
  doc_id: LSX,
  author_id: 'u-thao',
  author_name: 'Thảo',
  audience: 'internal',
  body: 'Bổ sung ảnh SP cho 55 dòng còn trống',
  reply_to: null,
  created_at: '2026-10-29T02:12:00Z',
  deleted_at: null,
  kind: 'request',
  assignee_id: 'u-phuong',
  assignee_name: 'Phương',
  due_on: '2026-10-31',
  resolved_at: null,
  resolved_by: null,
  resolved_how: null,
  ...over,
})
const DONE = { resolved_at: '2026-10-28T03:00:00Z', resolved_how: 'done' as const }
const THAO = { id: 'u-thao', isAdmin: false }
const PHUONG = { id: 'u-phuong', isAdmin: false }
const NGA = { id: 'u-nga', isAdmin: false }
const ADMIN = { id: 'u-admin', isAdmin: true }

describe('requestState', () => {
  it('đọc trạng thái từ resolved_* — không có cột trạng thái riêng', () => {
    expect(requestState(REQ())).toBe('open')
    expect(requestState(REQ(DONE))).toBe('done')
    expect(requestState(REQ({ resolved_at: 'x', resolved_how: 'cancelled' }))).toBe(
      'cancelled',
    )
    expect(requestState(REQ({ resolved_at: 'x', resolved_how: 'closed' }))).toBe('closed')
  })
})

describe('overdueDays', () => {
  it('hạn đúng hôm nay chưa quá; qua một ngày là 1', () => {
    expect(overdueDays(REQ({ due_on: TODAY }), TODAY)).toBe(0)
    expect(overdueDays(REQ({ due_on: '2026-10-28' }), TODAY)).toBe(1)
    expect(overdueDays(REQ({ due_on: '2026-09-30' }), TODAY)).toBe(29)
  })
  it('không hạn, hoặc đã đóng thì không bao giờ quá hạn', () => {
    expect(overdueDays(REQ({ due_on: null }), TODAY)).toBe(0)
    expect(overdueDays(REQ({ due_on: '2026-10-01', ...DONE }), TODAY)).toBe(0)
  })
})

describe('actionBlock — ai bấm được gì', () => {
  it('người nhận: báo xong + chuyển người; không huỷ, không mở lại', () => {
    expect(allowedActions(REQ(), PHUONG)).toEqual(['done', 'reassign'])
    expect(actionBlock(REQ(), 'cancel', PHUONG)).toEqual({ kind: 'who', message: 'Chỉ Thảo huỷ được yêu cầu này' }) // prettier-ignore
  })
  it('người giao: báo xong thay, chuyển, huỷ', () => {
    expect(allowedActions(REQ(), THAO)).toEqual(['done', 'reassign', 'cancel'])
  })
  it('người ngoài cuộc: không làm được gì, câu chặn nói nhờ ai', () => {
    expect(allowedActions(REQ(), NGA)).toEqual([])
    expect(actionBlock(REQ(), 'done', NGA)).toEqual({ kind: 'who', message: 'Chỉ Phương hoặc Thảo báo xong được' }) // prettier-ignore
  })
  it('admin đóng vai người giao — người giao nghỉ việc thì vẫn có người dọn', () => {
    expect(allowedActions(REQ(), ADMIN)).toEqual(['done', 'reassign', 'cancel'])
    expect(allowedActions(REQ(DONE), ADMIN)).toEqual(['reopen'])
  })
  it('đã xong: chỉ người giao mở lại; báo xong lần nữa bị chặn theo LÚC, không theo người', () => {
    expect(allowedActions(REQ(DONE), THAO)).toEqual(['reopen'])
    expect(allowedActions(REQ(DONE), PHUONG)).toEqual([])
    expect(actionBlock(REQ(DONE), 'done', PHUONG)).toEqual({ kind: 'state', message: 'Yêu cầu đã xong — mở lại trước nếu cần làm tiếp' }) // prettier-ignore
    expect(actionBlock(REQ(DONE), 'reopen', PHUONG)?.kind).toBe('who')
  })
  it('đã huỷ / đóng theo chứng từ: không mở lại — giao mới', () => {
    const huy = REQ({ resolved_at: 'x', resolved_how: 'cancelled' })
    expect(allowedActions(huy, THAO)).toEqual([])
    expect(actionBlock(huy, 'reopen', THAO)?.message).toBe('Yêu cầu đã huỷ — giao một yêu cầu mới nếu vẫn cần') // prettier-ignore
    const dong = REQ({ resolved_at: 'x', resolved_how: 'closed' })
    expect(actionBlock(dong, 'done', PHUONG)?.message).toMatch(/Chứng từ đã huỷ/)
  })
  it('đang mở thì "mở lại" bị chặn; đã gỡ thì chặn mọi bước', () => {
    expect(actionBlock(REQ(), 'reopen', THAO)).toEqual({ kind: 'state', message: 'Yêu cầu đang mở rồi' }) // prettier-ignore
    expect(allowedActions(REQ({ deleted_at: 'x' }), THAO)).toEqual([])
  })
})

describe('dueBlock', () => {
  it('nhận hôm nay trở đi hoặc bỏ trống; chặn ngày đã qua', () => {
    expect(dueBlock(TODAY, TODAY)).toBeNull()
    expect(dueBlock(null, TODAY)).toBeNull()
    expect(dueBlock('2026-10-28', TODAY)).toMatch(/Hạn đã qua/)
  })
})

describe('transitionPatch', () => {
  const NOW = '2026-10-29T03:00:00.000Z'
  it('báo xong / huỷ đòi đang mở; mở lại đòi đã xong và xoá sạch resolved_*', () => {
    expect(transitionPatch('done', 'u-phuong', NOW)).toEqual({ expect: 'open', patch: { resolved_at: NOW, resolved_by: 'u-phuong', resolved_how: 'done' } }) // prettier-ignore
    expect(transitionPatch('cancel', 'u-thao', NOW).patch.resolved_how).toBe('cancelled')
    expect(transitionPatch('reopen', 'u-thao', NOW)).toEqual({ expect: 'done', patch: { resolved_at: null, resolved_by: null, resolved_how: null } }) // prettier-ignore
  })
  it('chuyển người chỉ đổi người nhận, vẫn đang mở', () => {
    expect(transitionPatch('reassign', 'u-thao', NOW, 'u-hang')).toEqual({ expect: 'open', patch: { assignee_id: 'u-hang' } }) // prettier-ignore
    expect(() => transitionPatch('reassign', 'u-thao', NOW)).toThrow()
  })
})

describe('traceText — câu ghi vào trao đổi của chứng từ', () => {
  it('mỗi bước một câu đọc được', () => {
    expect(traceText('done', ' Đã tải ảnh 55 SP ')).toBe('Xong: Đã tải ảnh 55 SP')
    expect(traceText('reopen', 'Còn 6 SP chưa có ảnh')).toBe(
      'Mở lại: Còn 6 SP chưa có ảnh',
    )
    expect(traceText('cancel', 'Khách đổi mẫu')).toBe('Huỷ yêu cầu: Khách đổi mẫu')
    expect(traceText('reassign', '', 'Minh Hằng')).toBe('Chuyển yêu cầu cho Minh Hằng')
    expect(traceText('reassign', 'Phương nghỉ phép', 'Minh Hằng')).toBe('Chuyển yêu cầu cho Minh Hằng — Phương nghỉ phép') // prettier-ignore
    expect(traceText('closed', null)).toBe('Đóng yêu cầu: chứng từ đã huỷ')
  })
})

describe('requestRecipients — mọi người dính tới, trừ người vừa bấm', () => {
  it('giao → người nhận; báo xong → người giao', () => {
    expect(requestRecipients(REQ(), 'u-thao')).toEqual(['u-phuong'])
    expect(requestRecipients(REQ(), 'u-phuong')).toEqual(['u-thao'])
  })
  it('người giao tự báo xong thay → báo người nhận; chuyển → cả cũ lẫn mới', () => {
    expect(requestRecipients(REQ(), 'u-thao')).toEqual(['u-phuong'])
    expect(requestRecipients(REQ(), 'u-thao', ['u-hang'])).toEqual(['u-phuong', 'u-hang'])
  })
  it('tự giao cho mình thì không ai bị báo', () => {
    expect(requestRecipients(REQ({ assignee_id: 'u-thao' }), 'u-thao')).toEqual([])
  })
})

describe('matchesFilter + summarizeRequests — chip đếm đúng danh sách nó mở', () => {
  const list = [
    REQ({ id: 'mo', due_on: '2026-10-31' }),
    REQ({ id: 'qua', due_on: '2026-10-28' }),
    REQ({ id: 'xong', ...DONE }),
    // 22/10 23:00 giờ VN = 7 ngày trước 29/10 → rơi khỏi "7 ngày qua".
    REQ({ id: 'xong-cu', resolved_at: '2026-10-22T16:00:00Z', resolved_how: 'done' }),
    // 23/10 01:00 giờ VN (vẫn 22/10 theo UTC) → còn trong 7 ngày: tính theo NGÀY VN.
    REQ({ id: 'xong-ranh', resolved_at: '2026-10-22T18:00:00Z', resolved_how: 'done' }),
    REQ({ id: 'dong', resolved_at: '2026-10-29T01:00:00Z', resolved_how: 'closed' }),
  ]
  it('đếm', () => {
    expect(summarizeRequests(list, TODAY)).toEqual({
      open: 2,
      overdue: 1,
      done: 2,
      cancelled: 1,
    })
  })
  it('quá hạn là tập con của đang mở; đóng theo chứng từ nằm chung "đã huỷ"', () => {
    const ids = (f: Parameters<typeof matchesFilter>[1]) =>
      list.filter((r) => matchesFilter(r, f, TODAY)).map((r) => r.id)
    expect(ids('open')).toEqual(['mo', 'qua'])
    expect(ids('overdue')).toEqual(['qua'])
    expect(ids('done')).toEqual(['xong', 'xong-ranh'])
    expect(ids('cancelled')).toEqual(['dong'])
  })
})

describe('sortRequests', () => {
  it('quá hạn lâu nhất → hạn gần nhất → không hạn → đã đóng (mới đóng trước)', () => {
    const list = [
      REQ({ id: 'khong-han', due_on: null }),
      REQ({ id: 'xong', ...DONE }),
      REQ({ id: 'han-05-11', due_on: '2026-11-05' }),
      REQ({ id: 'qua-1', due_on: '2026-10-28' }),
      REQ({ id: 'xong-moi', resolved_at: '2026-10-29T01:00:00Z', resolved_how: 'done' }),
      REQ({ id: 'han-31-10', due_on: '2026-10-31' }),
      REQ({ id: 'qua-5', due_on: '2026-10-24' }),
    ]
    expect(sortRequests(list, TODAY).map((r) => r.id)).toEqual([
      'qua-5',
      'qua-1',
      'han-31-10',
      'han-05-11',
      'khong-han',
      'xong-moi',
      'xong',
    ])
  })
})

describe('schemas', () => {
  it('giao việc: bắt buộc người nhận + nội dung; chỉ đơn mua / lệnh SX (C2)', () => {
    const ok = { doc_type: 'lsx', doc_id: LSX, assignee_id: 'c658703c-1f39-4c28-9223-5dfd6062345b', body: '  Bổ sung ảnh  ' } // prettier-ignore
    expect(requestCreateSchema.parse(ok).body).toBe('Bổ sung ảnh')
    expect(requestCreateSchema.safeParse({ ...ok, body: '   ' }).success).toBe(false)
    expect(requestCreateSchema.safeParse({ ...ok, doc_type: 'receipt' }).success).toBe(
      false,
    )
    expect(requestCreateSchema.safeParse({ ...ok, due_on: '31/10/2026' }).success).toBe(
      false,
    )
    expect(requestCreateSchema.parse({ ...ok, due_on: '2026-10-31' }).due_on).toBe(
      '2026-10-31',
    )
  })
  it('báo xong phải có câu kết quả (C4); chuyển người thì lời nhắn tuỳ chọn', () => {
    const r = requestActionSchema.safeParse({ action: 'done', text: '  ' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe(
      'Ghi một câu kết quả để người giao biết đã làm gì',
    )
    expect(requestActionSchema.safeParse({ action: 'reassign', assignee_id: LSX }).success).toBe(true) // prettier-ignore
    expect(requestActionSchema.safeParse({ action: 'reassign', assignee_id: 'x' }).success).toBe(false) // prettier-ignore
  })
})
