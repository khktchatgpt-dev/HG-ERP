import { describe, expect, it } from 'vitest'
import {
  compareForSupply,
  daysUntilDue,
  dueLevel,
  lsxSupplyGate,
  type LsxSupplyInput,
  type SortableLsx,
} from './lsx-supply'

const TODAY = '2026-08-15'

function lsx(p: Partial<LsxSupplyInput> = {}): LsxSupplyInput {
  return {
    materials_received_at: null,
    posTotal: 0,
    posUnsent: 0,
    posOpen: 0,
    posLate: 0,
    ...p,
  }
}

describe('lsxSupplyGate', () => {
  it('chưa có đơn nào = việc của Cung ứng', () => {
    const g = lsxSupplyGate(lsx({ posTotal: 0 }))
    expect(g.key).toBe('none')
    expect(g.mine).toBe(true)
  })

  it('đơn còn nháp/chờ ký thì nêu trước đơn quá hẹn', () => {
    // Chưa gửi là thứ mình gỡ được ngay; giục NCC chưa nhận đơn là vô nghĩa.
    const g = lsxSupplyGate(lsx({ posTotal: 3, posUnsent: 1, posLate: 1, posOpen: 2 }))
    expect(g.key).toBe('unsent')
    expect(g.mine).toBe(true)
  })

  it('đã gửi hết mà có đơn quá hẹn = giục NCC, vẫn tính là việc của mình', () => {
    const g = lsxSupplyGate(lsx({ posTotal: 2, posOpen: 2, posLate: 1 }))
    expect(g.key).toBe('late')
    expect(g.owner).toBe('Nhà cung cấp')
    expect(g.mine).toBe(true)
  })

  it('đang về đúng hạn thì không phải việc hôm nay', () => {
    const g = lsxSupplyGate(lsx({ posTotal: 2, posOpen: 2 }))
    expect(g.key).toBe('inflight')
    expect(g.mine).toBe(false)
  })

  it('Kho xác nhận về đủ là chốt hạ — không bị đơn lặt vặt kéo ngược', () => {
    // Mua thêm một đơn nhỏ sau khi Kho đã chốt đủ: đếm PO sẽ ra "đang về".
    const g = lsxSupplyGate(
      lsx({ materials_received_at: '2026-08-10', posTotal: 4, posOpen: 1 }),
    )
    expect(g.key).toBe('done')
  })

  it('đơn đã nhận hết mà Kho chưa xác nhận thì nói đúng thực tế', () => {
    const g = lsxSupplyGate(lsx({ posTotal: 3, posOpen: 0, posUnsent: 0 }))
    expect(g.key).toBe('done')
    expect(g.detail).toContain('chờ Kho xác nhận')
  })
})

describe('hạn vật tư', () => {
  it('đếm ngược đúng, âm là đã quá hạn', () => {
    expect(daysUntilDue('2026-08-20', TODAY)).toBe(5)
    expect(daysUntilDue('2026-08-15', TODAY)).toBe(0)
    expect(daysUntilDue('2026-08-12', TODAY)).toBe(-3)
    expect(daysUntilDue(null, TODAY)).toBeNull()
  })

  it('nhận cả timestamp đầy đủ', () => {
    expect(daysUntilDue('2026-08-20T08:00:00Z', TODAY)).toBe(5)
  })

  it('chia mức đúng mốc', () => {
    expect(dueLevel('2026-08-14', TODAY)).toBe('overdue')
    expect(dueLevel('2026-08-15', TODAY)).toBe('today')
    expect(dueLevel('2026-08-22', TODAY)).toBe('soon')
    expect(dueLevel('2026-08-23', TODAY)).toBe('later')
    expect(dueLevel(null, TODAY)).toBe('none')
  })
})

describe('compareForSupply', () => {
  const mk = (mine: boolean, due: SortableLsx['due'], code: string): SortableLsx => ({
    gate: { mine } as SortableLsx['gate'],
    due,
    code,
  })

  it('việc của Cung ứng luôn lên trước, dù lệnh kia gấp hơn', () => {
    const rows = [mk(false, 'overdue', 'LSX-01'), mk(true, 'later', 'LSX-02')]
    expect(rows.sort(compareForSupply)[0].code).toBe('LSX-02')
  })

  it('cùng là việc của mình thì hạn gấp lên trước', () => {
    const rows = [
      mk(true, 'later', 'LSX-01'),
      mk(true, 'overdue', 'LSX-02'),
      mk(true, 'soon', 'LSX-03'),
    ]
    expect(rows.sort(compareForSupply).map((r) => r.code)).toEqual([
      'LSX-02',
      'LSX-03',
      'LSX-01',
    ])
  })

  it('lệnh CHƯA ĐẶT HẠN không bị đẩy xuống cuối', () => {
    // Thiếu vật tư mà không ai đặt hạn chính là thứ cần nhìn thấy.
    const rows = [mk(true, 'later', 'LSX-01'), mk(true, 'none', 'LSX-02')]
    expect(rows.sort(compareForSupply)[0].code).toBe('LSX-02')
  })

  it('cùng mức thì mã mới nhất lên trước, thứ tự ổn định', () => {
    const rows = [mk(true, 'soon', 'LSX-2608-01'), mk(true, 'soon', 'LSX-2608-09')]
    expect(rows.sort(compareForSupply)[0].code).toBe('LSX-2608-09')
  })
})
