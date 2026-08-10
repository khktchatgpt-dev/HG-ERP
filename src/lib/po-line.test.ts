import { describe, it, expect } from 'vitest'
import { poLineAmount, priceUnitLabel, qtyTotals } from './po-line'

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

describe('qtyTotals — dòng "Tổng số …" dưới bảng hàng (0128)', () => {
  const line = (unit: string, qty: number, qty2: number | null = null) => ({
    material_unit: unit,
    qty_ordered: qty,
    qty2,
  })

  it('mẫu tính theo kg: đúng MỘT dòng, cộng cột tổng kg', () => {
    expect(
      qtyTotals(true, [line('Cây', 120, 141.636), line('Cây', 80, 69.7856)]),
    ).toEqual([{ label: 'Tổng số KG', value: 211.4216 }])
  })

  it('mẫu thường, mọi dòng cùng ĐVT: một dòng như cũ', () => {
    expect(qtyTotals(false, [line('Thùng', 300), line('Thùng', 200)])).toEqual([
      { label: 'Tổng số THÙNG', value: 500 },
    ])
  })

  it('đơn TRỘN ĐVT: mỗi đơn vị một dòng, KHÔNG cộng chung và không mất dòng tổng', () => {
    // Hồi quy: bản cũ trả null khi trộn đơn vị nên phiếu phụ kiện (gần như luôn
    // trộn Con/Bộ/Mét) mất hẳn dòng tổng, im lặng.
    expect(
      qtyTotals(false, [
        line('Con', 540),
        line('Bộ', 12),
        line('Con', 1_000),
        line('Mét', 45),
      ]),
    ).toEqual([
      { label: 'Tổng số CON', value: 1_540 },
      { label: 'Tổng số BỘ', value: 12 },
      { label: 'Tổng số MÉT', value: 45 },
    ])
  })

  it('bỏ dòng tổng bằng 0 và không vỡ khi thiếu ĐVT', () => {
    expect(qtyTotals(true, [line('Cây', 10, 0)])).toEqual([])
    expect(qtyTotals(false, [line('', 7)])).toEqual([{ label: 'Tổng số', value: 7 }])
  })
})

/* `packCount` / `roundUpToPack` đã có bộ test riêng ở
   `app/(workspace)/planning/pos/new/po-line.test.ts` (theo ca thật của đơn Tân
   Hiệp Phát) — hai hàm chỉ DỜI sang đây ở 0128, không đổi hành vi. */

describe('priceUnitLabel', () => {
  it("unit2 + đơn vị → 'Đơn giá/kg'; còn lại 'Đơn giá'", () => {
    expect(priceUnitLabel('unit2', 'kg')).toBe('Đơn giá/kg')
    expect(priceUnitLabel('unit2', null)).toBe('Đơn giá')
    expect(priceUnitLabel('unit', 'kg')).toBe('Đơn giá')
    expect(priceUnitLabel(null, undefined)).toBe('Đơn giá')
  })
})
