import { describe, it, expect } from 'vitest'
import {
  suggestForMaterial,
  suggestPurchase,
  type MaterialSuggestInput,
} from './po-suggestion'

const base: MaterialSuggestInput = {
  material_id: 'm1',
  needed: 0,
  on_hand: 0,
  reserved_others: 0,
  ordered: 0,
  pending: 0,
}

describe('đề xuất mua PO — Cách 2, GĐ-gated (§P1)', () => {
  it('kho đủ, không LSX khác tranh → không cần mua', () => {
    const r = suggestForMaterial({ ...base, needed: 60, on_hand: 100 })
    expect(r.available).toBe(100)
    expect(r.suggest).toBe(0)
    expect(r.enough).toBe(true)
  })

  it('LSX khác giữ chỗ tồn → phải mua phần thiếu (ví dụ chuẩn: 100−80, cần 60 → mua 40)', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 60,
      on_hand: 100,
      reserved_others: 80, // LSX-A approved cần 80
    })
    expect(r.available).toBe(20) // 100 − 80
    expect(r.suggest).toBe(40) // 60 − 20
    expect(r.enough).toBe(false)
  })

  it('đã có PO đã duyệt trừ tiếp vào đề xuất', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 60,
      on_hand: 100,
      reserved_others: 80,
      ordered: 15, // đã đặt 15 (approved→partial)
    })
    expect(r.suggest).toBe(25) // 60 − 20 − 15
  })

  it('PO chờ duyệt KHÔNG trừ, chỉ bật cờ cảnh báo trùng', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 60,
      on_hand: 0,
      pending: 40, // đang chờ GĐ duyệt
    })
    expect(r.suggest).toBe(60) // pending không trừ
    expect(r.has_pending).toBe(true)
  })

  it('reserved_others vượt tồn → available kẹp 0, không âm', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 30,
      on_hand: 50,
      reserved_others: 90, // LSX khác cần nhiều hơn tồn
    })
    expect(r.available).toBe(0)
    expect(r.suggest).toBe(30)
  })

  it('đặt dư (đã đặt > cần) → đề xuất kẹp 0, không ra số âm', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 60,
      on_hand: 0,
      ordered: 100,
    })
    expect(r.suggest).toBe(0)
    expect(r.enough).toBe(true)
  })

  it('SL lẻ (kg) vẫn đúng, làm tròn 4 số', () => {
    const r = suggestForMaterial({
      ...base,
      needed: 12.5,
      on_hand: 3.2,
      reserved_others: 1.1,
    })
    expect(r.available).toBeCloseTo(2.1, 4)
    expect(r.suggest).toBeCloseTo(10.4, 4)
  })

  it('suggestPurchase map nhiều vật tư', () => {
    const rows = suggestPurchase([
      { ...base, material_id: 'a', needed: 10, on_hand: 4 },
      { ...base, material_id: 'b', needed: 5, on_hand: 20 },
    ])
    expect(rows.map((r) => [r.material_id, r.suggest])).toEqual([
      ['a', 6],
      ['b', 0],
    ])
  })
})
