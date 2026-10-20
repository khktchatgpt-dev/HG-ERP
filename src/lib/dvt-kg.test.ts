import { describe, expect, it } from 'vitest'
import { laDvtKg } from './dvt-kg'
import { qtyTotals } from './po-line'
import { poField, poFieldText } from './po-fields'
import { poHaiGia } from './po-hai-gia'

/*
 * DÒNG ĐVT KG TRONG MẪU NHÔM / SẮT (10/10/2026 — soi đơn TEST PO-2026-0169: dòng
 * NHO0090 "Nhôm 20x40" ĐVT Kg bị chặn lưu "thiếu kg/m"). SL đặt chính là số kg.
 */
describe('dòng ĐVT Kg', () => {
  it('nhận các cách ghi đơn vị kg', () => {
    expect(['Kg', 'kg ', 'KG', 'kí', 'Ký'].every(laDvtKg)).toBe(true)
    expect(['Cây', 'Tấm', '', null].some(laDvtKg)).toBe(false)
  })

  it('"Tổng số KG" trên phiếu cộng cả dòng ĐVT Kg (SL đặt), không sót', () => {
    const r = qtyTotals(true, [
      { material_unit: 'Cây', qty_ordered: 288, qty2: 313.2864 },
      { material_unit: 'Kg', qty_ordered: 63, qty2: null },
    ])
    expect(r).toEqual([{ label: 'Tổng số KG', value: 313.2864 + 63 }])
  })

  it('cột Tổng kg trên phiếu / màn ký: dòng ĐVT Kg in SL đặt', () => {
    const f = poField('aluminium', 'kgtotal')!
    expect(poFieldText(f, { material_unit: 'Kg', qty_ordered: 63, qty2: null })).toBe(
      '63',
    )
    expect(poFieldText(f, { material_unit: 'Cây', qty_ordered: 7, qty2: null })).toBe('')
  })

  it('màn ký: giá /kg của dòng ĐVT Kg = đơn giá', () => {
    const g = poHaiGia('aluminium', { qty_ordered: 63, unit_price: 113_000, price_basis: 'unit', qty2: null, material_unit: 'Kg' }) // prettier-ignore
    expect([g?.donGia, g?.gia2]).toEqual([113_000, 113_000])
  })
})
