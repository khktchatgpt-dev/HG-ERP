import { describe, expect, it } from 'vitest'
import { poHaiGia, type HaiGiaLine } from './po-hai-gia'

/*
 * HAI GIÁ CỦA DÒNG ĐÃ LƯU — dùng ở màn ký của Giám đốc (10/10/2026). Số thật lấy
 * từ đơn đang chạy: PO-2026-0130 nhôm Ngô Sơn, PO-2026-0142 sắt TVP, PO-2026-0156
 * gỗ Tân Hoàng Huy (USD).
 */
const dong = (part: Partial<HaiGiaLine>): HaiGiaLine => ({
  qty_ordered: null,
  unit_price: null,
  price_basis: 'unit',
  qty2: null,
  ...part,
})

describe('poHaiGia — giá theo ĐVT và giá /kg · /m³ · /m²', () => {
  it('nhôm theo kg: giá cây = giá/kg × (tổng kg chốt ÷ SL)', () => {
    const g = poHaiGia('aluminium', dong({ qty_ordered: 227, qty2: 230.7682, unit_price: 113_000, price_basis: 'unit2' })) // prettier-ignore
    expect(g?.theo).toBe('dv2')
    expect(g?.gia2).toBe(113_000)
    expect(g?.donGia).toBeCloseTo(114_875.8, 0)
  })

  it('sắt theo cây: giá /kg quy đổi qua kg / đơn vị', () => {
    const g = poHaiGia('metal_kg', dong({ qty_ordered: 525, weight_per_unit: 2.304, unit_price: 47_300 })) // prettier-ignore
    expect(g?.theo).toBe('dvt')
    expect(g?.donGia).toBe(47_300)
    expect(g?.gia2).toBeCloseTo(47_300 / 2.304, 6)
  })

  it('gỗ theo cái: giá /m³ theo tổng m³ đã lưu', () => {
    const g = poHaiGia('wood', dong({ qty_ordered: 1450, qty2: 52.809, m3_per_unit: 0.036, unit_price: 58.71 })) // prettier-ignore
    expect(g?.gia2).toBeCloseTo(58.71 / (52.809 / 1450), 6)
  })

  it('kính / xốp theo tấm (không lưu tổng): quy đổi theo m²/tấm, D×R×Dày', () => {
    expect(poHaiGia('glass', dong({ qty_ordered: 10, area_m2: 0.5, unit_price: 100_000 }))?.gia2).toBe(200_000) // prettier-ignore
    const xop = poHaiGia('foam', dong({ qty_ordered: 240, inner_l_mm: 580, inner_w_mm: 540, inner_h_mm: 60, unit_price: 24_524 })) // prettier-ignore
    expect(xop?.gia2).toBeCloseTo(24_524 / 0.018792, 4)
  })

  it('thiếu số quy đổi → giá thứ hai null; mẫu không có hai giá → null', () => {
    expect(poHaiGia('metal_kg', dong({ qty_ordered: 5, unit_price: 50_000 }))?.gia2).toBeNull() // prettier-ignore
    expect(poHaiGia('carton', dong({ unit_price: 1 }))).toBeNull()
    expect(poHaiGia('accessory', dong({ unit_price: 1 }))).toBeNull()
  })
})
