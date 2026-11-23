import { describe, expect, it } from 'vitest'
import {
  buildNpl,
  chiaHangVe,
  coLoc,
  demNpl,
  locNpl,
  ngayQua,
  nhomTheoLenh,
  nplTab,
  NPL_LOC_TRONG,
  phamViNpl,
  tenGoi,
  type NplDon,
  type NplDong,
  type NplLenh,
} from './npl-theo-lenh'

const TODAY = '2026-11-20'
const L06: NplLenh = { id: 'l06', code: '06/26-27 - MX', ship_date: '2026-11-29' }
const L07: NplLenh = { id: 'l07', code: '07/26-27 - MX', ship_date: '2026-11-29' }
const GIGA: NplLenh = { id: 'lgiga', code: '01/26-27 - GIGA', ship_date: '2026-12-24' }
const XONG: NplLenh = { id: 'lxong', code: '01/26-27 - YOTRIO', ship_date: '2026-10-10' }
const KHONG_NGAY: NplLenh = { id: 'lkn', code: '11/26-27 - MX', ship_date: null }
const ALL = [L06, L07, GIGA, XONG, KHONG_NGAY]
const byId = new Map(ALL.map((l) => [l.id, l]))

const don = (o: Partial<NplDon> & { id: string }): NplDon => ({
  code: `PO-${o.id}`,
  status: 'confirmed',
  expected_at: null,
  production_order_id: L06.id,
  supplier: 'NCC A',
  assignee: 'Nguyễn Đình Huy',
  assignee_id: 'u-huy',
  extra_lsx_ids: [],
  ...o,
})
const dong = (o: Partial<NplDong> & { id: string; po_id: string }): NplDong => ({
  material_id: `m-${o.id}`,
  ma: `MA-${o.id}`,
  ten: `Tên ${o.id}`,
  dvt: 'Cái',
  nhom: 'Bu lông - tán',
  qty: 100,
  received: 0,
  closed: false,
  ...o,
})
const build = (
  dons: NplDon[],
  dongs: NplDong[],
  phans = [] as Parameters<typeof buildNpl>[0]['phans'],
  active = [L06, L07, GIGA, KHONG_NGAY],
) => buildNpl({ active, lenhById: byId, dons, dongs, phans, today: TODAY })

describe('nplTab — rổ theo tình trạng đơn', () => {
  it('nháp / chờ duyệt = chưa đặt; đã duyệt / đã gửi = chờ NCC', () => {
    expect(nplTab('draft', 10)).toBe('chua_dat')
    expect(nplTab('pending_approval', 10)).toBe('chua_dat')
    expect(nplTab('approved', 10)).toBe('cho_ncc')
    expect(nplTab('ordered', 10)).toBe('cho_ncc')
  })
  it('chờ giao / đang chuyển / về một phần: còn thiếu thì đang về, hết thiếu thì về đủ', () => {
    expect(nplTab('confirmed', 5)).toBe('thieu')
    expect(nplTab('in_transit', 5)).toBe('thieu')
    expect(nplTab('partial', 5)).toBe('thieu')
    expect(nplTab('partial', 0)).toBe('du')
    expect(nplTab('received', 3)).toBe('du')
  })
})

describe('chiaHangVe — lệnh xuất trước nhận trước (Q3)', () => {
  it('KI-0010: 760 tấm chia 06 MX 600 + 07 MX 160, về 757 → 06 đủ, 07 thiếu 3', () => {
    const r = chiaHangVe(
      760,
      757,
      [
        { lsx: L07, qty: 160 },
        { lsx: L06, qty: 600 },
      ],
      L06,
    )
    expect(r.map((p) => [p.lsx.code, p.qty, p.nhan])).toEqual([
      ['06/26-27 - MX', 600, 600],
      ['07/26-27 - MX', 160, 157],
    ])
  })
  it('ngày xuất sớm hơn nhận trước, lệnh chưa có ngày xuất nhận sau cùng', () => {
    const r = chiaHangVe(
      300,
      150,
      [
        { lsx: KHONG_NGAY, qty: 100 },
        { lsx: GIGA, qty: 100 },
        { lsx: L06, qty: 100 },
      ],
      null,
    )
    expect(r.map((p) => [p.lsx.id, p.nhan])).toEqual([
      ['l06', 100],
      ['lgiga', 50],
      ['lkn', 0],
    ])
  })
  it('phần chia cộng chưa đủ dòng → phần dư thuộc lệnh chính', () => {
    const r = chiaHangVe(500, 0, [{ lsx: GIGA, qty: 200 }], L06)
    expect(r.map((p) => [p.lsx.id, p.qty])).toEqual([
      ['l06', 300],
      ['lgiga', 200],
    ])
  })
})

describe('buildNpl', () => {
  it('cùng mã nhiều dòng trong một đơn cộng thành một dòng (BAO0483 150 + 240 = 390)', () => {
    const rows = build(
      [don({ id: 'p1', status: 'received' })],
      [
        dong({ id: 'a', po_id: 'p1', material_id: 'bao', qty: 150, received: 150 }),
        dong({ id: 'b', po_id: 'p1', material_id: 'bao', qty: 240, received: 240 }),
      ],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ dat: 390, ve: 390, thieu: 0, tab: 'du' })
  })

  it('đơn gộp mà dòng chưa chia: tính vào lệnh chính, mang mã lệnh đi kèm (Q4)', () => {
    const rows = build(
      [don({ id: 'p1', extra_lsx_ids: [L07.id] })],
      [dong({ id: 'a', po_id: 'p1' })],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ lsx_id: 'l06', gop: ['07/26-27 - MX'] })
  })

  it('dòng chia: mỗi lệnh đang xem một dòng, số về theo lệnh xuất trước', () => {
    const rows = build(
      [don({ id: 'p1', status: 'partial', expected_at: '2026-11-05' })],
      [dong({ id: 'ki', po_id: 'p1', qty: 760, received: 757 })],
      [
        { line_id: 'ki', production_order_id: L06.id, qty: 600 },
        { line_id: 'ki', production_order_id: L07.id, qty: 160 },
      ],
    )
    const r06 = rows.find((r) => r.lsx_id === 'l06')!
    const r07 = rows.find((r) => r.lsx_id === 'l07')!
    expect(r06).toMatchObject({ dat: 600, ve: 600, thieu: 0, tab: 'du', tre: null })
    expect(r07).toMatchObject({ dat: 160, ve: 157, thieu: 3, tab: 'thieu', tre: 15 })
    expect(r07.chia?.parts.map((p) => p.thieu)).toEqual([0, 3])
  })

  it('phần chia sang lệnh KHÔNG đang xem vẫn ăn hàng về theo thứ tự, nhưng không thành dòng', () => {
    const rows = build(
      [don({ id: 'p1', production_order_id: GIGA.id })],
      [dong({ id: 'x', po_id: 'p1', qty: 200, received: 100 })],
      [
        { line_id: 'x', production_order_id: XONG.id, qty: 100 },
        { line_id: 'x', production_order_id: GIGA.id, qty: 100 },
      ],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ lsx_id: 'lgiga', dat: 100, ve: 0, thieu: 100 })
  })

  it('bỏ đơn huỷ, đơn ngoài lệnh không chia, đơn của lệnh không đang xem', () => {
    const rows = build(
      [
        don({ id: 'huy', status: 'cancelled' }),
        don({ id: 'ngoai', production_order_id: null }),
        don({ id: 'xong', production_order_id: XONG.id }),
      ],
      [
        dong({ id: 'a', po_id: 'huy' }),
        dong({ id: 'b', po_id: 'ngoai' }),
        dong({ id: 'c', po_id: 'xong' }),
      ],
    )
    expect(rows).toEqual([])
  })

  it('dòng đóng thiếu: còn thiếu = 0, về đủ', () => {
    const rows = build(
      [don({ id: 'p1', status: 'partial' })],
      [dong({ id: 'a', po_id: 'p1', qty: 100, received: 60, closed: true })],
    )
    expect(rows[0]).toMatchObject({ thieu: 0, tab: 'du' })
  })

  it('trễ chỉ tính trên dòng ĐANG VỀ còn thiếu (bản vẽ 2 · Q2): nháp, chờ NCC, về đủ thì không', () => {
    const rows = build(
      [
        don({ id: 'nhap', status: 'draft', expected_at: '2026-09-27' }),
        don({ id: 'cho', status: 'ordered', expected_at: '2026-10-01' }),
        don({ id: 've', status: 'confirmed', expected_at: '2026-11-20' }),
        don({ id: 'tre', status: 'partial', expected_at: '2026-11-05' }),
        don({ id: 'du', status: 'received', expected_at: '2026-09-16' }),
      ],
      [
        dong({ id: 'a', po_id: 'nhap' }),
        dong({ id: 'b', po_id: 'cho' }),
        dong({ id: 'c', po_id: 've' }),
        dong({ id: 'd', po_id: 'tre', received: 40 }),
        dong({ id: 'e', po_id: 'du', received: 100 }),
      ],
    )
    const t = Object.fromEntries(rows.map((r) => [r.po_id, r.tre]))
    expect(t).toEqual({ nhap: null, cho: null, ve: null, tre: 15, du: null })
  })
})

describe('lọc, đếm, gom', () => {
  const rows = build(
    [
      don({
        id: 'p1',
        status: 'draft',
        supplier: 'TÂN PHÁT',
        assignee: 'Nguyễn Anh Thi',
        assignee_id: 'u-thi',
      }),
      don({
        id: 'p2',
        status: 'confirmed',
        expected_at: '2026-11-05',
        production_order_id: GIGA.id,
      }),
      don({
        id: 'p3',
        status: 'confirmed',
        expected_at: '2026-12-01',
        production_order_id: GIGA.id,
      }),
      don({ id: 'p4', status: 'approved', production_order_id: KHONG_NGAY.id }),
    ],
    [
      dong({ id: 'a', po_id: 'p1', ma: 'BUL0608', ten: 'LĐS 8x20x1, 7 màu' }),
      dong({ id: 'b', po_id: 'p2', ma: 'NK-0217', ten: 'long đền 6x16x1 xi đen' }),
      dong({ id: 'c', po_id: 'p3', ma: 'MUT0201', ten: 'Mút D20' }),
      dong({ id: 'd', po_id: 'p4', ma: 'BB-0095', ten: 'Tem giặt' }),
    ],
  )

  it('đếm mỗi tab + số dòng đang về đã trễ', () => {
    expect(demNpl(rows)).toEqual({
      chua_dat: 1,
      cho_ncc: 1,
      thieu: 2,
      du: 0,
      tat_ca: 4,
      tre: 1,
    })
  })

  it('tìm không dấu theo mã, tên, mã đơn', () => {
    expect(locNpl(rows, { ...NPL_LOC_TRONG, q: 'long den' }).map((r) => r.ma)).toEqual([
      'NK-0217',
    ])
    expect(locNpl(rows, { ...NPL_LOC_TRONG, q: 'PO-p3' }).map((r) => r.ma)).toEqual([
      'MUT0201',
    ])
  })

  it('lọc lệnh, NCC, người, chỉ quá hẹn', () => {
    expect(locNpl(rows, { ...NPL_LOC_TRONG, lsx: GIGA.id })).toHaveLength(2)
    expect(locNpl(rows, { ...NPL_LOC_TRONG, ncc: 'TÂN PHÁT' }).map((r) => r.ma)).toEqual([
      'BUL0608',
    ])
    expect(locNpl(rows, { ...NPL_LOC_TRONG, nguoi: 'Nguyễn Anh Thi' })).toHaveLength(1)
    expect(locNpl(rows, { ...NPL_LOC_TRONG, quaHen: true }).map((r) => r.ma)).toEqual([
      'NK-0217',
    ])
    expect(coLoc(NPL_LOC_TRONG)).toBe(false)
    expect(coLoc({ ...NPL_LOC_TRONG, quaHen: true })).toBe(true)
  })

  it('phạm vi "của tôi" = đơn tôi phụ trách; cả phòng = mọi dòng; không biết tôi là ai = rỗng', () => {
    expect(phamViNpl(rows, 'toi', 'u-thi').map((r) => r.ma)).toEqual(['BUL0608'])
    expect(phamViNpl(rows, 'toi', 'u-huy')).toHaveLength(3)
    expect(phamViNpl(rows, 'phong', 'u-thi')).toHaveLength(4)
    expect(phamViNpl(rows, 'toi', null)).toEqual([])
  })

  it('gom theo lệnh: xuất sớm trước, chưa có ngày xuất cuối; trong nhóm hẹn sớm trước', () => {
    const g = nhomTheoLenh(rows, byId)
    expect(g.map((x) => x.lenh.code)).toEqual([
      '06/26-27 - MX',
      '01/26-27 - GIGA',
      '11/26-27 - MX',
    ])
    expect(g[1].rows.map((r) => r.ma)).toEqual(['NK-0217', 'MUT0201'])
    expect(g[1].tre).toBe(1)
  })
})

describe('tiện ích', () => {
  it('ngayQua', () => {
    expect(ngayQua('2026-11-05', TODAY)).toBe(15)
    expect(ngayQua('2026-11-25', TODAY)).toBe(-5)
  })
  it('tenGoi lấy từ cuối', () => {
    expect(tenGoi('Đặng Thị Thanh Nga')).toBe('Nga')
    expect(tenGoi(null)).toBe('')
  })
})
