import { describe, it, expect } from 'vitest'
import { toBase, fromBase, convert, type Uom } from './uom'

describe('UoM quy đổi (item_uom §5)', () => {
  it('toBase: qty × to_base (thùng 30kg → kg)', () => {
    expect(toBase(2, 30)).toBe(60) // 2 thùng = 60 kg
    expect(toBase(0, 30)).toBe(0)
  })

  it('fromBase: qty ÷ to_base (base cây, mét = 1/6 → 5 cây = 30 mét)', () => {
    expect(fromBase(5, 1 / 6)).toBe(30)
    expect(fromBase(60, 30)).toBe(2) // 60 kg = 2 thùng
  })

  it('roundtrip toBase ∘ fromBase = identity', () => {
    const f = 1 / 8.4 // kg.to_base của ống 6m nặng 8.4kg
    expect(fromBase(toBase(100, f), f)).toBeCloseTo(100, 4)
  })

  it('convert: mua kg → tồn cây (ống 6m = 8.4kg, 840kg → 100 cây)', () => {
    const cay: Uom = { unit: 'cây', to_base: 1 } // base_unit
    const kg: Uom = { unit: 'kg', to_base: 1 / 8.4 }
    expect(convert(840, kg, cay)).toBeCloseTo(100, 4)
    // ngược lại: 100 cây → 840 kg
    expect(convert(100, cay, kg)).toBeCloseTo(840, 4)
  })

  it('convert giữa 2 đơn vị phụ (kg ↔ mét cùng vật tư)', () => {
    const kg: Uom = { unit: 'kg', to_base: 1 / 8.4 } // base cây
    const met: Uom = { unit: 'mét', to_base: 1 / 6 }
    // 8.4 kg = 1 cây = 6 mét
    expect(convert(8.4, kg, met)).toBeCloseTo(6, 4)
  })

  it('to_base ≤ 0 → ném lỗi (không cho hệ số quy đổi phi lý)', () => {
    expect(() => toBase(1, 0)).toThrow()
    expect(() => fromBase(1, -2)).toThrow()
    expect(() =>
      convert(1, { unit: 'x', to_base: 0 }, { unit: 'y', to_base: 1 }),
    ).toThrow()
  })
})
