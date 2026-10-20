import { describe, expect, it } from 'vitest'
import { chenhGia, dangVeCau, giaTruocCau, tonNhan, trungCau } from './de-nghi-goi-y'

/** Câu chữ dưới một dòng đề nghị (Đ6 · DN-7/DN-8). */
describe('tonNhan — chưa theo dõi ≠ hết hàng', () => {
  it('mã chưa từng có giao dịch, tồn 0 → "chưa theo dõi", không tô hết', () => {
    expect(tonNhan({ ton: 0, theo_doi: false })).toEqual({ text: 'chưa theo dõi trên sổ', het: false, chuaTheoDoi: true }) // prettier-ignore
  })
  it('đã có giao dịch, tồn 0 → hết thật; còn hàng → số', () => {
    expect(tonNhan({ ton: 0, theo_doi: true })).toMatchObject({
      het: true,
      chuaTheoDoi: false,
    })
    expect(tonNhan({ ton: 1390, theo_doi: true })).toMatchObject({
      text: '1.390',
      het: false,
    })
  })
  it('dòng chưa có mã → không bày tồn', () => {
    expect(tonNhan({ ton: null })).toBeNull()
  })
})

it('giaTruocCau — ngày theo giờ VN, cả kiểu timestamp (đơn mua) lẫn ngày (phiếu nhập)', () => {
  expect(giaTruocCau({ unit_price: 5200, po_code: 'PNK-2026-0121', supplier_name: 'Tiệm Tân Hưng', at: '2026-10-02' })).toBe('lần trước 5.200 · 02/10 · Tiệm Tân Hưng') // prettier-ignore
  expect(giaTruocCau({ unit_price: 5500, po_code: 'PO-2026-0140', supplier_name: 'Phước Khang', at: '2026-10-05T18:00:00Z' })).toBe('lần trước 5.500 · 06/10 · Phước Khang') // prettier-ignore
  expect(giaTruocCau(null)).toBeNull()
})

it('chenhGia — % so với lần trước, không so được thì null', () => {
  const g = { unit_price: 5200, po_code: 'x', supplier_name: 'y', at: '2026-10-02' }
  expect(chenhGia(5500, g)).toBe(6)
  expect(chenhGia(4680, g)).toBe(-10)
  expect(chenhGia(null, g)).toBeNull()
  expect(chenhGia(5500, null)).toBeNull()
})

it('trungCau / dangVeCau', () => {
  expect(trungCau([{ code: 'DNM-2026-0005', status: 'pending', qty: 20 }], 'Đôi')).toBe('đang có trong DNM-2026-0005 (chờ duyệt, 20 Đôi)') // prettier-ignore
  expect(trungCau([{ code: 'A', status: 'approved', qty: 1 }, { code: 'B', status: 'pending', qty: 2 }], 'Kg')).toBe('đang có trong A (đã duyệt, 1 Kg) + 1 phiếu khác') // prettier-ignore
  expect(dangVeCau([{ po_code: 'PO-2026-0174', qty_open: 20 }], 'kg')).toBe('PO-2026-0174 còn về 20 kg') // prettier-ignore
  expect(dangVeCau([{ po_code: 'P1', qty_open: 5 }, { po_code: 'P2', qty_open: 15 }], 'kg')).toBe('2 đơn mua còn về 20 kg (P1…)') // prettier-ignore
  expect(trungCau([], 'x')).toBeNull()
  expect(dangVeCau(undefined, 'x')).toBeNull()
})
