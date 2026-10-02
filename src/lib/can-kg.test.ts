import { describe, expect, it } from 'vitest'
import { canCanKg, kgDuKien, lechKg } from './can-kg'

describe('canCanKg', () => {
  it('mẫu nhôm / thép KHÔNG tự bật ô kg — đơn trả tiền theo cây nhận đủ cây là xong (02/10)', () => {
    expect(canCanKg('aluminium', {})).toBe(false)
    expect(canCanKg('metal_kg', { price_basis: 'unit' })).toBe(false)
    expect(canCanKg('metal_kg', { price_basis: 'unit2', unit2: 'kg' })).toBe(true)
  })

  it('mẫu khác: chỉ khi dòng tính giá theo kg', () => {
    expect(canCanKg('accessory', { price_basis: 'unit2', unit2: 'kg' })).toBe(true)
    expect(canCanKg('accessory', { price_basis: 'unit2', unit2: 'Kg ' })).toBe(true)
    expect(canCanKg('paint', { price_basis: 'unit2', unit2: 'lít' })).toBe(false)
    expect(canCanKg('carton', { price_basis: 'unit' })).toBe(false)
    expect(canCanKg(null, {})).toBe(false)
  })
})

describe('kgDuKien / lechKg', () => {
  it('chia tổng kg của dòng theo số cây nhận', () => {
    // PO-2026-0114 dòng 10: 137 cây, 354,145 kg
    expect(kgDuKien(137, { qty_ordered: 137, qty2: 354.145 })).toBe(354.15)
    expect(kgDuKien(100, { qty_ordered: 200, qty2: 500 })).toBe(250)
    expect(kgDuKien(10, { qty_ordered: 0, qty2: 500 })).toBeNull()
    expect(kgDuKien(10, { qty_ordered: 10, qty2: null })).toBeNull()
  })

  it('lệch % so với dự kiến', () => {
    expect(lechKg(346.7, 354.15)).toBe(-2.1)
    expect(lechKg(354.15, 354.15)).toBe(0)
    expect(lechKg(0, 354.15)).toBeNull()
    expect(lechKg(10, null)).toBeNull()
  })
})
