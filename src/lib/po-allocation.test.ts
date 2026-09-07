import { describe, expect, it } from 'vitest'
import {
  allocatedTo,
  allocationProblem,
  rescaleAllocations,
  type LineAllocation,
} from './po-allocation'

/**
 * Ca thật dựng test: PO-2026-0065 gộp lệnh 08 và 09, dòng 1.350 tấm KIM0161.
 * Trước 0185 cả hai lệnh đều thấy "đã đặt 1.350" — mỗi lệnh tưởng đủ, "còn phải
 * đặt" bị trừ thừa và người mua đặt thiếu.
 */
const L08 = 'lsx-08'
const L09 = 'lsx-09'

describe('allocatedTo', () => {
  it('không chia → cả dòng thuộc LSX chính, lệnh phụ được 0', () => {
    const line = { qty_ordered: 1350, main_lsx_id: L08, allocations: [] }
    expect(allocatedTo(L08, line)).toBe(1350)
    // Đây là con số 0185 sinh ra để sửa: trước đây lệnh 09 cũng nhận 1.350.
    expect(allocatedTo(L09, line)).toBe(0)
  })

  it('có chia → mỗi lệnh đúng phần của mình', () => {
    const line = {
      qty_ordered: 1350,
      main_lsx_id: L08,
      allocations: [
        { production_order_id: L08, qty: 800 },
        { production_order_id: L09, qty: 550 },
      ],
    }
    expect(allocatedTo(L08, line)).toBe(800)
    expect(allocatedTo(L09, line)).toBe(550)
    expect(allocatedTo('lsx-khac', line)).toBe(0)
  })

  it('đơn không gắn lệnh nào thì không lệnh nào nhận', () => {
    expect(allocatedTo(L08, { qty_ordered: 100, main_lsx_id: null })).toBe(0)
  })
})

describe('allocationProblem', () => {
  const ok: LineAllocation[] = [
    { production_order_id: L08, qty: 800 },
    { production_order_id: L09, qty: 550 },
  ]

  it('không chia hoặc chia khớp → hợp lệ', () => {
    expect(allocationProblem(1350, [])).toBeNull()
    expect(allocationProblem(1350, ok)).toBeNull()
  })

  it('chia thiếu / chia thừa đều nói rõ lệch bao nhiêu', () => {
    expect(allocationProblem(1350, [{ production_order_id: L08, qty: 800 }])).toBe(
      'Chia thiếu 550 so với SL đặt 1.350',
    )
    expect(allocationProblem(1000, ok)).toBe('Chia thừa 350 so với SL đặt 1.000')
  })

  it('SL lẻ cộng dư số nhị phân vẫn coi là khớp', () => {
    expect(
      allocationProblem(0.3, [
        { production_order_id: L08, qty: 0.1 },
        { production_order_id: L09, qty: 0.2 },
      ]),
    ).toBeNull()
  })

  it('bắt số 0, số âm và lệnh trùng', () => {
    expect(allocationProblem(100, [{ production_order_id: L08, qty: 0 }])).toMatch(
      /lớn hơn 0/,
    )
    expect(
      allocationProblem(100, [
        { production_order_id: L08, qty: 60 },
        { production_order_id: L08, qty: 40 },
      ]),
    ).toMatch(/hai lần/)
  })
})

describe('rescaleAllocations', () => {
  it('SL đặt đổi thì giữ tỉ lệ và tổng khớp tuyệt đối', () => {
    const out = rescaleAllocations(
      [
        { production_order_id: L08, qty: 800 },
        { production_order_id: L09, qty: 550 },
      ],
      600,
    )
    expect(out.reduce((s, a) => s + a.qty, 0)).toBe(600)
    expect(allocationProblem(600, out)).toBeNull()
  })

  it('phần lẻ do làm tròn dồn vào lệnh lớn nhất, không đẻ ra "chia thiếu 0,0001"', () => {
    const out = rescaleAllocations(
      [
        { production_order_id: L08, qty: 1 },
        { production_order_id: L09, qty: 1 },
        { production_order_id: 'lsx-10', qty: 1 },
      ],
      100,
    )
    expect(out.reduce((s, a) => s + a.qty, 0)).toBe(100)
    expect(allocationProblem(100, out)).toBeNull()
  })

  it('chưa chia gì thì không đụng vào', () => {
    expect(rescaleAllocations([], 600)).toEqual([])
  })
})
