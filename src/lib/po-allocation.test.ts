import { describe, expect, it } from 'vitest'
import { allocationNote, mergeAllocations } from './po-allocation'

/*
 * Chuẩn so là lối ghi TRONG SỔ THẬT (đơn TTL/MT/Wecare): mỗi sản phẩm một dòng
 * "50 bàn santorin (4c/sp)". Sai định dạng ở đây là ghi chú in lên phiếu NCC ký.
 */
describe('allocationNote — đúng lối ghi của sổ Cung ứng', () => {
  it('mỗi sản phẩm một dòng, kèm định mức (Nc/sp)', () => {
    expect(
      allocationNote([
        { product: 'Bàn Santorin', qty: 50, per_unit: 4 },
        { product: 'Bàn 65 gỗ', qty: 300, per_unit: 2 },
      ]),
    ).toBe('50 Bàn Santorin (4c/sp)\n300 Bàn 65 gỗ (2c/sp)')
  })

  it('không có định mức (hàng tính kg/m²) → chỉ SL + tên', () => {
    expect(allocationNote([{ product: 'Ghế Tilos', qty: 126, per_unit: null }])).toBe(
      '126 Ghế Tilos',
    )
  })

  it('SL nghìn có dấu chấm vi-VN, dòng rác (qty 0 / tên trống) bị bỏ', () => {
    expect(
      allocationNote([
        { product: 'Bồn hoa lớn', qty: 1050, per_unit: 10 },
        { product: '', qty: 5, per_unit: 1 },
        { product: 'Ghế X', qty: 0, per_unit: 2 },
      ]),
    ).toBe('1.050 Bồn hoa lớn (10c/sp)')
  })
})

describe('mergeAllocations — gộp nhiều LSX', () => {
  it('cùng SP + cùng định mức thì cộng SL', () => {
    expect(
      mergeAllocations(
        [{ product: 'Bàn Santorin', qty: 450, per_unit: 4 }],
        [{ product: 'Bàn Santorin', qty: 50, per_unit: 4 }],
      ),
    ).toEqual([{ product: 'Bàn Santorin', qty: 500, per_unit: 4 }])
  })

  it('khác định mức thì giữ hai dòng — 2c/sp và 4c/sp là hai cách dùng thật', () => {
    const out = mergeAllocations(
      [{ product: 'Bàn Santorin', qty: 450, per_unit: 2 }],
      [{ product: 'Bàn Santorin', qty: 50, per_unit: 4 }],
    )
    expect(out).toHaveLength(2)
  })

  it('không phá mảng gốc', () => {
    const a = [{ product: 'A', qty: 1, per_unit: 1 }]
    mergeAllocations(a, [{ product: 'A', qty: 9, per_unit: 1 }])
    expect(a[0].qty).toBe(1)
  })
})
