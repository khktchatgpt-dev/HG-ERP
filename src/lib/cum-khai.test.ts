import { describe, expect, it } from 'vitest'
import { cumChuaKhai, khoaSpCum } from './cum-khai'

describe('cumChuaKhai (16/11/2026)', () => {
  const hoSo = [
    { product_id: 'gx', name: 'Cụm chân', qty_per_product: null },
    { product_id: 'gx', name: 'Cụm mê ngồi', qty_per_product: '1' },
    { product_id: 'sofa', name: 'Sofa', qty_per_product: null },
  ]
  const chua = cumChuaKhai(hoSo)

  it('hồ sơ có cụm mà để trống SL → chưa khai', () => {
    expect(chua.has(khoaSpCum('gx', 'Cụm chân'))).toBe(true)
    expect(chua.has(khoaSpCum('sofa', 'Sofa'))).toBe(true)
  })

  it('hồ sơ đã ghi SL → đã khai', () => {
    expect(chua.has(khoaSpCum('gx', 'Cụm mê ngồi'))).toBe(false)
  })

  it('cụm chỉ có trên lệnh (hồ sơ không có cụm cùng tên) → lấy số trên lệnh, không coi chưa khai', () => {
    expect(chua.has(khoaSpCum('sofa', 'Chân giữa'))).toBe(false)
    expect(chua.has(khoaSpCum('sofa', 'Đố trước'))).toBe(false)
  })

  it('so tên cụm không phân biệt hoa thường', () => {
    expect(chua.has(khoaSpCum('gx', 'cụm chân'))).toBe(true)
  })
})
