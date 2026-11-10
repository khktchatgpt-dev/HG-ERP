import { describe, expect, it } from 'vitest'
import {
  headReceived,
  overAvailableWarning,
  totalKey,
  transferTotals,
  wipNumbers,
} from './wip-numbers'

describe('wipNumbers — năm con số của một dòng × công đoạn', () => {
  it('tồn = xong − đã giao; khả dụng = đã nhận − đã ghi (đạt + phế + sửa)', () => {
    const n = wipNumbers({ done: 250, shipped: 200, received: 400, used: 273 })
    expect(n).toEqual({
      done: 250,
      shipped: 200,
      received: 400,
      on_hand: 50,
      available: 127,
    })
  })

  it('tồn trừ cả số đã ghi ở công đoạn kế khi chưa lập phiếu (10/11/2026)', () => {
    // Nguội xong 20, không PGT, sơn đã ghi 20 → tồn 0 (hàng đã đi), không phải 20.
    expect(
      wipNumbers({ done: 20, shipped: 0, received: 20, used: 20, next_used: 20 }).on_hand,
    ).toBe(0)
    // Phiếu giao 12 nhưng công đoạn kế mới ghi 8 → phiếu thắng (max).
    expect(
      wipNumbers({ done: 20, shipped: 12, received: null, used: 0, next_used: 8 })
        .on_hand,
    ).toBe(8)
    // Công đoạn kế ghi 15 mà phiếu mới 12 (sổ đi trước phiếu) → 5.
    expect(
      wipNumbers({ done: 20, shipped: 12, received: null, used: 0, next_used: 15 })
        .on_hand,
    ).toBe(5)
    // Không truyền → như cũ.
    expect(wipNumbers({ done: 20, shipped: 0, received: null, used: 0 }).on_hand).toBe(20)
    expect(
      wipNumbers({ done: 20, shipped: 0, received: null, used: 0, next_used: null })
        .on_hand,
    ).toBe(20)
  })

  it('đầu chuỗi (received null) → khả dụng null, tồn vẫn tính', () => {
    const n = wipNumbers({ done: 120, shipped: 0, received: null, used: 125 })
    expect(n.available).toBeNull()
    expect(n.on_hand).toBe(120)
  })

  it('khả dụng được âm — đó là tín hiệu "ghi trước phiếu", không che', () => {
    expect(wipNumbers({ done: 0, shipped: 0, received: 30, used: 40 }).available).toBe(
      -10,
    )
  })

  it('làm tròn 2 số lẻ (kg / m)', () => {
    expect(wipNumbers({ done: 0.1 + 0.2, shipped: 0, received: 1, used: 0.3 })).toEqual({
      done: 0.3,
      shipped: 0,
      received: 1,
      on_hand: 0.3,
      available: 0.7,
    })
  })
})

describe('headReceived — đã nhận ở đầu lộ trình dòng gộp (10/11/2026)', () => {
  it('cụm mặc nhiên ở hàn: 14 chi tiết nhận đủ → 20 cụm; chi tiết chậm nhất quyết định', () => {
    // 20 SP · chân trước 2/SP nhận 40, ắc 6/SP nhận 120 → 20 bộ.
    expect(
      headReceived(
        [
          { received: 40, total: 40 },
          { received: 120, total: 120 },
        ],
        20,
      ),
    ).toBe(20)
    // Ắc mới nhận 60/120 → chỉ ghép được 10 cụm.
    expect(
      headReceived(
        [
          { received: 40, total: 40 },
          { received: 60, total: 120 },
        ],
        20,
      ),
    ).toBe(10)
  })

  it('kẹp trần SL dòng; con không có số nhận bị bỏ qua; không con nào hợp lệ → null', () => {
    expect(headReceived([{ received: 500, total: 40 }], 20)).toBe(20)
    expect(
      headReceived(
        [
          { received: null, total: 40 },
          { received: 20, total: 40 },
        ],
        20,
      ),
    ).toBe(10)
    expect(headReceived([{ received: null, total: 40 }], 20)).toBeNull()
    expect(headReceived([], 20)).toBeNull()
    expect(headReceived([{ received: 10, total: 0 }], 20)).toBeNull()
  })
})

describe('overAvailableWarning', () => {
  it('im lặng khi không có số nhận hoặc chưa vượt', () => {
    expect(overAvailableWarning('Cụm khung', 'Hàn', null, 999)).toBeNull()
    expect(overAvailableWarning('Cụm khung', 'Hàn', 30, 30)).toBeNull()
  })
  it('nói rõ vượt bao nhiêu khi ghi quá khả dụng', () => {
    expect(overAvailableWarning('Cụm khung', 'Hàn', 30, 40)).toBe(
      'Cụm khung @ Hàn: khả dụng 30 mà ghi 40 — vượt 10 so với số đã nhận từ công đoạn trước',
    )
  })
})

describe('transferTotals — phiếu giao tổ hai nhịp (0289)', () => {
  const docs = [
    {
      id: 'A',
      from_stage: 'han',
      to_stage: 'nguoi',
      status: 'da_nhan',
      reverses_doc_id: null,
    },
    {
      id: 'B',
      from_stage: 'han',
      to_stage: 'nguoi',
      status: 'da_giao',
      reverses_doc_id: null,
    },
    {
      id: 'C',
      from_stage: 'han',
      to_stage: 'nguoi',
      status: 'da_huy',
      reverses_doc_id: null,
    },
  ] as const
  const lines = [
    { doc_id: 'A', component_id: 'x', qty: 100, received_qty: 98 },
    { doc_id: 'B', component_id: 'x', qty: 50, received_qty: null },
    { doc_id: 'C', component_id: 'x', qty: 999, received_qty: null },
    { doc_id: null, component_id: 'x', qty: 7, received_qty: null },
  ]

  it('giao 100 nhận 98 + 50 chờ nhận: đã giao 150 ở hàn, đã nhận 98 ở nguội; huỷ và dòng rời không tính', () => {
    const t = transferTotals([...docs], lines)
    expect(t.get(totalKey('x', 'han'))).toEqual({
      shipped: 150,
      received: 0,
      has_inbound: false,
    })
    expect(t.get(totalKey('x', 'nguoi'))).toEqual({
      shipped: 0,
      received: 98,
      has_inbound: true,
    })
  })

  it('phiếu đảo (nguội → hàn, 2) là số ÂM của phiếu gốc', () => {
    const dao = {
      id: 'D',
      from_stage: 'nguoi',
      to_stage: 'han',
      status: 'da_nhan',
      reverses_doc_id: 'A',
    } as const
    const t = transferTotals(
      [...docs, dao],
      [...lines, { doc_id: 'D', component_id: 'x', qty: 2, received_qty: 2 }],
    )
    expect(t.get(totalKey('x', 'han'))?.shipped).toBe(148)
    expect(t.get(totalKey('x', 'nguoi'))?.received).toBe(96)
  })

  it('năm con số khớp tính tay: xong 250 · giao 148 · nhận 96 · dùng 40 → tồn 102, khả dụng 56', () => {
    expect(wipNumbers({ done: 250, shipped: 148, received: 96, used: 40 })).toEqual({
      done: 250,
      shipped: 148,
      received: 96,
      on_hand: 102,
      available: 56,
    })
  })
})
