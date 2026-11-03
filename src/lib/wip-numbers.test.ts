import { describe, expect, it } from 'vitest'
import { overAvailableWarning, wipNumbers } from './wip-numbers'

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
