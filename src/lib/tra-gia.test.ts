import { describe, expect, it } from 'vitest'
import { giaSo, lapChiMuc, traMon, type TgDong } from './tra-gia'
import { docQuyCach } from './quy-cach'

let n = 0
const NHOM = { template: 'aluminium', group_name: 'Nhôm định hình - tấm' }
const THEP = {
  template: 'metal_kg',
  group_name: 'Sắt thép - tôn - tấm',
  sub_group: 'Thép hộp',
}
const BUL = { template: 'accessory', group_name: 'Bu lông - vít - đinh - liên kết', sub_group: 'Bu lông' } // prettier-ignore

/** Dòng đơn theo số thật đo 28/10 — mặc định 1 cây nhôm 1 kg, giá theo kg. */
const D = (p: Partial<TgDong>): TgDong => ({
  line_id: `l${++n}`,
  po_id: `po-${p.po_code ?? n}`,
  po_code: `PO-2026-${String(n).padStart(4, '0')}`,
  status: 'received',
  at: '2026-10-03',
  supplier_id: 'qm',
  supplier_name: 'Nhôm Thép Quang Minh',
  material_id: `m${n}`,
  code: `NH-${n}`,
  name: 'Nhôm phi 25x1li',
  unit: 'Cây',
  group_name: null,
  sub_group: null,
  template: null,
  finish: null,
  qty: 1,
  qty2: 1,
  unit2: 'kg',
  unit_price: 108000,
  price_basis: 'unit2',
  currency: 'VND',
  ...p,
})

const PHI25 = [
  D({ ...NHOM, sub_group: 'Nhôm ống tròn - phi', code: 'NH-0573', name: 'Nhôm phi 25x1li dài 5.65m' }), // prettier-ignore
  D({ ...NHOM, sub_group: 'Nhôm ống tròn - phi', code: 'NH-0003', name: 'Nhôm phi 25x1li', at: '2026-09-18', supplier_id: 'dg', supplier_name: 'Nhôm Đoàn Gia', unit_price: 113000 }), // prettier-ignore
  D({ ...NHOM, sub_group: 'Nhôm ống tròn - phi', code: 'NH-0607', name: 'Nhôm phi 25 x1.0 (dài 5.8m)', at: '2026-10-14', supplier_id: 'ns', supplier_name: 'SX TM Ngô Sơn', unit_price: 113000 }), // prettier-ignore
  D({ ...NHOM, sub_group: 'Nhôm ống tròn - phi', code: 'NH-0608', name: 'Nhôm phi 25 x1.0 (dài 5.7m)', at: '2026-10-14', supplier_id: 'ns', supplier_name: 'SX TM Ngô Sơn', unit_price: 113000 }), // prettier-ignore
  D({ ...NHOM, sub_group: 'Nhôm ống tròn - phi', code: 'NH-0597', name: 'Nhôm phi 22x1li dài 5.57m' }), // prettier-ignore
]

describe('giaSo — giá đem so', () => {
  it('dòng mua theo CÂY quy về đ/kg bằng thành tiền ÷ kg, kèm phép tính (Thép Visa PO-2026-0116)', () => {
    const d = D({ ...THEP, name: 'Thép hộp vuông 20x40x1.0', unit: 'Cây', qty: 210, qty2: 1146.6, unit_price: 106500, price_basis: 'unit' }) // prettier-ignore
    const g = giaSo(d, docQuyCach(d.name, { template: d.template, group: d.group_name }))!
    expect(Math.round(g.gia)).toBe(19505)
    expect(g.dv).toBe('kg')
    expect(g.quy?.gia_goc).toBe(106500)
    expect(g.quy?.moi).toBeCloseTo(5.46, 2)
  })
  it('không có giá thì không đem so', () => {
    const d = D({ unit_price: null })
    expect(giaSo(d, docQuyCach(d.name))).toBeNull()
  })
  it('món theo cái giữ giá theo ĐVT', () => {
    const d = D({ ...BUL, name: 'Bulon 6x20x13', unit: 'Con', unit2: null, qty2: null, price_basis: 'unit', unit_price: 160 }) // prettier-ignore
    expect(giaSo(d, docQuyCach(d.name, { template: d.template, group: d.group_name }))).toEqual({ gia: 160, dv: 'Con', quy: null }) // prettier-ignore
  })
})

describe('traMon — một món, mọi NCC đã bán', () => {
  const cm = lapChiMuc(PHI25)

  it('nhôm phi 25 dày 1.0: 5 mã gom về 1 quy cách, 3 NCC, rẻ nhất Quang Minh', () => {
    const r = traMon('nhôm phi 25 x1.0', cm)
    expect(r.trang_thai).toBe('ok')
    expect(r.quy_cach?.label).toBe('Nhôm ống phi 25 · dày 1.0')
    expect(r.so_ma).toBe(4)
    expect(r.ncc.map((x) => x.supplier_name)).toEqual(['Nhôm Thép Quang Minh', 'SX TM Ngô Sơn', 'Nhôm Đoàn Gia']) // prettier-ignore
    expect(r.re_nhat).toBe(108000)
    expect(r.dv_so).toBe('kg')
    // Ngô Sơn hai mã (hai chiều dài cây) — gộp một dòng NCC, kể đủ mã.
    expect(r.ncc[1].ma).toEqual(['NH-0607', 'NH-0608'])
  })

  it('hoà giá thì NCC mua gần hơn đứng trước', () => {
    const r = traMon('nhôm phi 25 x1.0', cm)
    expect(r.ncc[1].at > r.ncc[2].at).toBe(true)
  })

  it('gõ mã vật tư thì ra quy cách của mã đó', () => {
    expect(traMon('nh-0607', cm).quy_cach?.label).toBe('Nhôm ống phi 25 · dày 1.0')
  })

  it('đơn nháp: bày cuối, không xếp hạng, không tính vào số NCC so được', () => {
    const cm2 = lapChiMuc([
      D({ ...THEP, name: 'Thép hộp 20x40x0.8mm (dài 6m)', supplier_id: 'kp', supplier_name: 'Thép Kim Phát', unit_price: 21230, status: 'confirmed' }), // prettier-ignore
      D({ ...THEP, name: 'Sắt hộp 20x40 x0.8mm (dài 5.9m)', supplier_id: 'nh', supplier_name: 'Kim khí Nam Hưng', unit_price: 20053, status: 'draft' }), // prettier-ignore
    ])
    const r = traMon('sắt hộp 20x40 0.8', cm2)
    expect(r.trang_thai).toBe('one')
    expect(r.ncc.map((x) => [x.supplier_name, x.chot, x.so_duoc])).toEqual([
      ['Thép Kim Phát', true, true],
      ['Kim khí Nam Hưng', false, false],
    ])
    expect(r.re_nhat).toBe(21230)
  })

  it('NCC có cả đơn chốt lẫn đơn nháp mới hơn: lấy giá CHỐT', () => {
    const cm2 = lapChiMuc([
      D({ at: '2026-10-03', unit_price: 108000 }),
      D({ at: '2026-10-25', unit_price: 99000, status: 'pending_approval' }),
    ])
    const r = traMon('nhôm phi 25 1li', cm2)
    expect(r.ncc).toHaveLength(1)
    expect(r.ncc[0].gia).toBe(108000)
    expect(r.ncc[0].chot).toBe(true)
  })

  it('khác đơn vị giá thì không so chung (đ/kg với đ/cây không lên cùng bảng xếp hạng)', () => {
    const cm2 = lapChiMuc([
      D({ supplier_id: 'a', supplier_name: 'A', unit_price: 108000 }),
      D({ supplier_id: 'b', supplier_name: 'B', unit_price: 113000 }),
      D({ supplier_id: 'c', supplier_name: 'C', unit_price: 95000, unit2: null, qty2: null, price_basis: 'unit' }), // prettier-ignore
    ])
    const r = traMon('nhôm phi 25 1li', cm2)
    expect(r.ncc.map((x) => [x.supplier_name, x.so_duoc])).toEqual([['A', true], ['B', true], ['C', false]]) // prettier-ignore
    expect(r.re_nhat).toBe(108000)
  })
})

describe('traMon — mơ hồ, món mới, không khớp', () => {
  const cm = lapChiMuc([
    D({ ...THEP, name: 'Thép hộp vuông 20x40x1.0', supplier_id: 'asia', supplier_name: 'Thép Asia', unit_price: 19500 }), // prettier-ignore
    D({ ...THEP, name: 'Thép hộp vuông 20x40x1.0', supplier_id: 'visa', supplier_name: 'Thép Visa', unit_price: 19505 }), // prettier-ignore
    D({ ...THEP, name: 'Thép hộp 20x40x0.8mm (dài 6m)', supplier_id: 'kp', supplier_name: 'Thép Kim Phát', unit_price: 21230 }), // prettier-ignore
    ...PHI25,
    D({ ...BUL, name: 'Bulon 6x20x13', unit: 'Con', unit2: null, qty2: null, price_basis: 'unit', unit_price: 160, supplier_id: 'tn', supplier_name: 'Tường Nguyên' }), // prettier-ignore
    D({ ...BUL, name: 'Bulon 6x20x13, xi đen', unit: 'Con', unit2: null, qty2: null, price_basis: 'unit', unit_price: 210, supplier_id: 'thn', supplier_name: 'Ngũ kim Thành Nghĩa' }), // prettier-ignore
    D({ ...BUL, name: 'Bulon 6X20X15 màu', unit: 'Con', unit2: null, qty2: null, price_basis: 'unit', unit_price: 200, supplier_id: 'mt', supplier_name: 'TM DV Minh Thắng' }), // prettier-ignore
  ])

  it('gõ thiếu độ dày → mơ hồ, liệt kê quy cách để chọn; chọn rồi thì ra giá', () => {
    const r = traMon('thép hộp 20x40', cm)
    expect(r.trang_thai).toBe('mo_ho')
    expect(r.ung_vien.map((u) => [u.label, u.so_ncc])).toEqual([
      ['Thép hộp 20×40 · dày 1.0', 2],
      ['Thép hộp 20×40 · dày 0.8', 1],
    ])
    const chon = traMon('thép hộp 20x40', cm, { key: r.ung_vien[0].key })
    expect(chon.trang_thai).toBe('ok')
    expect(chon.re_nhat).toBe(19500)
  })

  it('món thường: lớp xi là biến thể cùng quy cách; "6x20" thiếu chiều dài ren thì mơ hồ', () => {
    const r = traMon('bulon 6x20x13', cm)
    expect(r.trang_thai).toBe('ok')
    expect(r.ncc.map((x) => [x.supplier_name, x.bien])).toEqual([
      ['Tường Nguyên', null],
      ['Ngũ kim Thành Nghĩa', 'xi đen'],
    ])
    expect(traMon('bulon 6x20', cm).trang_thai).toBe('mo_ho')
  })

  it('gõ đúng tên một quy cách thì nhận luôn dù chữ còn khớp tên dài hơn', () => {
    const cm2 = lapChiMuc([
      D({ ...BUL, name: 'Tán dù 6x30x15', unit2: null, qty2: null, price_basis: 'unit', unit_price: 1760 }), // prettier-ignore
      D({ ...BUL, name: 'Tán dù 6x30x15 đầu bằng', unit2: null, qty2: null, price_basis: 'unit', unit_price: 1900 }), // prettier-ignore
    ])
    expect(traMon('Tán dù 6x30x15', cm2).trang_thai).toBe('one')
  })

  it('nhôm phi 32 chưa mua: gợi ý NCC từng bán nhôm ống tròn, giá đ/kg tham khảo, rẻ trước', () => {
    const r = traMon('nhôm phi 32 dày 1.2', cm)
    expect(r.trang_thai).toBe('moi')
    expect(r.goi_y_theo).toBe('Nhôm ống tròn')
    expect(r.goi_y.map((g) => [g.supplier_name, g.gia])).toEqual([
      ['Nhôm Thép Quang Minh', 108000],
      ['SX TM Ngô Sơn', 113000],
      ['Nhôm Đoàn Gia', 113000],
    ])
    expect(r.goi_y[0].mau).toContain('ống phi 22 · dày 1.0')
  })

  it('món theo cái chưa mua: gợi ý NCC cùng nhóm con, KHÔNG bày giá (cỡ khác không nói gì về giá)', () => {
    const r = traMon('bulon 8x40', cm, {
      nhomCon: { group: BUL.group_name, sub: 'Bu lông' },
    })
    expect(r.trang_thai).toBe('moi')
    expect(r.goi_y_theo).toBe('Bu lông')
    expect(r.goi_y.every((g) => g.gia === null)).toBe(true)
    expect(r.goi_y).toHaveLength(3)
  })

  it('inox chưa từng mua, không nhóm để gợi ý → trống', () => {
    const r = traMon('inox hộp 20x20 dày 1.0', cm)
    expect(r.trang_thai).toBe('trong')
    expect(r.goi_y).toEqual([])
  })

  it('chữ rỗng → trống, không khớp bừa cả tập', () => {
    expect(traMon('   ', cm).trang_thai).toBe('trong')
  })
})
