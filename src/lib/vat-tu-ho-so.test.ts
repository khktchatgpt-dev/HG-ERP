import { describe, expect, it } from 'vitest'
import { gomGoiY, nccRows, reNhatId, tomTat, type VtLine } from './vat-tu-ho-so'

const L = (p: Partial<VtLine>): VtLine => ({
  line_id: Math.random().toString(36),
  po_id: 'po1',
  po_code: 'PO-1',
  status: 'received',
  at: '2026-09-18',
  supplier_id: 's1',
  supplier_name: 'Đoàn Gia',
  lsx_code: null,
  qty: 10,
  qty2: null,
  unit2: 'kg',
  unit_price: 113000,
  currency: 'VND',
  price_basis: 'unit2',
  note: null,
  qty_received: 10,
  qty_open: 0,
  ...p,
})

describe('nccRows — mỗi NCC một dòng, mới nhất trước', () => {
  const lines = [
    L({ po_id: 'a', at: '2026-09-18', qty: 85 }),
    L({ po_id: 'a', at: '2026-09-18', qty: 47 }),
    L({ po_id: 'b', at: '2026-09-18', qty: 90 }),
    L({ po_id: 'c', at: '2026-10-03', supplier_id: 's2', supplier_name: 'Quang Minh', unit_price: 108000, status: 'ordered', qty: 202, qty_open: 202 }), // prettier-ignore
  ]
  it('gom theo NCC, đếm đơn (không đếm dòng), cộng SL và đang về', () => {
    const r = nccRows(lines, null)
    expect(r.map((x) => x.name)).toEqual(['Quang Minh', 'Đoàn Gia'])
    expect(r[1]).toMatchObject({ nDon: 2, qty: 222, open: 0 })
    expect(r[0]).toMatchObject({ nDon: 1, qty: 202, open: 202 })
  })
  it('đơn nháp không vào giá / SL nhưng NCC vẫn có mặt', () => {
    const r = nccRows(
      [L({ status: 'draft', supplier_id: 's9', supplier_name: 'Nháp' })],
      null,
    )
    expect(r[0]).toMatchObject({ name: 'Nháp', nDon: 0, qty: 0, priceLine: null })
  })
  it('NCC mặc định chưa bán mã này → thêm một dòng cuối, last null', () => {
    const r = nccRows(lines, { id: 's7', name: 'Tiến Đạt' })
    expect(r.at(-1)).toMatchObject({ id: 's7', last: null, nDon: 0 })
    // Mặc định ĐÃ bán thì không thêm dòng trùng.
    expect(nccRows(lines, { id: 's1', name: 'Đoàn Gia' })).toHaveLength(2)
  })
})

describe('reNhatId — chỉ gắn "rẻ nhất" khi so được', () => {
  const two = nccRows(
    [L({}), L({ supplier_id: 's2', supplier_name: 'Quang Minh', unit_price: 108000 })],
    null,
  )
  it('cùng tiền, cùng đơn vị tính giá → NCC giá thấp hơn', () => {
    expect(reNhatId(two, 'Cây')).toBe('s2')
  })
  it('khác đơn vị tính giá (₫/kg với ₫/Cây) → không gắn', () => {
    const r = nccRows(
      [L({}), L({ supplier_id: 's2', price_basis: 'unit', unit_price: 50000 })],
      null,
    )
    expect(reNhatId(r, 'Cây')).toBeNull()
  })
  it('một NCC thì không có gì để so', () => {
    expect(reNhatId(nccRows([L({})], null), 'Cây')).toBeNull()
  })
})

describe('tomTat — số đầu trang chỉ đếm đơn đã gửi NCC', () => {
  it('giá gần nhất là dòng đã gửi mới nhất; nháp bỏ qua', () => {
    const t = tomTat([
      L({ at: '2026-09-18' }),
      L({ at: '2026-10-05', status: 'draft', unit_price: 1 }),
      L({ at: '2026-10-03', po_id: 'c', unit_price: 108000, qty_open: 202, qty: 202, status: 'ordered' }), // prettier-ignore
    ])
    expect(t.ganNhat?.unit_price).toBe(108000)
    expect(t).toMatchObject({ daDat: 212, dangVe: 202, nDon: 2, donDangVe: 1 })
  })
})

describe('gomGoiY — NCC từng bán mã cùng nhóm con', () => {
  const rows = [
    { supplier_id: 'v', supplier_name: 'Vĩnh Khang', code: 'KIM0160', name: 'Kính A', at: '2026-09-01' }, // prettier-ignore
    { supplier_id: 'm', supplier_name: 'Mai Trang', code: 'KIM0160', name: 'Kính A', at: '2026-09-01' }, // prettier-ignore
    { supplier_id: 'm', supplier_name: 'Mai Trang', code: 'KIM0161', name: 'Kính B', at: '2026-09-20' }, // prettier-ignore
    { supplier_id: 'm', supplier_name: 'Mai Trang', code: 'KIM0161', name: 'Kính B', at: '2026-09-10' }, // prettier-ignore
  ]
  it('đếm MÃ khác nhau, nhiều mã trước, ngày cuối là ngày mới nhất', () => {
    const g = gomGoiY(rows, new Set())
    expect(g.map((x) => [x.supplier_name, x.n_codes, x.last_at])).toEqual([
      ['Mai Trang', 2, '2026-09-20'],
      ['Vĩnh Khang', 1, '2026-09-01'],
    ])
  })
  it('bỏ NCC đã bán chính mã đang xem — họ nằm ở bảng trên rồi', () => {
    expect(gomGoiY(rows, new Set(['m'])).map((x) => x.supplier_id)).toEqual(['v'])
  })
})
