import { describe, expect, it } from 'vitest'
import {
  choXem,
  congTheoTien,
  daGui,
  daXemChoGd,
  giaTruocCungNcc,
  gomDon,
  soGia,
  tichDuoc,
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
    owner_id: null,
    owner_name: null,
    lsx: null,
    ngoai_lenh: null,
    ...p,
  }) as XemDon

describe('chia hộp — tab Chờ tôi xem / Đã xem, chờ GĐ', () => {
  it('chưa có dấu → chờ xem; có dấu → đã xem (badge đếm đúng choXem)', () => {
    const items = [
      don({ id: 'a' }),
      don({ id: 'b', mark: { by: 'u', by_name: null, at: '', note: null } }),
    ]
    expect(choXem(items).map((d) => d.id)).toEqual(['a'])
    expect(daXemChoGd(items).map((d) => d.id)).toEqual(['b'])
  })

  it('Q2 — chỉ đơn dưới ngưỡng giá trị lớn mới tích hàng loạt', () => {
    expect(tichDuoc({ big: false })).toBe(true)
    expect(tichDuoc({ big: true })).toBe(false)
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
    don({ id: 'a', owner_id: 'nga', owner_name: 'Nga', lsx: 'L1' }),
    don({ id: 'b', owner_id: 'huy', owner_name: 'Huy', lsx: 'L1' }),
    don({
      id: 'c',
      owner_id: 'nga',
      owner_name: 'Nga',
      ngoai_lenh: 'Ngoài lệnh · Khuôn',
    }),
  ]
  it('theo người lập: khối nhiều đơn lên trước', () => {
    expect(gomDon(items, 'nguoi').map((g) => [g.ten, g.rows.length])).toEqual([
      ['Nga', 2],
      ['Huy', 1],
    ])
  })
  it('theo lệnh: đơn ngoài lệnh thành khối riêng', () => {
    expect(gomDon(items, 'lenh').map((g) => g.ten)).toEqual(['L1', 'Ngoài lệnh · Khuôn'])
  })
  it('không gom: một khối', () => {
    expect(gomDon(items, 'khong')).toHaveLength(1)
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
