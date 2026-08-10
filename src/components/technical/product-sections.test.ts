import { describe, it, expect } from 'vitest'
import {
  withPackingFallback,
  cartonCbm,
  dec,
  dim3,
  productDims,
} from './product-sections'

const opt = (over: Partial<Parameters<typeof withPackingFallback>[1][number]> = {}) => ({
  is_default: true,
  loading_40hc: null,
  packages: [],
  ...over,
})
const pkg = (over: Record<string, unknown> = {}) => ({
  carton_l_mm: null,
  carton_w_mm: null,
  carton_h_mm: null,
  net_weight_kg: null,
  gross_weight_kg: null,
  ...over,
})

describe('withPackingFallback — bù ô tóm tắt đóng gói trống bằng phương án mặc định', () => {
  it('không có phương án nào → giữ nguyên pk gốc', () => {
    expect(withPackingFallback({ l_cm: 10 }, [])).toEqual({ l_cm: 10 })
  })

  it('giá trị NHẬP TAY luôn thắng, không bị đè kể cả khi phương án có số khác', () => {
    const r = withPackingFallback({ loading_40hc: 500 }, [opt({ loading_40hc: 706 })])
    expect(r.loading_40hc).toBe(500)
  })

  it('Loading 40′HC lấy từ phương án mặc định bất kể số kiện', () => {
    const r = withPackingFallback({}, [
      opt({ loading_40hc: 706, packages: [pkg(), pkg()] }),
    ])
    expect(r.loading_40hc).toBe(706)
  })

  it('đúng 1 kiện → bù carton (mm → cm) + GW + NW', () => {
    const r = withPackingFallback({}, [
      opt({
        packages: [
          pkg({
            carton_l_mm: 145,
            carton_w_mm: 630,
            carton_h_mm: 1040,
            gross_weight_kg: 12.5,
            net_weight_kg: 10,
          }),
        ],
      }),
    ])
    expect(r.carton_l_cm).toBe(14.5)
    expect(r.carton_w_cm).toBe(63)
    expect(r.carton_h_cm).toBe(104)
    expect(r.gw_kg).toBe(12.5)
    expect(r.nw_kg).toBe(10)
    // CBM tính tiếp từ carton đã bù — băng "Quy cách xuất khẩu" phải khớp.
    expect(cartonCbm(r)).toBeCloseTo(0.095004, 5)
    expect(dim3(r.carton_l_cm, r.carton_w_cm, r.carton_h_cm)).toBe('14.5 × 63 × 104 cm')
  })

  it('nhiều kiện → KHÔNG bù carton/GW/NW (không gộp được về 1 số)', () => {
    const r = withPackingFallback({}, [
      opt({
        packages: [
          pkg({ carton_l_mm: 100, gross_weight_kg: 5 }),
          pkg({ carton_l_mm: 200, gross_weight_kg: 8 }),
        ],
      }),
    ])
    expect(r.carton_l_cm).toBeUndefined()
    expect(r.gw_kg).toBeUndefined()
  })

  it('nhiều phương án: ưu tiên phương án is_default, không phải phương án đầu tiên', () => {
    const r = withPackingFallback({}, [
      opt({ is_default: false, loading_40hc: 100 }),
      opt({ is_default: true, loading_40hc: 200 }),
    ])
    expect(r.loading_40hc).toBe(200)
  })

  it('không phương án nào is_default → dùng phương án đầu tiên', () => {
    const r = withPackingFallback({}, [
      opt({ is_default: false, loading_40hc: 100 }),
      opt({ is_default: false, loading_40hc: 200 }),
    ])
    expect(r.loading_40hc).toBe(100)
  })
})

describe('productDims — MỘT nguồn duy nhất là ba cột mm (0129)', () => {
  const bom = { length_mm: 755, width_mm: 1425, height_mm: 750 }
  const none = { length_mm: null, width_mm: null, height_mm: null }

  it('lấy ba cột mm, nói rõ đơn vị', () => {
    expect(productDims(bom)).toEqual({ text: '755 × 1425 × 750', unit: 'mm' })
  })

  it('thiếu bất kỳ chiều nào → null, KHÔNG in nửa vời', () => {
    expect(productDims(none)).toBeNull()
    expect(productDims({ ...bom, height_mm: null })).toBeNull()
  })
})

describe('dec — số thập phân cố định cho đại lượng tính toán', () => {
  it('giữ đủ chữ số kể cả khi tròn', () => {
    expect(dec(22.0625, 2)).toBe('22.06')
    expect(dec(92, 1)).toBe('92.0')
  })

  it('phân biệt 0 với chưa có số', () => {
    expect(dec(0, 2)).toBe('0.00')
    expect(dec(null, 2)).toBeNull()
    expect(dec(undefined, 2)).toBeNull()
  })
})
