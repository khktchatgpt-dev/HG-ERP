import { describe, expect, it } from 'vitest'
import {
  chanNgan,
  choXem,
  congTheoTien,
  daGui,
  daXemChoGd,
  giaTruocCungNcc,
  gomDon,
  henVe,
  kiemTruocTrinh,
  lamDuocNgay,
  soGia,
  tichDuoc,
  trangThaiXem,
  type XemDon,
} from './cho-xem'

const don = (p: Partial<XemDon>): XemDon =>
  ({
    id: 'x',
    code: 'PO-X',
    currency: 'VND',
    value: 0,
    big: false,
    mark: null,
    nhap: true,
    chan: null,
    tra_lai: null,
    owner_id: null,
    owner_name: null,
    lsx: null,
    ngoai_lenh: null,
    dong: [],
    ...p,
  }) as XemDon

const dau = { by: 'u', by_name: null, at: '', note: null }

describe('trạng thái dòng — bản 2 (06/11/2026)', () => {
  it('nháp: trình được / còn thiếu / bị trả lại chưa sửa; đã sửa thì về nhóm theo điều kiện', () => {
    expect(trangThaiXem(don({}))).toBe('trinh_duoc')
    expect(trangThaiXem(don({ chan: 'Chưa có hẹn giao' }))).toBe('thieu')
    const tra = { at: '', by_name: null, reason: null }
    expect(trangThaiXem(don({ tra_lai: { ...tra, da_sua: false } }))).toBe('tra_lai')
    expect(trangThaiXem(don({ tra_lai: { ...tra, da_sua: true } }))).toBe('trinh_duoc')
  })
  it('chờ duyệt: chưa có dấu = NV gửi thẳng; có dấu = đã trình', () => {
    expect(trangThaiXem(don({ nhap: false }))).toBe('gui_thang')
    expect(trangThaiXem(don({ nhap: false, mark: dau }))).toBe('da_xem')
  })
  it('Q7 — số đỏ chỉ đếm việc làm được ngay; tab 1 vẫn bày nháp thiếu / bị trả lại', () => {
    const items = [
      don({ id: 'a' }),
      don({ id: 'b', chan: 'Chưa có hẹn giao' }),
      don({ id: 'c', nhap: false }),
      don({ id: 'd', nhap: false, mark: dau }),
      don({ id: 'e', tra_lai: { at: '', by_name: null, reason: null, da_sua: false } }),
    ]
    expect(lamDuocNgay(items).map((d) => d.id)).toEqual(['a', 'c'])
    expect(choXem(items).map((d) => d.id)).toEqual(['a', 'b', 'c', 'e'])
    expect(daXemChoGd(items).map((d) => d.id)).toEqual(['d'])
  })
  it('tích hàng loạt: chỉ việc làm được, dưới ngưỡng giá trị lớn (Q2)', () => {
    expect(tichDuoc(don({}))).toBe(true)
    expect(tichDuoc(don({ big: true }))).toBe(false)
    expect(tichDuoc(don({ chan: 'Chưa có hẹn giao' }))).toBe(false)
    expect(tichDuoc(don({ nhap: false }))).toBe(true)
  })
  it('câu ngắn cho cột trạng thái', () => {
    expect(chanNgan('Chưa có hẹn giao')).toBe('Thiếu hẹn giao')
    expect(chanNgan('Đơn ngoài lệnh chưa chọn hạng mục')).toBe('Chưa chọn hạng mục')
    expect(chanNgan('NCC đang bị khoá đặt hàng — nợ. Mở khoá ở hồ sơ NCC')).toBe(
      'NCC đang khoá',
    )
  })
})

describe('giaTruocCungNcc — Q6', () => {
  const P = [
    { supplier_id: 's1', material_id: 'm1', po_id: 'p28', po_code: 'PO-2026-0228', unit_price: 650_000, at: '2026-10-30' }, // prettier-ignore
    { supplier_id: 's1', material_id: 'm1', po_id: 'p10', po_code: 'PO-2026-0010', unit_price: 600_000, at: '2026-08-01' }, // prettier-ignore
    { supplier_id: 's2', material_id: 'm1', po_id: 'p99', po_code: 'PO-2026-0099', unit_price: 500_000, at: '2026-11-01' }, // prettier-ignore
    { supplier_id: 's1', material_id: 'm1', po_id: 'cur', po_code: 'PO-2026-0243', unit_price: 999, at: '2026-11-04' }, // prettier-ignore
  ]

  it('lấy lần gần nhất CÙNG NCC, bỏ NCC khác và chính đơn đang xem', () => {
    expect(giaTruocCungNcc(P, 's1', 'm1', 'cur')).toEqual({
      gia: 650_000,
      po_code: 'PO-2026-0228',
      at: '2026-10-30',
    })
  })

  it('chưa từng mua / dòng tự do → null', () => {
    expect(giaTruocCungNcc(P, 's3', 'm1', 'cur')).toBeNull()
    expect(giaTruocCungNcc(P, 's1', null, 'cur')).toBeNull()
  })
})

describe('soGia', () => {
  const t = { gia: 1_040_000, po_code: 'X', at: '' }
  it('bằng / tăng / giảm kèm %', () => {
    expect(soGia(1_040_000, t)).toEqual({ kieu: 'bang', pct: 0 })
    expect(soGia(1_092_000, t)).toEqual({ kieu: 'tang', pct: 5 })
    expect(soGia(988_000, t)).toEqual({ kieu: 'giam', pct: 5 })
  })
  it('thiếu giá một bên → null', () => {
    expect(soGia(null, t)).toBeNull()
    expect(soGia(1, null)).toBeNull()
  })
})

describe('gomDon', () => {
  const items = [
    don({
      id: 'a',
      owner_id: 'nga',
      owner_name: 'Nga',
      lsx: 'L1',
      chan: 'Chưa có hẹn giao',
    }),
    don({ id: 'b', owner_id: 'huy', owner_name: 'Huy', lsx: 'L1' }),
    don({
      id: 'c',
      owner_id: 'nga',
      owner_name: 'Nga',
      ngoai_lenh: 'Ngoài lệnh · Khuôn',
    }),
  ]
  it('theo trạng thái (mặc định — Q9): thứ tự cố định, nhóm rỗng bỏ, nhóm thiếu không ăn số', () => {
    const g = gomDon(items, 'trang_thai')
    expect(g.map((x) => [x.key, x.rows.length, x.tinhSo])).toEqual([
      ['trinh_duoc', 2, true],
      ['thieu', 1, false],
    ])
  })
  it('nhóm bị trả lại thu gọn sẵn (Q11)', () => {
    const g = gomDon(
      [don({ tra_lai: { at: '', by_name: null, reason: null, da_sua: false } })],
      'trang_thai',
    )
    expect(g[0]).toMatchObject({ key: 'tra_lai', gon: true })
  })
  it('theo người lập: khối nhiều đơn lên trước', () => {
    expect(gomDon(items, 'nguoi').map((g) => [g.ten, g.rows.length])).toEqual([
      ['Nga', 2],
      ['Huy', 1],
    ])
  })
  it('theo lệnh: đơn ngoài lệnh thành khối riêng', () => {
    expect(gomDon(items, 'lenh').map((g) => g.ten)).toEqual(['L1', 'Ngoài lệnh · Khuôn'])
  })
})

describe('henVe', () => {
  it('hôm nay / còn n ngày / đã qua n ngày; ≤ 2 ngày là gấp', () => {
    expect(henVe('2026-11-06', '2026-11-06')).toEqual({ chu: 'hôm nay', gap: true })
    expect(henVe('2026-11-16', '2026-11-06')).toEqual({ chu: 'còn 10 ngày', gap: false })
    expect(henVe('2026-11-08', '2026-11-06')).toEqual({ chu: 'còn 2 ngày', gap: true })
    expect(henVe('2026-11-04', '2026-11-06')).toEqual({ chu: 'đã qua 2 ngày', gap: true })
    expect(henVe(null, '2026-11-06')).toBeNull()
  })
})

describe('kiemTruocTrinh — khung chi tiết', () => {
  const now = new Date('2026-11-06T01:00:00Z')
  const dong = (gia: number, truoc: number | null) => ({
    id: String(gia),
    ma: null,
    ten: 'x',
    quy_cach: null,
    sl: 1,
    dvt: null,
    qd: null,
    dvt_gia: null,
    don_gia: gia,
    thanh_tien: gia,
    truoc: truoc == null ? null : { gia: truoc, po_code: 'PO-2026-0203', at: '' },
  })
  it('PO-2026-0244: đủ giá, 5/6 giữ giá, 1 dòng mua lần đầu, giá trị lớn, đã đặt NCC 2 đơn', () => {
    const d = don({
      big: true,
      expected_at: '2026-11-06',
      thanh_toan: 'Sau khi nhận đủ',
      ncc_da_dat: 2,
      sua_at: '2026-11-05T02:35:00Z',
      dong: [
        dong(97, 97),
        dong(123, 123),
        dong(43, 43),
        dong(103, null),
        dong(220, 220),
        dong(90, 90),
      ],
    })
    const k = kiemTruocTrinh(d, now, '2026-11-06').map((x) => `${x.kieu} ${x.chu}`)
    expect(k).toEqual([
      'wn 1 dòng mua lần đầu ở NCC này',
      'wn Giá trị lớn — GĐ đọc từng dòng',
      'ok 6 dòng, đủ đơn giá',
      'ok 5/6 dòng giữ giá PO-2026-0203',
      'ok Có hẹn về, có thanh toán',
      'ok Đã đặt NCC này 2 đơn',
    ])
  })
  it('nháp thiếu: lý do chặn đứng đầu; NCC mới; nằm im lâu; tăng giá', () => {
    const d = don({
      chan: 'Chưa có hẹn giao',
      thanh_toan: 'CK',
      ncc_da_dat: 0,
      sua_at: '2026-10-12T08:15:00Z',
      dong: [dong(110, 100)],
    })
    const k = kiemTruocTrinh(d, now, '2026-11-06')
    expect(k[0]).toEqual({ kieu: 'st', chu: 'Chưa có hẹn giao' })
    expect(k.map((x) => x.chu)).toContain('1 dòng tăng giá (cao nhất +10%)')
    expect(k.map((x) => x.chu)).toContain('NCC mới — chưa đơn nào đã đặt')
    expect(k.map((x) => x.chu)).toContain('Nằm im 24 ngày (sửa lần cuối 12/10)')
  })
})

describe('daGui + congTheoTien', () => {
  const now = new Date('2026-11-05T02:12:00Z')
  it('phút / giờ / ngày', () => {
    expect(daGui('2026-11-05T01:47:00Z', now)).toBe('25 phút')
    expect(daGui('2026-11-04T08:37:00Z', now)).toBe('18 giờ')
    expect(daGui('2026-11-01T02:12:00Z', now)).toBe('4 ngày')
  })
  it('cộng riêng từng loại tiền', () => {
    expect(
      congTheoTien([
        { currency: 'VND', value: 1 },
        { currency: 'USD', value: 2 },
        { currency: 'VND', value: 3 },
      ]),
    ).toEqual([
      { currency: 'VND', value: 4 },
      { currency: 'USD', value: 2 },
    ])
  })
})
