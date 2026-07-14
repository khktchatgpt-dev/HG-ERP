import { describe, it, expect } from 'vitest'
import {
  hasQty2,
  isQty2Locked,
  suggestQty2,
  profileLineMapping,
} from './material-profile'
import { poLineAmount } from './po-line'

describe('hasQty2 / isQty2Locked — ô SL tính giá theo profile', () => {
  it('A: không có qty2', () => {
    expect(hasQty2('A')).toBe(false)
    expect(isQty2Locked('A')).toBe(false)
  })
  it('B: có qty2 và KHOÁ (hệ số cứng)', () => {
    expect(hasQty2('B')).toBe(true)
    expect(isQty2Locked('B')).toBe(true)
  })
  it('C: có qty2 nhưng MỞ (cân thực sửa được)', () => {
    expect(hasQty2('C')).toBe(true)
    expect(isQty2Locked('C')).toBe(false)
  })
})

describe('suggestQty2 — gợi ý SL tính giá', () => {
  it('A: luôn null (tính thẳng trên SL đặt)', () => {
    expect(suggestQty2('A', 5.4, 10)).toBeNull()
    expect(suggestQty2('A', null, 10, 50)).toBeNull()
  })

  it('B: SL × hệ số cứng — sơn 5 thùng × 18 lít = 90', () => {
    expect(suggestQty2('B', 18, 5)).toBe(90)
  })

  it('C: ưu tiên kg cân thực từ BOM khi có', () => {
    // 50 cây × 10.1 = 505 lý thuyết, nhưng BOM cân thực 500 → lấy 500
    expect(suggestQty2('C', 10.1, 50, 500)).toBe(500)
  })

  it('C: không có kg BOM → rơi về SL × định mức', () => {
    expect(suggestQty2('C', 10.1, 50)).toBe(505)
    expect(suggestQty2('C', 10.1, 50, null)).toBe(505)
  })

  it('thiếu qty hoặc factor → null (giữ ô trống, nhập tay)', () => {
    expect(suggestQty2('B', null, 5)).toBeNull()
    expect(suggestQty2('B', 18, null)).toBeNull()
    expect(suggestQty2('C', 0, 0)).toBeNull()
  })

  it('làm tròn 2 số lẻ', () => {
    expect(suggestQty2('C', 7.5399, 3)).toBe(22.62)
  })
})

describe('profileLineMapping — dựng payload dòng PO', () => {
  it("A → price_basis 'unit', unit2 null", () => {
    expect(profileLineMapping('A', null)).toEqual({ price_basis: 'unit', unit2: null })
    // price_unit thừa vẫn bỏ qua với A
    expect(profileLineMapping('A', 'kg')).toEqual({ price_basis: 'unit', unit2: null })
  })
  it("B/C → price_basis 'unit2', unit2 = đơn vị tính giá", () => {
    expect(profileLineMapping('B', 'lít')).toEqual({ price_basis: 'unit2', unit2: 'lít' })
    expect(profileLineMapping('C', 'kg')).toEqual({ price_basis: 'unit2', unit2: 'kg' })
  })
})

describe('tính tiền end-to-end theo profile (qua poLineAmount)', () => {
  it('A — bản lề: 200 cái × 12.000 = 2.400.000', () => {
    const { price_basis } = profileLineMapping('A', null)
    expect(poLineAmount({ qty_ordered: 200, unit_price: 12_000, price_basis })).toBe(
      2_400_000,
    )
  })

  it('B — sơn PU: 5 thùng → 90 lít (khoá) × 320.000 = 28.800.000', () => {
    const map = profileLineMapping('B', 'lít')
    const qty2 = suggestQty2('B', 18, 5)! // 90, khoá
    expect(poLineAmount({ qty_ordered: 5, unit_price: 320_000, ...map, qty2 })).toBe(
      28_800_000,
    )
  })

  it('C — sắt hộp: 50 cây, cân thực 500 kg × 18.500 = 9.250.000', () => {
    const map = profileLineMapping('C', 'kg')
    const qty2 = suggestQty2('C', 10.1, 50, 500)! // 500 (cân thực, không phải 505)
    expect(poLineAmount({ qty_ordered: 50, unit_price: 18_500, ...map, qty2 })).toBe(
      9_250_000,
    )
  })
})
