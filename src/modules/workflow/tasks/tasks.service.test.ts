import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'
import type { Task } from './tasks.repo'

/**
 * PHÂN CÔNG VIỆC (30/10/2026, bản vẽ https://claude.ai/artifact/FQxKHGKQnhWt5dBjGA8n5k)
 * — luật Q1–Q4 đi qua service thật, repo + sự kiện giả.
 */

// vi.mock được kéo lên đầu file — đồ giả phải tạo trong vi.hoisted mới tới kịp.
const { tasks, users, comments, activity, emit } = vi.hoisted(() => ({
  tasks: {
    findById: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    listForAttention: vi.fn(),
    listForTakers: vi.fn(),
    list: vi.fn(),
  },
  users: { findById: vi.fn() },
  comments: { insert: vi.fn(), latestByTasks: vi.fn() },
  activity: { log: vi.fn() },
  emit: vi.fn(),
}))
vi.mock('./tasks.repo', () => ({ tasksRepo: tasks }))
vi.mock('./comments.repo', () => ({ commentsRepo: comments }))
vi.mock('./activity.repo', () => ({ activityRepo: activity }))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: users }))
vi.mock('@/modules/core/departments/departments.repo', () => ({ departmentsRepo: {} }))
vi.mock('@/modules/core/notifications/notifications.service', () => ({
  notificationsService: {},
}))
vi.mock('@/events/bus', () => ({ emit: (...a: unknown[]) => emit(...a), on: vi.fn() }))
vi.mock('@/events/register', () => ({}))
// Đồng hồ giả chứ không giả `todayVn`: task-flow dùng chính hàm đó để đổi HẠN sang ngày
// VN — giả hàm là mọi hạn thành "hôm nay" và không việc nào quá hạn được.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-30T03:00:00Z'))
})
afterEach(() => vi.useRealTimers())

import { tasksService } from './tasks.service'

const user = (over: Partial<User>): User =>
  ({ id: 'u', name: null, role: 'employee', department_id: null, is_active: true, deleted_at: null, ...over }) as User // prettier-ignore
const THAO = user({
  id: 'u-thao',
  name: 'Vũ Phương Thảo',
  role: 'manager',
  department_id: 'd-cu',
})
const PHUONG = user({
  id: 'u-phuong',
  name: 'Nguyễn Phạm Thanh Phương',
  department_id: 'd-bh',
})
const NGA = user({ id: 'u-nga', name: 'Đặng Thị Thanh Nga', department_id: 'd-cu' })
const DIEN = user({
  id: 'u-dien',
  name: 'Điền Hg',
  role: 'admin',
  department_id: 'd-bgd',
})

const TASK = (over: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    title: 'Bổ sung ảnh SP cho 55 dòng lệnh 01/26-27 - LAURA',
    kind: 'assigned',
    status: 'todo',
    assigner_id: 'u-thao',
    assignee_id: 'u-phuong',
    department_id: 'd-bh',
    due_date: '2026-10-30T17:00:00Z',
    ...over,
  }) as Task

beforeEach(() => {
  for (const f of [...Object.values(tasks), users.findById, comments.insert, activity.log, emit]) f.mockReset() // prettier-ignore
  users.findById.mockImplementation(async (id: string) => [PHUONG, NGA, THAO].find((u) => u.id === id) ?? null) // prettier-ignore
  tasks.insert.mockImplementation(async (row: Partial<Task>) => TASK(row))
  tasks.patch.mockImplementation(async (id: string, p: Partial<Task>) =>
    TASK({ id, ...p }),
  )
})

describe('create — Q1 + Q2', () => {
  const NEW = {
    title: 'Bổ sung ảnh SP',
    assignee_id: 'u-phuong',
    due_date: '2026-10-30T17:00:00Z',
  }

  it('quản lý Cung ứng giao được cho người PHÒNG KHÁC (Bán hàng); việc mang phòng người nhận', async () => {
    await tasksService.create(THAO, NEW)
    expect(tasks.insert).toHaveBeenCalledWith(expect.objectContaining({ assigner_id: 'u-thao', assignee_id: 'u-phuong', department_id: 'd-bh', kind: 'assigned' })) // prettier-ignore
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'task.created', assignee_id: 'u-phuong' })) // prettier-ignore
  })
  it('nhân viên giao cho người khác → 403, câu nói cách gỡ', async () => {
    await expect(tasksService.create(NGA, NEW)).rejects.toMatchObject({ status: 403, message: 'Sếp và quản lý giao việc. Cần giao thì nhờ quản lý phòng.' }) // prettier-ignore
    expect(tasks.insert).not.toHaveBeenCalled()
  })
  it('nhân viên tự ghi việc cho mình thì được', async () => {
    await tasksService.create(NGA, { ...NEW, assignee_id: 'u-nga' })
    expect(tasks.insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'self' }))
  })
  it('người nhận đã nghỉ → 400 nói rõ tên', async () => {
    users.findById.mockResolvedValueOnce({ ...PHUONG, is_active: false })
    await expect(tasksService.create(THAO, NEW)).rejects.toMatchObject({ status: 400, message: 'Nguyễn Phạm Thanh Phương không còn hoạt động — chọn người khác' }) // prettier-ignore
  })
})

describe('submit — Q4', () => {
  it('bắt câu kết quả; lưu thành bình luận + đưa vào chuông người giao', async () => {
    tasks.findById.mockResolvedValue(TASK({ status: 'in_progress' }))
    await expect(tasksService.submit(PHUONG, 't1', '   ')).rejects.toMatchObject({
      status: 400,
    })
    expect(tasks.patch).not.toHaveBeenCalled()
    await tasksService.submit(PHUONG, 't1', ' Đã tải ảnh 55 SP ')
    expect(comments.insert).toHaveBeenCalledWith({ task_id: 't1', user_id: 'u-phuong', body: 'Đã tải ảnh 55 SP', kind: 'progress_report' }) // prettier-ignore
    expect(tasks.patch).toHaveBeenCalledWith('t1', { status: 'submitted' })
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'task.submitted', assigner_id: 'u-thao', result: 'Đã tải ảnh 55 SP' })) // prettier-ignore
  })
  it('người giao (kể cả sếp) không báo hoàn thành thay người nhận', async () => {
    tasks.findById.mockResolvedValue(TASK())
    await expect(tasksService.submit(THAO, 't1', 'xong')).rejects.toMatchObject({
      status: 403,
    })
    await expect(tasksService.submit(DIEN, 't1', 'xong')).rejects.toMatchObject({
      status: 403,
    })
  })
  it('việc tự ghi: báo xong là xong luôn, không chuông duyệt', async () => {
    tasks.findById.mockResolvedValue(
      TASK({ kind: 'self', assigner_id: 'u-nga', assignee_id: 'u-nga' }),
    )
    await tasksService.submit(NGA, 't1', 'Đã lập danh sách')
    expect(tasks.patch).toHaveBeenCalledWith('t1', { status: 'done' })
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('approve / reject — Q3', () => {
  beforeEach(() => tasks.findById.mockResolvedValue(TASK({ status: 'submitted' })))

  it('người giao duyệt Đạt → xong; lời nhắn tuỳ chọn', async () => {
    await tasksService.approve(THAO, 't1', 'Ảnh rõ, cảm ơn')
    expect(tasks.patch).toHaveBeenCalledWith('t1', { status: 'done' })
    expect(comments.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'Đạt — Ảnh rõ, cảm ơn', kind: 'approval' })) // prettier-ignore
  })
  it('sếp duyệt được việc người khác giao; người nhận / người ngoài thì không', async () => {
    await tasksService.approve(DIEN, 't1')
    expect(comments.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'Đạt' }))
    await expect(tasksService.approve(PHUONG, 't1')).rejects.toMatchObject({
      status: 403,
    })
    await expect(tasksService.approve(NGA, 't1')).rejects.toMatchObject({ status: 403 })
  })
  it('trả lại bắt lý do', async () => {
    await expect(tasksService.reject(THAO, 't1', ' ')).rejects.toMatchObject({
      status: 400,
    })
    await tasksService.reject(THAO, 't1', 'Còn 6 SP chưa có ảnh')
    expect(tasks.patch).toHaveBeenCalledWith('t1', { status: 'rejected' })
  })
  it('chưa báo hoàn thành thì chưa duyệt được', async () => {
    tasks.findById.mockResolvedValue(TASK({ status: 'in_progress' }))
    await expect(tasksService.approve(THAO, 't1')).rejects.toMatchObject({ status: 400, message: 'Việc đang làm' }) // prettier-ignore
  })
})

describe('changeStatus — đường cũ /status đi qua cùng luật', () => {
  it('người nhận KHÔNG tự huỷ việc được giao (lỗ cũ)', async () => {
    tasks.findById.mockResolvedValue(TASK())
    await expect(tasksService.changeStatus(PHUONG, 't1', 'cancelled')).rejects.toMatchObject({ status: 403 }) // prettier-ignore
    expect(tasks.patch).not.toHaveBeenCalled()
  })
  it('việc được giao không tự đặt "xong" — phải báo hoàn thành rồi người giao duyệt', async () => {
    tasks.findById.mockResolvedValue(TASK({ status: 'in_progress' }))
    await expect(tasksService.changeStatus(PHUONG, 't1', 'done')).rejects.toMatchObject({ status: 400, message: 'Việc được giao chỉ xong khi người giao duyệt Đạt — hãy Báo hoàn thành' }) // prettier-ignore
  })
  it('người nhận bắt đầu; người giao huỷ', async () => {
    tasks.findById.mockResolvedValue(TASK())
    await tasksService.changeStatus(PHUONG, 't1', 'in_progress')
    expect(tasks.patch).toHaveBeenLastCalledWith('t1', { status: 'in_progress' })
    // Bắt đầu của người nhận: không bắn chuông (quá ồn).
    expect(emit).not.toHaveBeenCalled()
    await tasksService.changeStatus(THAO, 't1', 'cancelled')
    expect(tasks.patch).toHaveBeenLastCalledWith('t1', { status: 'cancelled' })
    // Người giao huỷ → người nhận được báo "không phải làm nữa".
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'task.status_changed', to_status: 'cancelled', notify_ids: ['u-phuong'] })) // prettier-ignore
  })
})

describe('attention — số đỏ', () => {
  it('đếm việc chờ tôi duyệt + việc của tôi quá hạn, từ một truy vấn', async () => {
    tasks.listForAttention.mockResolvedValue([
      TASK({ id: 'a', status: 'submitted' }),
      TASK({ id: 'b', status: 'submitted' }),
      TASK({ id: 'c', assigner_id: 'u-dien', assignee_id: 'u-thao', status: 'in_progress', due_date: '2026-10-27T03:00:00Z' }), // prettier-ignore
    ])
    expect(await tasksService.attention(THAO)).toEqual({
      to_approve: 2,
      my_overdue: 1,
      total: 3,
    })
    expect(tasks.listForAttention).toHaveBeenCalledWith('u-thao')
  })
})

describe('assignedTo — ô Việc được giao trên Bàn làm việc (P3)', () => {
  beforeEach(() => {
    tasks.list.mockResolvedValue({
      rows: [
        TASK({
          id: 'mo',
          status: 'todo',
          due_date: '2026-11-03T16:59:59Z',
          created_at: '2026-10-28T03:00:00Z',
        }),
        TASK({
          id: 'qua',
          status: 'in_progress',
          due_date: '2026-10-27T16:59:59Z',
          created_at: '2026-10-27T03:00:00Z',
        }),
        TASK({
          id: 'lai',
          status: 'rejected',
          due_date: null,
          created_at: '2026-10-26T03:00:00Z',
        }),
        TASK({ id: 'cho', status: 'submitted' }),
        TASK({ id: 'xong', status: 'done' }),
        TASK({ id: 'huy', status: 'cancelled' }),
      ],
      total: 6,
    })
    comments.latestByTasks.mockResolvedValue(
      new Map([['lai', { rejection: { body: 'Thiếu NCC ở Bình Dương', at: 'x' } }]]),
    )
  })

  it('chỉ việc bóng đang ở người nhận (bỏ chờ duyệt / xong / huỷ), quá hạn lên đầu, kèm lý do trả lại', async () => {
    const out = await tasksService.assignedTo(PHUONG, 'u-phuong')
    expect(tasks.list).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_id: 'u-phuong', kind: 'assigned' }),
    )
    expect(out.map((t) => [t.id, t.overdue_days, t.actions, t.last_reject])).toEqual([
      ['qua', 3, ['submit'], null],
      ['mo', 0, ['start', 'submit'], null],
      ['lai', 0, ['start', 'submit'], 'Thiếu NCC ở Bình Dương'],
    ])
  })

  it('người duyệt xem bàn người khác: cùng danh sách, KHÔNG có nút (kể cả sếp)', async () => {
    const out = await tasksService.assignedTo(DIEN, 'u-phuong')
    expect(out).toHaveLength(3)
    expect(out.every((t) => t.actions.length === 0)).toBe(true)
  })
})

describe('takerStats — ba cột việc ở tab Theo người mua (P4)', () => {
  it('mỗi người một dòng số, kể cả người chưa có việc nào; hỏi repo đúng nhóm + mốc 30 ngày', async () => {
    tasks.listForTakers.mockResolvedValue([
      { kind: 'assigned', status: 'in_progress', assignee_id: 'u-nga', due_date: '2026-10-27T16:59:59Z', completed_at: null }, // prettier-ignore
      { kind: 'assigned', status: 'done', assignee_id: 'u-nga', due_date: '2026-10-28T16:59:59Z', completed_at: '2026-10-28T09:00:00Z' }, // prettier-ignore
      { kind: 'assigned', status: 'todo', assignee_id: 'u-phuong', due_date: null, completed_at: null }, // prettier-ignore
    ])
    const out = await tasksService.takerStats(['u-nga', 'u-phuong', 'u-thao'])
    // 31 ngày trước 30/10 (giờ VN) — dư một ngày, summarizeTaker cắt đúng mốc.
    expect(tasks.listForTakers).toHaveBeenCalledWith(['u-nga', 'u-phuong', 'u-thao'], '2026-09-29')
    expect(out).toEqual({
      'u-nga': { open: 1, overdue: 1, on_time: 1, done_due: 1 },
      'u-phuong': { open: 1, overdue: 0, on_time: 0, done_due: 0 },
      'u-thao': { open: 0, overdue: 0, on_time: 0, done_due: 0 },
    })
  })

  it('không có ai thì không hỏi DB', async () => {
    tasks.listForTakers.mockClear()
    expect(await tasksService.takerStats([])).toEqual({})
    expect(tasks.listForTakers).not.toHaveBeenCalled()
  })
})

describe('mineBoard — mục "Việc của tôi" ở trang Phân công việc (P5)', () => {
  it('việc được giao cho tôi: cần làm + chờ duyệt + đóng trong 30 ngày; chỉ nút của người nhận', async () => {
    tasks.list.mockResolvedValue({
      rows: [
        TASK({ id: 'lam', status: 'todo', created_at: '2026-10-29T03:00:00Z' }),
        TASK({ id: 'cho', status: 'submitted', created_at: '2026-10-28T03:00:00Z' }),
        TASK({ id: 'xong', status: 'done', completed_at: '2026-10-29T03:00:00Z' }),
        TASK({ id: 'cu', status: 'done', completed_at: '2026-08-01T03:00:00Z' }),
      ],
      total: 4,
    })
    comments.latestByTasks.mockResolvedValue(
      new Map([['cho', { progress_report: { body: 'Đã gửi 6 ảnh', at: 'x' } }]]),
    )
    const out = await tasksService.mineBoard(PHUONG)
    expect(tasks.list).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_id: 'u-phuong', kind: 'assigned' }),
    )
    expect(out.summary).toEqual({ doing: 1, overdue: 0, waiting: 1, done: 1, cancelled: 0 })
    expect(out.items.map((t) => [t.id, t.actions, t.last_result])).toEqual([
      ['cho', [], 'Đã gửi 6 ảnh'],
      ['lam', ['start', 'submit'], null],
      ['xong', [], null],
    ])
  })
})
