import { describe, expect, it } from 'vitest'
import {
  boDau,
  gomTheoDot,
  khopTim,
  laHangMua,
  pctText,
  tenCum,
  tienDo,
  type RowLike,
} from './ho-so-lenh'

const row = (over: Partial<RowLike>): RowLike => ({
  tier: 'part',
  name: 'Chân',
  cluster: null,
  parent_id: null,
  route: ['phoi'],
  total_needed: 100,
  cells: {},
  ...over,
})

describe('laHangMua · tenCum', () => {
  it('chi tiết không qua công đoạn nào là hàng mua; cụm thì không bao giờ', () => {
    expect(laHangMua(row({ name: 'Bu lông M6 x 35', route: [] }))).toBe(true)
    expect(laHangMua(row({ route: ['phoi'] }))).toBe(false)
    expect(laHangMua(row({ tier: 'cluster', route: [] }))).toBe(false)
  })
  it('bỏ đuôi "(mặc nhiên)"', () => {
    expect(tenCum('Cụm khung (mặc nhiên)')).toBe('Cụm khung')
    expect(tenCum('Mặt bàn')).toBe('Mặt bàn')
  })
})

describe('tienDo · pctText', () => {
  it('Σ min(đạt, cần) ÷ Σ cần — làm dư một dòng không bù dòng thiếu', () => {
    const rows = [
      row({ total_needed: 100, cells: { phoi: { done: 150 } } }),
      row({ total_needed: 100, cells: { phoi: { done: 20 } } }),
      row({ total_needed: 50, cells: {} }),
    ]
    expect(tienDo(rows, 'phoi')).toEqual({ done: 120, need: 200 })
    expect(tienDo(rows, 'han')).toBeNull()
  })
  it('99% khi gần đủ, 100% chỉ khi đủ', () => {
    expect(pctText(2945, 2946)).toBe('99%')
    expect(pctText(62, 62)).toBe('100%')
    expect(pctText(0, 0)).toBe('—')
  })
})

describe('gomTheoDot', () => {
  const groups = [
    { id: 'g1', title: 'Đợt 1', ship_date: '2026-12-24' },
    { id: 'g2', title: 'Đợt 2', ship_date: '2027-01-21' },
    { id: 'g3', title: 'Đợt 3', ship_date: null },
  ]
  it('giữ thứ tự đợt, cộng SL và đồng bộ; đợt rỗng bỏ; đợt lạ vào "Khác"', () => {
    const out = gomTheoDot(groups, [
      { group_id: 'g2', qty: 62, synced_sets: 10 },
      { group_id: 'g1', qty: 27, synced_sets: 0 },
      { group_id: 'g1', qty: 62, synced_sets: 5 },
      { group_id: 'xx', qty: 3, synced_sets: 0 },
    ])
    expect(out.map((d) => [d.title, d.lines.length, d.qty, d.synced])).toEqual([
      ['Đợt 1', 2, 89, 5],
      ['Đợt 2', 1, 62, 10],
      ['Khác', 1, 3, 0],
    ])
  })
})

describe('khopTim', () => {
  const line = {
    product_code: 'CH0289HG-AL',
    product_name: 'Ghế bank I khung nhôm (20x80)',
    rows: [
      row({ name: 'Giằng chân', cluster: 'Cụm khung' }),
      row({ name: 'Bu lông M6 x 35', route: [] }),
    ],
  }
  it('khớp mã / tên hàng → không mở sẵn; khớp chi tiết → mở sẵn', () => {
    expect(khopTim(line, 'ch0289')).toEqual({ khop: true, trongDong: false })
    expect(khopTim(line, 'giang chan')).toEqual({ khop: true, trongDong: true })
  })
  it('không tìm trong hàng mua; ô trống là khớp hết', () => {
    expect(khopTim(line, 'bu long').khop).toBe(false)
    expect(khopTim(line, '  ').khop).toBe(true)
  })
  it('bỏ dấu cả chữ đ', () => {
    expect(boDau('Đợt Giằng')).toBe('dot giang')
  })
})

describe('tenNgan', () => {
  it('bỏ ngoặc và phần sau "&"', async () => {
    const { tenNgan } = await import('./ho-so-lenh')
    expect(tenNgan('May (nệm/bọc)')).toBe('May')
    expect(tenNgan('Bao bì & tem nhãn')).toBe('Bao bì')
    expect(tenNgan('Đan (mây/nhựa)')).toBe('Đan')
    expect(tenNgan('Lắp ráp')).toBe('Lắp ráp')
  })
})
