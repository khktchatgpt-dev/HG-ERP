import { describe, expect, it } from 'vitest'
import { dauChiem, khungCua, phanTheo, tongHop, type DongBan } from './phan-tich-doanh-so'

const D = (p: Partial<DongBan>): DongBan => ({
  order_id: 'O1',
  order_code: 'DH-1',
  customer: 'ROSCO',
  thang_nhan: '2026-08',
  product_id: 'P1',
  product_code: 'TB0287HG-IR',
  product_name: 'Bàn',
  product_type: 'TB',
  qty: 10,
  value: 1000,
  lai: null,
  ...p,
})

describe('khungCua — vật liệu khung từ đuôi mã SP', () => {
  it('đọc đuôi HG-XX; mã không theo quy tắc thì null', () => {
    expect(khungCua('TB0287HG-IR')).toBe('IR')
    expect(khungCua('CH0254HG-AL ')).toBe('AL')
    expect(khungCua('S0049')).toBeNull()
    expect(khungCua(null)).toBeNull()
  })
})

describe('phanTheo — gom một chiều, % trên tổng đang lọc', () => {
  const ds = [
    D({ order_id: 'O1', value: 600, qty: 6 }),
    D({ order_id: 'O2', value: 200, qty: 2 }),
    D({ order_id: 'O3', customer: 'LAURA', value: 200, lai: 20, product_type: 'CH', product_code: 'CH0001HG-AL' }), // prettier-ignore
  ]
  it('theo khách: đếm ĐƠN (không đếm dòng), xếp trị giá giảm dần', () => {
    const r = phanTheo(ds, 'khach')
    expect(r.map((x) => [x.label, x.so_don, x.value, x.share])).toEqual([
      ['ROSCO', 2, 800, 0.8],
      ['LAURA', 1, 200, 0.2],
    ])
  })
  it('lãi chỉ cộng dòng có giá thành; mẫu số % lãi là trị giá của CHÍNH các dòng đó', () => {
    const laura = phanTheo(ds, 'khach')[1]
    expect(laura).toMatchObject({ lai: 20, value_co_gt: 200 })
    const rosco = phanTheo(ds, 'khach')[0]
    expect(rosco).toMatchObject({ lai: 0, value_co_gt: 0 })
  })
  it('theo loại / khung dùng nhãn tiếng Việt; thiếu thì nói thiếu', () => {
    expect(phanTheo(ds, 'loai').map((x) => x.label)).toEqual(['Bàn', 'Ghế'])
    expect(phanTheo([D({ product_type: null })], 'loai')[0].label).toBe('Chưa xếp loại')
    expect(phanTheo(ds, 'khung').map((x) => x.label)).toEqual(['Sắt', 'Nhôm'])
  })
  it('theo tháng thì xếp theo thời gian, không theo trị giá', () => {
    const r = phanTheo([D({ thang_nhan: '2026-10', value: 900 }), D({ thang_nhan: '2026-08', value: 1 })], 'thang') // prettier-ignore
    expect(r.map((x) => x.label)).toEqual(['08/2026', '10/2026'])
  })
})

describe('tongHop + dauChiem', () => {
  it('% lãi đi kèm độ phủ — không có giá thành thì lai_pct null, không phải 0', () => {
    expect(tongHop([D({})]).lai_pct).toBeNull()
    const t = tongHop([D({ value: 800 }), D({ value: 200, lai: 30 })])
    expect(t).toMatchObject({ value: 1000, lai: 30, value_co_gt: 200, phu: 0.2 })
    expect(t.lai_pct).toBeCloseTo(0.15)
  })
  it('n dòng đầu chiếm bao nhiêu', () => {
    const r = phanTheo([D({ value: 700 }), D({ customer: 'B', value: 200 }), D({ customer: 'C', value: 100 })], 'khach') // prettier-ignore
    expect(dauChiem(r, 2)).toBeCloseTo(0.9)
  })
})
