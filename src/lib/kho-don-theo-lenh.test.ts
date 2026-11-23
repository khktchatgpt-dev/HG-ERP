import { describe, expect, it } from 'vitest'
import {
  buildDonTheoLenh,
  nganCua,
  phieuCuaLenh,
  tinhDon,
  tongTheoLenh,
  xepDon,
  type KdDon,
  type KdDong,
  type KdDongVao,
  type KdLenh,
  type KdPhieu,
} from './kho-don-theo-lenh'

const L06: KdLenh = {
  id: 'l06',
  code: '06/26-27 - MX',
  ship_date: '2026-11-29',
  khach: 'MERXX',
}
const L08: KdLenh = {
  id: 'l08',
  code: '08/26-27 - MX',
  ship_date: '2026-11-29',
  khach: 'MERXX',
}
const L02: KdLenh = {
  id: 'l02',
  code: '02/26-27 - ROSCO',
  ship_date: '2027-03-17',
  khach: 'ROSCO',
}
const TODAY = '2026-11-23'

const don = (p: Partial<KdDon> & { id: string }): KdDon => ({
  code: p.id.toUpperCase(),
  status: 'confirmed',
  expected_at: null,
  production_order_id: 'l06',
  supplier: 'NCC',
  extra_lsx_ids: [],
  ...p,
})
const dong = (p: Partial<KdDongVao> & { id: string; po_id: string }): KdDongVao => ({
  ma: 'VT-1',
  ten: 'Vật tư',
  dvt: 'Cái',
  qty: 10,
  received: 0,
  closed: false,
  ...p,
})
const d = (p: Partial<KdDong>): KdDong => ({
  id: 'ln',
  ma: 'X',
  ten: 'X',
  dvt: 'Cái',
  dat: 10,
  ve: 0,
  thieu: 10,
  closed: false,
  chia: false,
  ...p,
})

function build(
  dons: KdDon[],
  dongs: KdDongVao[],
  extra?: Partial<Parameters<typeof buildDonTheoLenh>[0]>,
) {
  const active = [L06, L08, L02]
  return buildDonTheoLenh({
    active,
    lenhById: new Map(active.map((l) => [l.id, l])),
    dons,
    dongs,
    phans: [],
    phieuByPo: new Map(),
    today: TODAY,
    ...extra,
  })
}

describe('tinhDon', () => {
  it('nháp / chờ duyệt là chưa đặt, dù dòng chưa nhận gì', () => {
    expect(tinhDon('draft', [d({})])).toBe('chua_dat')
    expect(tinhDon('pending_approval', [d({})])).toBe('chua_dat')
  })
  it('đã duyệt chưa nhận gì là chưa về; nhận một phần là một phần', () => {
    expect(tinhDon('approved', [d({})])).toBe('chua_ve')
    expect(tinhDon('confirmed', [d({ ve: 4, thieu: 6 })])).toBe('mot_phan')
  })
  it('chốt thiếu không còn gì để chờ → về đủ (Q5)', () => {
    expect(tinhDon('partial', [d({ ve: 757, dat: 760, thieu: 0, closed: true })])).toBe(
      'du',
    )
  })
  it('đơn đã nhận xong / đóng là về đủ', () => {
    expect(tinhDon('received', [d({ ve: 9, thieu: 1 })])).toBe('du')
  })
  it('đơn huỷ là sai lệch', () => {
    expect(tinhDon('cancelled', [d({})])).toBe('huy')
  })
})

describe('buildDonTheoLenh', () => {
  it('một dòng = một (lệnh, đơn); trễ chỉ tính đơn NCC đã xác nhận còn chờ hàng', () => {
    const rows = build(
      [
        don({ id: 'po211', status: 'partial', expected_at: '2026-11-05' }),
        don({ id: 'po268', status: 'draft', expected_at: '2026-11-20' }),
        don({ id: 'po300', status: 'approved', expected_at: '2026-11-01' }),
      ],
      [
        dong({ id: 'a', po_id: 'po211', qty: 760, received: 757 }),
        dong({ id: 'b', po_id: 'po268' }),
        dong({ id: 'c', po_id: 'po300' }),
      ],
    )
    const by = new Map(rows.map((r) => [r.po_id, r]))
    expect(by.get('po211')).toMatchObject({
      tinh: 'mot_phan',
      tre: 18,
      dong_du: 0,
      dong_tong: 1,
    })
    expect(by.get('po268')).toMatchObject({ tinh: 'chua_dat', tre: null })
    // Đã duyệt nhưng NCC chưa xác nhận: hẹn là dự tính, không báo trễ.
    expect(by.get('po300')).toMatchObject({ tinh: 'chua_ve', tre: null })
  })

  it('đơn gộp hiện ở cả lệnh chính lẫn lệnh đi kèm, mang nhãn lệnh chính (Q4)', () => {
    const rows = build(
      [
        don({
          id: 'po185',
          production_order_id: 'l08',
          extra_lsx_ids: ['l06'],
          status: 'partial',
        }),
      ],
      [
        dong({ id: 'a', po_id: 'po185', received: 10 }),
        dong({ id: 'b', po_id: 'po185', received: 3 }),
      ],
    )
    expect(rows.map((r) => r.lsx_id).sort()).toEqual(['l06', 'l08'])
    const o06 = rows.find((r) => r.lsx_id === 'l06')!
    expect(o06).toMatchObject({
      lenh_chinh: '08/26-27 - MX',
      gop: ['08/26-27 - MX'],
      dong_du: 1,
    })
    expect(rows.find((r) => r.lsx_id === 'l08')!.lenh_chinh).toBeNull()
  })

  it('dòng chia nhiều lệnh: hàng về giao cho lệnh xuất trước', () => {
    const rows = build(
      [don({ id: 'po1', production_order_id: 'l02', status: 'partial' })],
      [dong({ id: 'x', po_id: 'po1', qty: 100, received: 70 })],
      {
        phans: [
          { line_id: 'x', production_order_id: 'l06', qty: 60 },
          { line_id: 'x', production_order_id: 'l02', qty: 40 },
        ],
      },
    )
    const o06 = rows.find((r) => r.lsx_id === 'l06')!
    const o02 = rows.find((r) => r.lsx_id === 'l02')!
    // 06 xuất 29/11 trước ROSCO 17/03 → nhận đủ 60, ROSCO còn 10 / 40.
    expect(o06.dong[0]).toMatchObject({ dat: 60, ve: 60, thieu: 0, chia: true })
    expect(o06.tinh).toBe('du')
    expect(o02.dong[0]).toMatchObject({ dat: 40, ve: 10, thieu: 30 })
    expect(o02.tinh).toBe('mot_phan')
  })

  it('đơn huỷ chỉ lên màn khi có phiếu nhập (Q6)', () => {
    const phieu: KdPhieu = { doc_id: 'd1', code: 'PNK-2026-0037', date: '2026-09-11' }
    const dons = [
      don({ id: 'po47', status: 'cancelled' }),
      don({ id: 'po48', status: 'cancelled' }),
    ]
    const dongs = [dong({ id: 'a', po_id: 'po47' }), dong({ id: 'b', po_id: 'po48' })]
    const rows = build(dons, dongs, { phieuByPo: new Map([['po47', [phieu]]]) })
    expect(rows.map((r) => [r.po_id, r.tinh])).toEqual([['po47', 'huy']])
  })

  it('lệnh ngoài tập đang xem không có dòng', () => {
    const rows = build(
      [don({ id: 'po9', production_order_id: 'lxx' })],
      [dong({ id: 'a', po_id: 'po9' })],
    )
    expect(rows).toEqual([])
  })
})

describe('tongTheoLenh', () => {
  it('đếm trên chính các dòng; đơn huỷ không vào số đơn; rổ đúng nghĩa', () => {
    const phieu = (code: string, date: string): KdPhieu => ({ doc_id: code, code, date })
    const rows = build(
      [
        don({ id: 'a', status: 'received' }),
        don({ id: 'b', status: 'partial', expected_at: '2026-11-05' }),
        don({ id: 'c', status: 'draft' }),
        don({ id: 'h', status: 'cancelled' }),
        don({ id: 'r', status: 'received', production_order_id: 'l02' }),
      ],
      [
        dong({ id: '1', po_id: 'a', received: 10 }),
        dong({ id: '2', po_id: 'b', received: 2 }),
        dong({ id: '3', po_id: 'c' }),
        dong({ id: '4', po_id: 'h' }),
        dong({ id: '5', po_id: 'r', received: 10 }),
      ],
      {
        phieuByPo: new Map([
          ['a', [phieu('PNK-1', '2026-10-02')]],
          ['b', [phieu('PNK-2', '2026-11-14')]],
          ['h', [phieu('PNK-9', '2026-12-01')]],
        ]),
      },
    )
    const t = tongTheoLenh([L02, L06, L08], rows)
    // Xếp theo ngày xuất: 06 và 08 (29/11) trước ROSCO.
    expect(t.map((l) => l.id)).toEqual(['l06', 'l08', 'l02'])
    const t06 = t[0]
    expect(t06).toMatchObject({
      don: 3,
      du: 1,
      mot_phan: 1,
      chua_ve: 0,
      chua_dat: 1,
      tre: 1,
      sai: 1,
    })
    // Phiếu của đơn huỷ không phải "phiếu gần nhất".
    expect(t06.phieu_cuoi?.code).toBe('PNK-2')
    expect(t06.ro).toEqual({ cho: true, tre: true, du: false, all: true })
    expect(t[1]).toMatchObject({
      don: 0,
      ro: { cho: false, tre: false, du: false, all: true },
    })
    expect(t[2].ro.du).toBe(true)
  })
})

describe('xepDon + nganCua', () => {
  it('trễ lâu trước, hẹn sớm trước, huỷ ở cuối', () => {
    const rows = build(
      [
        don({ id: 'h', status: 'cancelled' }),
        don({ id: 'x', status: 'confirmed', expected_at: '2026-11-20' }),
        don({ id: 'y', status: 'confirmed', expected_at: '2026-11-05' }),
        don({ id: 'z', status: 'confirmed', expected_at: '2026-12-05' }),
      ],
      ['h', 'x', 'y', 'z'].map((p) => dong({ id: p, po_id: p })),
      { phieuByPo: new Map([['h', [{ doc_id: 'd', code: 'P', date: '2026-01-01' }]]]) },
    )
    expect(rows.sort(xepDon).map((r) => r.po_id)).toEqual(['y', 'x', 'z', 'h'])
    expect(nganCua('huy')).toBe('du')
    expect(nganCua('chua_ve')).toBe('cho')
  })
})

describe('phieuCuaLenh', () => {
  it('gom phiếu của mọi đơn, một phiếu nhiều đơn = một dòng, mới nhất trước', () => {
    const p1: KdPhieu = { doc_id: 'd1', code: 'PNK-1', date: '2026-11-04' }
    const p2: KdPhieu = { doc_id: 'd2', code: 'PNK-2', date: '2026-11-14' }
    const rows = build(
      [don({ id: 'a' }), don({ id: 'b' })],
      [dong({ id: 'la', po_id: 'a' }), dong({ id: 'lb', po_id: 'b' })],
      { phieuByPo: new Map([['a', [p1, p2]], ['b', [p2]]]) },
    )
    expect(phieuCuaLenh(rows)).toEqual([
      { ...p2, dons: ['A', 'B'] },
      { ...p1, dons: ['A'] },
    ])
  })
})
