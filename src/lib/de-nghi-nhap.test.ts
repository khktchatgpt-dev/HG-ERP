import { describe, expect, it } from 'vitest'
import {
  conPhaiNhap,
  kiemNhapDeNghi,
  mucVuot,
  soDuyet,
  tienNhap,
  trangThaiTheoSo,
  vetVuot,
  type DongNhapDeNghi,
} from './de-nghi-nhap'

/** Kho nhập hàng đã mua theo đề nghị (0238 · Đ3/Đ4) — luật chung màn + service. */
const dong = (p: Partial<DongNhapDeNghi> = {}): DongNhapDeNghi => ({
  line_id: 'l1',
  name: 'Găng tay len 50gr',
  material_id: 'm1',
  can: 80,
  daNhap: 0,
  qty: 80,
  unit_price: 5000,
  note: '',
  ...p,
})

describe('số duyệt · còn phải nhập · vượt', () => {
  it('số duyệt = approved_qty, null thì đúng số đề nghị; còn phải nhập không âm', () => {
    expect(soDuyet({ qty: 80, approved_qty: null })).toBe(80)
    expect(soDuyet({ qty: 80, approved_qty: 50 })).toBe(50)
    expect(soDuyet({ qty: 80, approved_qty: 0 })).toBe(0)
    expect(conPhaiNhap(80, 30)).toBe(50)
    expect(conPhaiNhap(80, 90)).toBe(0)
  })

  it('mức vượt tính trên tổng đã nhập + lần này', () => {
    expect(mucVuot(100, 0, 100)).toBe(0)
    expect(mucVuot(100, 60, 50)).toBeCloseTo(0.1)
    expect(mucVuot(100, 0, 120)).toBeCloseTo(0.2)
    expect(mucVuot(0, 0, 5)).toBe(Infinity) // lãnh đạo duyệt 0 mà vẫn nhập
    expect(vetVuot(100, 0, 100)).toBeNull()
    expect(vetVuot(100, 0, 115)).toBe('[Vượt 15% số duyệt]')
    expect(vetVuot(0, 0, 2)).toBe('[Duyệt 0 vẫn nhập]')
  })
})

describe('trangThaiTheoSo — trạng thái phiếu suy từ sổ kho', () => {
  it('chưa nhập gì → Đã duyệt; nhập một phần → Đang nhập; đủ mọi dòng → Xong', () => {
    expect(trangThaiTheoSo([{ can: 80, daNhap: 0 }, { can: 20, daNhap: 0 }], false)).toBe('approved') // prettier-ignore
    expect(trangThaiTheoSo([{ can: 80, daNhap: 80 }, { can: 20, daNhap: 0 }], false)).toBe('ordering') // prettier-ignore
    expect(trangThaiTheoSo([{ can: 80, daNhap: 85 }, { can: 20, daNhap: 20 }], false)).toBe('done') // prettier-ignore
  })

  it('dòng duyệt 0 không tính vào "đủ"; đã chốt thì giữ Xong dù đảo bớt phiếu nhập', () => {
    expect(trangThaiTheoSo([{ can: 80, daNhap: 80 }, { can: 0, daNhap: 0 }], false)).toBe('done') // prettier-ignore
    expect(trangThaiTheoSo([{ can: 80, daNhap: 0 }], true)).toBe('done')
  })

  it('đảo hết phiếu nhập (đã nhập về 0) → lùi về Đã duyệt', () => {
    expect(trangThaiTheoSo([{ can: 80, daNhap: 0 }], false)).toBe('approved')
  })
})

describe('kiemNhapDeNghi — câu chặn trước khi ghi phiếu nhập', () => {
  const head = { noi_mua: 'Tiệm Tân Hưng, chợ Xuân An' }

  it('đủ điều kiện thì ghi được; vượt ≤ 10% chỉ cảnh báo', () => {
    expect(kiemNhapDeNghi(head, [dong()])).toEqual({ ok: true, canhBao: [] })
    const k = kiemNhapDeNghi(head, [dong({ qty: 88 })])
    expect(k.ok).toBe(true)
    expect(k.canhBao[0].cau).toContain('vượt số duyệt 10%')
  })

  it('thiếu nơi mua → nhảy về ô nơi mua', () => {
    const k = kiemNhapDeNghi({ noi_mua: '  ' }, [dong()])
    expect(k).toMatchObject({ ok: false, focus: 'noi_mua' })
  })

  it('không dòng nào có số → chặn', () => {
    const k = kiemNhapDeNghi(head, [dong({ qty: 0 })])
    expect(k).toMatchObject({ ok: false, o: 'qty', message: 'Chưa dòng nào có số nhận lần này' }) // prettier-ignore
  })

  it('dòng có số mà chưa gắn mã → nói bấm "gắn mã"; dòng để chuyến sau (0) thì không cần mã', () => {
    const k = kiemNhapDeNghi(head, [dong(), dong({ line_id: 'l2', name: 'Giẻ lau', material_id: null })]) // prettier-ignore
    expect(k).toMatchObject({ ok: false, focus: 1, o: 'ma' })
    if (!k.ok) expect(k.message).toContain('Dòng 2 (Giẻ lau) chưa gắn mã')
    expect(kiemNhapDeNghi(head, [dong(), dong({ line_id: 'l2', material_id: null, qty: 0 })]).ok).toBe(true) // prettier-ignore
  })

  it('đơn giá bắt buộc; giá 0 phải ghi chú vì sao (Q11)', () => {
    expect(kiemNhapDeNghi(head, [dong({ unit_price: null })])).toMatchObject({ ok: false, o: 'gia' }) // prettier-ignore
    expect(kiemNhapDeNghi(head, [dong({ unit_price: 0 })])).toMatchObject({ ok: false, o: 'note' }) // prettier-ignore
    expect(kiemNhapDeNghi(head, [dong({ unit_price: 0, note: 'NCC tặng' })]).ok).toBe(true) // prettier-ignore
  })

  it('vượt > 10% bắt lý do ở Ghi chú (Q12); có lý do thì ghi được', () => {
    const k = kiemNhapDeNghi(head, [dong({ qty: 100 })])
    expect(k).toMatchObject({ ok: false, o: 'note' })
    if (!k.ok) expect(k.message).toContain('vượt số duyệt 25%')
    expect(kiemNhapDeNghi(head, [dong({ qty: 100, note: 'tiệm bán theo bịch 50' })]).ok).toBe(true) // prettier-ignore
  })

  it('lãnh đạo duyệt 0 mà vẫn nhập → bắt lý do', () => {
    const k = kiemNhapDeNghi(head, [dong({ can: 0, qty: 5 })])
    expect(k).toMatchObject({ ok: false, o: 'note' })
    if (!k.ok) expect(k.message).toContain('duyệt 0')
  })
})

it('tienNhap — chỉ cộng dòng có số và có giá', () => {
  expect(tienNhap([dong(), dong({ qty: 0 }), dong({ unit_price: null })])).toBe(400_000)
})
