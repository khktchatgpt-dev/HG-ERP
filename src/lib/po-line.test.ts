import { describe, it, expect } from 'vitest'
import { poLineAmount, priceUnitLabel } from './po-line'

describe('poLineAmount — giá đơn vị kép (0053)', () => {
  it("basis 'unit' (mặc định): SL đặt × đơn giá — vật tư nhóm A", () => {
    expect(poLineAmount({ qty_ordered: 30, unit_price: 380_000 })).toBe(11_400_000)
    expect(
      poLineAmount({ qty_ordered: 30, unit_price: 380_000, price_basis: 'unit' }),
    ).toBe(11_400_000)
    // dòng cũ trước migration: price_basis null → như 'unit'
    expect(
      poLineAmount({ qty_ordered: 30, unit_price: 380_000, price_basis: null }),
    ).toBe(11_400_000)
  })

  it("basis 'unit2': tổng kg × đơn giá/kg — sắt hộp 10 cây = 54 kg × 18.500", () => {
    expect(
      poLineAmount({
        qty_ordered: 10,
        unit_price: 18_500,
        price_basis: 'unit2',
        qty2: 54,
      }),
    ).toBe(999_000)
  })

  it("basis 'unit2' thiếu qty2 → 0, KHÔNG rơi về SL đặt (tránh in tổng sai)", () => {
    expect(
      poLineAmount({ qty_ordered: 10, unit_price: 18_500, price_basis: 'unit2' }),
    ).toBe(0)
    expect(
      poLineAmount({
        qty_ordered: 10,
        unit_price: 18_500,
        price_basis: 'unit2',
        qty2: null,
      }),
    ).toBe(0)
  })

  it('chưa có đơn giá → 0 (đơn nháp chưa hỏi giá)', () => {
    expect(poLineAmount({ qty_ordered: 10, unit_price: null })).toBe(0)
    expect(
      poLineAmount({ qty_ordered: 10, unit_price: null, price_basis: 'unit2', qty2: 54 }),
    ).toBe(0)
  })
})

describe('priceUnitLabel', () => {
  it("unit2 + đơn vị → 'Đơn giá/kg'; còn lại 'Đơn giá'", () => {
    expect(priceUnitLabel('unit2', 'kg')).toBe('Đơn giá/kg')
    expect(priceUnitLabel('unit2', null)).toBe('Đơn giá')
    expect(priceUnitLabel('unit', 'kg')).toBe('Đơn giá')
    expect(priceUnitLabel(null, undefined)).toBe('Đơn giá')
  })
})
