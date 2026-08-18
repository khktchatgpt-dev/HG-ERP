import { describe, expect, it } from 'vitest'
import {
  classifyTodo,
  countIncomingSoon,
  countMyTodos,
  groupIncoming,
  groupTodos,
  incomingBucket,
  type SupplyWatchInput,
} from './supply-watch'

const TODAY = '2026-08-15'

function po(p: Partial<SupplyWatchInput> = {}): SupplyWatchInput {
  return { status: 'ordered', expected_at: '2026-08-20', assigned_to: null, ...p }
}

describe('classifyTodo', () => {
  it('đơn đã đóng sổ không phải việc của ai', () => {
    expect(classifyTodo(po({ status: 'received' }), TODAY)).toBeNull()
    expect(classifyTodo(po({ status: 'cancelled' }), TODAY)).toBeNull()
  })

  it('đơn đang nằm bàn Giám đốc thì Cung ứng không làm gì được', () => {
    expect(classifyTodo(po({ status: 'pending_approval' }), TODAY)).toBeNull()
  })

  it('nháp là việc phải hoàn tất', () => {
    expect(classifyTodo(po({ status: 'draft', expected_at: null }), TODAY)).toBe('draft')
  })

  it('đã duyệt mà chưa gửi = việc gửi NCC', () => {
    expect(classifyTodo(po({ status: 'approved' }), TODAY)).toBe('unsent')
  })

  it('đã duyệt + quá ngày hẹn vẫn là "chưa gửi", không phải "giục NCC"', () => {
    // Gốc rễ là đơn chưa ra khỏi cửa — giục một người chưa nhận đơn là vô nghĩa.
    expect(
      classifyTodo(po({ status: 'approved', expected_at: '2026-08-01' }), TODAY),
    ).toBe('unsent')
  })

  it('đơn đã gửi mà quá hẹn = giục NCC', () => {
    expect(
      classifyTodo(po({ status: 'ordered', expected_at: '2026-08-14' }), TODAY),
    ).toBe('overdue')
  })

  it('đơn đã gửi mà trống hẹn giao được gọi tên riêng', () => {
    expect(classifyTodo(po({ status: 'confirmed', expected_at: null }), TODAY)).toBe(
      'no_eta',
    )
  })

  it('về một phần, còn trong hạn = theo dõi phần thiếu', () => {
    expect(classifyTodo(po({ status: 'partial' }), TODAY)).toBe('partial')
  })

  it('về một phần MÀ quá hẹn thì đếm là quá hẹn, không đếm hai lần', () => {
    expect(
      classifyTodo(po({ status: 'partial', expected_at: '2026-08-10' }), TODAY),
    ).toBe('overdue')
  })

  it('đơn đã gửi, còn hạn, chưa về gì = chưa cần làm gì', () => {
    expect(
      classifyTodo(po({ status: 'ordered', expected_at: '2026-09-01' }), TODAY),
    ).toBeNull()
  })
})

describe('groupTodos', () => {
  it('xếp nhóm theo mức khẩn và bỏ đơn không phải việc', () => {
    const rows = [
      po({ status: 'received' }),
      po({ status: 'draft' }),
      po({ status: 'ordered', expected_at: '2026-08-01' }),
      po({ status: 'approved' }),
    ]
    expect(groupTodos(rows, TODAY).map((g) => g.kind)).toEqual([
      'overdue',
      'unsent',
      'draft',
    ])
  })

  it('mỗi đơn chỉ xuất hiện đúng một lần', () => {
    const rows = [
      po({ status: 'partial', expected_at: '2026-08-01' }),
      po({ status: 'partial', expected_at: null }),
      po({ status: 'partial', expected_at: '2026-09-09' }),
    ]
    const groups = groupTodos(rows, TODAY)
    expect(groups.flatMap((g) => g.rows)).toHaveLength(3)
    expect(groups.map((g) => g.kind)).toEqual(['overdue', 'no_eta', 'partial'])
  })
})

describe('incomingBucket', () => {
  it('đơn chưa gửi NCC KHÔNG nằm trong lịch hàng về', () => {
    // Chưa ai chuẩn bị hàng — xếp vào lịch giao là tự trấn an sai.
    expect(incomingBucket(po({ status: 'approved' }), TODAY)).toBeNull()
    expect(incomingBucket(po({ status: 'draft' }), TODAY)).toBeNull()
    expect(incomingBucket(po({ status: 'pending_approval' }), TODAY)).toBeNull()
  })

  it('đơn đã đóng sổ cũng không nằm trong lịch', () => {
    expect(incomingBucket(po({ status: 'received' }), TODAY)).toBeNull()
    expect(incomingBucket(po({ status: 'cancelled' }), TODAY)).toBeNull()
  })

  it('chia đúng mốc: quá hẹn / hôm nay / trong 7 ngày / sau đó', () => {
    expect(incomingBucket(po({ expected_at: '2026-08-14' }), TODAY)).toBe('overdue')
    expect(incomingBucket(po({ expected_at: '2026-08-15' }), TODAY)).toBe('today')
    expect(incomingBucket(po({ expected_at: '2026-08-22' }), TODAY)).toBe('week')
    expect(incomingBucket(po({ expected_at: '2026-08-23' }), TODAY)).toBe('later')
  })

  it('nhận cả timestamp đầy đủ, không chỉ yyyy-mm-dd', () => {
    expect(incomingBucket(po({ expected_at: '2026-08-15T09:30:00Z' }), TODAY)).toBe(
      'today',
    )
  })

  it('đang trên đường mà trống ngày thì có nhóm riêng', () => {
    expect(incomingBucket(po({ expected_at: null }), TODAY)).toBe('no_eta')
  })
})

describe('groupIncoming', () => {
  it('trong mỗi nhóm, hẹn sớm lên trước', () => {
    const rows = [
      po({ expected_at: '2026-08-21' }),
      po({ expected_at: '2026-08-16' }),
      po({ expected_at: '2026-08-18' }),
    ]
    const week = groupIncoming(rows, TODAY).find((g) => g.bucket === 'week')
    expect(week?.rows.map((r) => r.expected_at)).toEqual([
      '2026-08-16',
      '2026-08-18',
      '2026-08-21',
    ])
  })
})

describe('số đếm cho badge', () => {
  it('countMyTodos chỉ đếm đơn mình phụ trách', () => {
    const rows = [
      po({ status: 'draft', assigned_to: 'u1' }),
      po({ status: 'approved', assigned_to: 'u1' }),
      po({ status: 'approved', assigned_to: 'u2' }),
      po({ status: 'received', assigned_to: 'u1' }),
    ]
    expect(countMyTodos(rows, 'u1', TODAY)).toBe(2)
  })

  it('không đăng nhập / không phụ trách đơn nào thì badge im lặng', () => {
    expect(countMyTodos([po({ status: 'draft', assigned_to: 'u1' })], null, TODAY)).toBe(
      0,
    )
    expect(countMyTodos([po({ status: 'draft', assigned_to: 'u1' })], 'u9', TODAY)).toBe(
      0,
    )
  })

  it('countIncomingSoon KHÔNG đếm đơn quá hẹn (tránh đếm hai lần với badge kia)', () => {
    const rows = [
      po({ expected_at: '2026-08-10' }), // quá hẹn
      po({ expected_at: '2026-08-15' }), // hôm nay
      po({ expected_at: '2026-08-20' }), // trong tuần
      po({ expected_at: '2026-09-30' }), // sau đó
    ]
    expect(countIncomingSoon(rows, TODAY)).toBe(2)
  })
})
