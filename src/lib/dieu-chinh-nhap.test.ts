import { describe, expect, it } from 'vitest'
import { soHienTai, tinhChenhLech, type DongGoc } from './dieu-chinh-nhap'
import { dieuChinhCua } from './da-ve'

const goc: DongGoc[] = [
  { po_line_id: 'L1', material_id: 'M1', qty: 1300, unit_cost: 25000, reason_code: 'N1' },
  // Cùng dòng đơn, phần khoá nằm ở dòng sổ thứ hai.
  { po_line_id: 'L1', material_id: 'M1', qty: 20, unit_cost: 25000, reason_code: 'N1' },
  { po_line_id: 'L2', material_id: 'M2', qty: 50, unit_cost: null, reason_code: 'N1' },
]

describe('điều chỉnh chênh lệch phiếu nhập (C)', () => {
  it('gom theo dòng đơn: hai dòng sổ cùng dòng đơn cộng lại', () => {
    expect(soHienTai(goc, []).get('L1')?.hien).toBe(1320)
  })

  it('ghi thừa → chênh âm (xuất điều chỉnh), ghi thiếu → chênh dương', () => {
    const r = tinhChenhLech(
      goc,
      [],
      [
        { po_line_id: 'L1', qty: 1050 },
        { po_line_id: 'L2', qty: 60 },
      ],
    )
    expect(r.loi).toEqual([])
    expect(r.dong.map((d) => [d.po_line_id, d.chenh])).toEqual([
      ['L1', -270],
      ['L2', 10],
    ])
    expect(r.dong[0].unit_cost).toBe(25000) // giá vốn theo dòng gốc
  })

  it('tính trên số ĐÃ điều chỉnh trước, không phải số gốc', () => {
    const r = tinhChenhLech(
      goc,
      [{ po_line_id: 'L1', direction: 'out', qty: 270 }],
      [{ po_line_id: 'L1', qty: 1000 }],
    )
    expect(r.dong[0]).toMatchObject({ hien: 1050, moi: 1000, chenh: -50 })
  })

  it('không đổi gì / số âm / dòng lạ → lỗi, không ghi', () => {
    expect(tinhChenhLech(goc, [], [{ po_line_id: 'L2', qty: 50 }]).loi).toEqual([
      'Chưa đổi số dòng nào',
    ])
    expect(tinhChenhLech(goc, [], [{ po_line_id: 'L2', qty: -1 }]).loi[0]).toMatch(/không âm/) // prettier-ignore
    expect(tinhChenhLech(goc, [], [{ po_line_id: 'LX', qty: 5 }]).loi[0]).toMatch(/không thuộc/) // prettier-ignore
  })

  it('trạng thái lượng: dòng đơn có phần dùng được thì lệch vào "ok"; cả dòng khoá thì vào khoá', () => {
    const coKhoa: DongGoc[] = [
      // L1: phần khoá đứng TRƯỚC phần dùng được — vẫn phải chọn 'ok'.
      { po_line_id: 'L1', material_id: 'M1', qty: 20, unit_cost: 1, reason_code: 'N1', stock_status: 'blocked', bin_id: 'KHOA' }, // prettier-ignore
      { po_line_id: 'L1', material_id: 'M1', qty: 1300, unit_cost: 1, reason_code: 'N1', stock_status: 'ok', bin_id: 'TIEP' }, // prettier-ignore
      // L2: cả dòng đơn là hàng sai quy cách.
      { po_line_id: 'L2', material_id: 'M2', qty: 50, unit_cost: 1, reason_code: 'N1', stock_status: 'blocked', bin_id: 'KHOA' }, // prettier-ignore
    ]
    const r = tinhChenhLech(
      coKhoa,
      [],
      [
        { po_line_id: 'L1', qty: 1300 },
        { po_line_id: 'L2', qty: 40 },
      ],
    )
    expect(r.dong.map((d) => [d.po_line_id, d.stock_status, d.bin_id])).toEqual([
      ['L1', 'ok', 'TIEP'],
      ['L2', 'blocked', 'KHOA'],
    ])
    // Dòng sổ cũ không mang trạng thái = dùng được.
    expect(soHienTai(goc, []).get('L2')).toMatchObject({
      stock_status: 'ok',
      bin_id: null,
    })
  })

  it('đọc dấu nối phiếu điều chỉnh → phiếu gốc', () => {
    expect(dieuChinhCua('Điều chỉnh phiếu PNK-2026-0053')).toBe('PNK-2026-0053')
    expect(dieuChinhCua('Sửa lại PNK-2026-0053 (đã đảo bởi PXK-1)')).toBeNull()
  })
})
