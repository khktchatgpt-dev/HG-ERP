import { describe, expect, it } from 'vitest'
import {
  actionForStatus,
  canAssign,
  dueEndOfDay,
  matchesGiven,
  sortGiven,
  summarizeGiven,
  nextStatus,
  taskActionBlock,
  taskActions,
  taskAttention,
  taskOverdueDays,
  type FlowTask,
} from './task-flow'

/*
  Ví dụ theo bản vẽ duyệt 30/10: Thảo (quản lý Cung ứng) giao Phương (Bán hàng)
  bổ sung ảnh lệnh LAURA; anh Điền là sếp (admin).
*/
const TODAY = '2026-10-30'
const T = (over: Partial<FlowTask> = {}): FlowTask => ({
  kind: 'assigned',
  status: 'todo',
  assigner_id: 'u-thao',
  assignee_id: 'u-phuong',
  // 31/10 00:00 giờ VN
  due_date: '2026-10-30T17:00:00Z',
  ...over,
})
const THAO = { id: 'u-thao', role: 'manager' }
const PHUONG = { id: 'u-phuong', role: 'employee' }
const NGA = { id: 'u-nga', role: 'employee' }
const QUANG = { id: 'u-quang', role: 'manager' } // quản lý phòng khác, không dính
const DIEN = { id: 'u-dien', role: 'admin' }

describe('canAssign — Q1', () => {
  it('sếp + quản lý giao được; nhân viên không', () => {
    expect(canAssign(DIEN)).toBe(true)
    expect(canAssign(THAO)).toBe(true)
    expect(canAssign(PHUONG)).toBe(false)
  })
})

describe('taskActions — ai bấm được gì', () => {
  it('người nhận: bắt đầu, báo hoàn thành; KHÔNG tự huỷ (lỗ cũ của /status)', () => {
    expect(taskActions(T(), PHUONG)).toEqual(['start', 'submit'])
    expect(taskActionBlock(T(), 'cancel', PHUONG)).toEqual({ kind: 'who', message: 'Chỉ người giao việc (hoặc sếp) làm được bước này' }) // prettier-ignore
  })
  it('đang làm: người nhận tạm hoãn / báo hoàn thành; người giao chỉ huỷ', () => {
    expect(taskActions(T({ status: 'in_progress' }), PHUONG)).toEqual(['hold', 'submit'])
    expect(taskActions(T({ status: 'in_progress' }), THAO)).toEqual(['cancel'])
  })
  it('chờ duyệt: người giao Đạt / Trả lại / Huỷ; người nhận chờ', () => {
    expect(taskActions(T({ status: 'submitted' }), THAO)).toEqual([
      'approve',
      'reject',
      'cancel',
    ])
    expect(taskActions(T({ status: 'submitted' }), PHUONG)).toEqual([])
    expect(taskActionBlock(T({ status: 'submitted' }), 'submit', PHUONG)?.message).toBe('Việc đang chờ người giao duyệt') // prettier-ignore
  })
  it('bị trả lại: người nhận làm tiếp hoặc báo lại', () => {
    expect(taskActions(T({ status: 'rejected' }), PHUONG)).toEqual(['start', 'submit'])
  })
  it('sếp làm được mọi bước của người giao, nhưng KHÔNG báo hoàn thành thay người nhận', () => {
    expect(taskActions(T({ status: 'submitted' }), DIEN)).toEqual([
      'approve',
      'reject',
      'cancel',
    ])
    expect(taskActionBlock(T(), 'submit', DIEN)?.kind).toBe('who')
  })
  it('quản lý phòng khác, nhân viên ngoài cuộc: không bấm được gì', () => {
    expect(taskActions(T({ status: 'submitted' }), QUANG)).toEqual([])
    expect(taskActions(T(), NGA)).toEqual([])
  })
  it('xong thì đứng yên; đã huỷ thì người giao mở lại được', () => {
    expect(taskActions(T({ status: 'done' }), THAO)).toEqual([])
    expect(taskActions(T({ status: 'cancelled' }), THAO)).toEqual(['restore'])
    expect(taskActionBlock(T({ status: 'done' }), 'reject', THAO)?.message).toBe(
      'Việc đã xong',
    )
  })
  it('việc tự ghi: chủ việc làm mọi bước trừ duyệt; báo xong là xong luôn; xong rồi mở lại được', () => {
    const own = T({ kind: 'self', assigner_id: 'u-nga', assignee_id: 'u-nga' })
    expect(taskActions(own, NGA)).toEqual(['start', 'submit', 'cancel'])
    expect(nextStatus(own, 'submit')).toBe('done')
    expect(nextStatus(T(), 'submit')).toBe('submitted')
    expect(taskActions({ ...own, status: 'done' }, NGA)).toEqual(['restore'])
    expect(taskActions(own, THAO)).toEqual([])
  })
})

describe('actionForStatus — đường cũ POST /status không đi vòng qua luật', () => {
  it('việc được giao không tự đặt "xong"; việc tự ghi thì được', () => {
    expect(actionForStatus(T(), 'done')).toBeNull()
    expect(actionForStatus(T({ kind: 'self' }), 'done')).toBe('submit')
  })
  it('về "chưa làm" chỉ từ đã huỷ (mở lại)', () => {
    expect(actionForStatus(T({ status: 'cancelled' }), 'todo')).toBe('restore')
    expect(actionForStatus(T({ status: 'in_progress' }), 'todo')).toBeNull()
    expect(actionForStatus(T(), 'cancelled')).toBe('cancel')
  })
})

describe('taskOverdueDays — theo ngày VN', () => {
  it('hạn hôm nay chưa quá; hạn hôm qua là 1 ngày', () => {
    expect(taskOverdueDays(T({ due_date: '2026-10-29T17:00:00Z' }), TODAY)).toBe(0) // 30/10 VN
    expect(taskOverdueDays(T({ due_date: '2026-10-28T17:00:00Z' }), TODAY)).toBe(1) // 29/10 VN
  })
  it('chờ duyệt / xong / huỷ / không hạn: không bao giờ quá hạn', () => {
    const qua = '2026-10-01T03:00:00Z'
    for (const status of ['submitted', 'done', 'cancelled'] as const) {
      expect(taskOverdueDays(T({ status, due_date: qua }), TODAY)).toBe(0)
    }
    expect(taskOverdueDays(T({ due_date: null }), TODAY)).toBe(0)
    expect(taskOverdueDays(T({ status: 'rejected', due_date: qua }), TODAY)).toBe(29)
  })
})

describe('taskAttention — số đỏ sidebar', () => {
  const list = [
    { id: 'a', ...T({ status: 'submitted' }) }, // Thảo chờ duyệt
    { id: 'b', ...T({ status: 'in_progress', due_date: '2026-10-27T03:00:00Z' }) }, // Phương quá hạn
    { id: 'c', ...T({ status: 'submitted', due_date: '2026-10-01T03:00:00Z' }) }, // chờ duyệt, không tính quá hạn
    { id: 'd', ...T({ kind: 'self', assigner_id: 'u-thao', assignee_id: 'u-thao', status: 'submitted' }) }, // prettier-ignore
  ]
  it('người giao: đếm việc chờ mình duyệt (không đếm việc tự ghi)', () => {
    expect(taskAttention(list, 'u-thao', TODAY)).toEqual({
      to_approve: 2,
      my_overdue: 0,
      total: 2,
    })
  })
  it('người nhận: đếm việc của mình đang quá hạn', () => {
    expect(taskAttention(list, 'u-phuong', TODAY)).toEqual({
      to_approve: 0,
      my_overdue: 1,
      total: 1,
    })
  })
})

describe('schema báo hoàn thành / trả lại — câu tiếng Việt kể cả khi THIẾU HẲN trường', () => {
  it('thiếu result / reason, hoặc chỉ toàn dấu cách', async () => {
    const { taskSubmitSchema, taskRejectSchema } = await import('@/modules/workflow/tasks/tasks.schema')
    for (const body of [{}, { result: '   ' }]) {
      expect(taskSubmitSchema.safeParse(body).error?.issues[0].message).toBe('Ghi một câu kết quả để người giao biết đã làm gì') // prettier-ignore
    }
    expect(taskRejectSchema.safeParse({}).error?.issues[0].message).toBe('Ghi lý do trả lại để người nhận biết phải làm thêm gì') // prettier-ignore
    expect(taskSubmitSchema.parse({ result: ' Đã xong ' }).result).toBe('Đã xong')
  })
})

describe('Việc tôi giao — chip đếm đúng danh sách nó mở (P2)', () => {
  const L = (id: string, over: Partial<FlowTask & { completed_at: string | null; cancelled_at: string | null; created_at: string }> = {}) => ({ id, ...T(), created_at: '2026-10-20T03:00:00Z', completed_at: null, cancelled_at: null, ...over }) // prettier-ignore
  const list = [
    L('cho', { status: 'submitted' }),
    L('qua', { status: 'in_progress', due_date: '2026-10-27T16:59:59Z' }),
    L('mo', { due_date: '2026-11-03T16:59:59Z' }),
    L('khong-han', { due_date: null }),
    L('xong', { status: 'done', completed_at: '2026-10-29T03:00:00Z' }),
    L('xong-cu', { status: 'done', completed_at: '2026-09-01T03:00:00Z' }),
    L('huy', { status: 'cancelled', cancelled_at: '2026-10-29T03:00:00Z' }),
  ]
  it('đếm', () => {
    expect(summarizeGiven(list, TODAY)).toEqual({ to_approve: 1, overdue: 1, open: 4, done: 1, cancelled: 1 }) // prettier-ignore
  })
  it('"Chưa xong" gồm cả chờ duyệt; xong quá 30 ngày rơi khỏi danh sách', () => {
    expect(list.filter((t) => matchesGiven(t, 'open', TODAY)).map((t) => t.id)).toEqual(['cho', 'qua', 'mo', 'khong-han']) // prettier-ignore
    expect(list.filter((t) => matchesGiven(t, 'done', TODAY)).map((t) => t.id)).toEqual(['xong'])
  })
  it('thứ tự: chờ tôi duyệt → quá hạn → hạn gần → không hạn → đã đóng', () => {
    expect(sortGiven(list, TODAY).map((t) => t.id)).toEqual(['cho', 'qua', 'mo', 'khong-han', 'xong', 'huy', 'xong-cu']) // prettier-ignore
  })
  it('hạn theo ngày → mốc hết ngày giờ VN', () => {
    expect(dueEndOfDay('2026-10-31')).toBe('2026-10-31T23:59:59+07:00')
  })
})
