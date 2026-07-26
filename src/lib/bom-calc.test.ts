import { describe, expect, it } from 'vitest'
import {
  calcPartDerived,
  crossSectionM2,
  deviation,
  isCalculable,
  perimeterM,
} from './bom-calc'

/**
 * Số kỳ vọng lấy TỪ FILE BOM THẬT, không phải tự nghĩ ra — đây là các dòng đã
 * đối chiếu khớp tuyệt đối khi dựng công thức:
 *   B0012HG-AL (nhôm) — "Chân", "Tay", "Ngang mê trước", "Pát hàn", "Nan ngồi"
 *   ST000026HG-IR (sắt) — "Chân" tròn, "Khung trên bàn" vuông
 */
const near = (got: number | null, want: number, tol = 1e-3) => {
  expect(got).not.toBeNull()
  expect(Math.abs(got! - want)).toBeLessThanOrEqual(tol * Math.max(Math.abs(want), 1e-9))
}

describe('calcPartDerived — đối chiếu file BOM thật', () => {
  it('hộp nhôm 18×70 dày 1.4, dài 650, SL 4 → 1.6747 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'HOP',
      material_kind: 'AL',
      dim_a_mm: 18,
      dim_b_mm: 70,
      wall_thickness_mm: 1.4,
      cut_length_mm: 650,
      qty: 4,
    })
    near(r.weight_kg, 1.6747)
    near(r.paint_area_m2, 0.4576)
    near(r.total_length_m, 2.6)
  })

  it('hộp nhôm 20×30 dày 1.8, dài 508, SL 1 → 0.2291 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'HOP',
      material_kind: 'AL',
      dim_a_mm: 20,
      dim_b_mm: 30,
      wall_thickness_mm: 1.8,
      cut_length_mm: 508,
      qty: 1,
    })
    near(r.weight_kg, 0.2291)
    near(r.paint_area_m2, 0.0508)
  })

  it('la nhôm 5×20 (đặc), dài 50, SL 2 → 0.027 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'LA',
      material_kind: 'AL',
      dim_a_mm: 5,
      dim_b_mm: 20,
      cut_length_mm: 50,
      qty: 2,
    })
    near(r.weight_kg, 0.027)
    near(r.paint_area_m2, 0.005)
  })

  it('tấm nhôm dày 1.2 rộng 131, dài 468, SL 3 → 0.5959 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'TAM',
      material_kind: 'AL',
      dim_a_mm: 1.2,
      dim_b_mm: 131,
      cut_length_mm: 468,
      qty: 3,
    })
    near(r.weight_kg, 0.5959)
    near(r.paint_area_m2, 0.37121)
  })

  it('ống sắt tròn Ø27 dày 0.8, dài 150, SL 4 → 0.310 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'TRON',
      material_kind: 'IR',
      dim_a_mm: 27,
      dim_b_mm: 27,
      wall_thickness_mm: 0.8,
      cut_length_mm: 150,
      qty: 4,
    })
    near(r.weight_kg, 0.31013)
  })

  it('ống sắt vuông 20 dày 0.8, dài 630, SL 4 → 1.215 kg', () => {
    const r = calcPartDerived({
      profile_shape: 'VUONG',
      material_kind: 'IR',
      dim_a_mm: 20,
      dim_b_mm: 20,
      wall_thickness_mm: 0.8,
      cut_length_mm: 630,
      qty: 4,
    })
    near(r.weight_kg, 1.2153)
    near(r.paint_area_m2, 0.2016)
  })
})

describe('crossSectionM2', () => {
  it('không khai độ dày thành thì coi là thanh đặc', () => {
    // Tròn Ø20 đặc: π/4 × 400 = 314.16 mm²
    near(crossSectionM2('TRON', 20, 20, null), 314.159e-6)
    near(crossSectionM2('TRONDAC', 20, 20, 999), 314.159e-6)
  })

  it('thành dày hơn nửa tiết diện thì coi là đặc, không ra số âm', () => {
    const a = crossSectionM2('VUONG', 10, 10, 8)
    near(a, 100e-6)
    expect(a!).toBeGreaterThan(0)
  })

  it('ovan và mã khuôn ép KHÔNG tính — thà trống còn hơn sai', () => {
    expect(crossSectionM2('OVAN', 12, 18, 0.8)).toBeNull()
    expect(crossSectionM2('PF', 20, 40, 1)).toBeNull()
    expect(isCalculable('OVAN')).toBe(false)
    expect(isCalculable('HOP')).toBe(true)
  })

  it('thiếu kích thước thì trả null', () => {
    expect(crossSectionM2('HOP', 20, null, 1)).toBeNull()
    expect(crossSectionM2('TRON', null, null, 1)).toBeNull()
  })
})

describe('perimeterM', () => {
  it('tròn dùng πd, vuông dùng 4a, hộp dùng 2(a+b)', () => {
    near(perimeterM('TRON', 27, 27), (Math.PI * 27) / 1000)
    near(perimeterM('VUONG', 20, 20), 0.08)
    near(perimeterM('HOP', 18, 70), 0.176)
  })
})

describe('calcPartDerived — thiếu dữ liệu', () => {
  it('không có vật liệu thì không ra khối lượng, nhưng vẫn ra chiều dài', () => {
    const r = calcPartDerived({
      profile_shape: 'HOP',
      dim_a_mm: 20,
      dim_b_mm: 40,
      wall_thickness_mm: 1,
      cut_length_mm: 500,
      qty: 2,
    })
    expect(r.weight_kg).toBeNull()
    near(r.total_length_m, 1)
    near(r.paint_area_m2, 0.12)
  })

  it('vật liệu lạ (gỗ, nhựa) thì không suy ra khối lượng', () => {
    const r = calcPartDerived({
      profile_shape: 'LA',
      material_kind: 'WD',
      dim_a_mm: 20,
      dim_b_mm: 40,
      cut_length_mm: 500,
      qty: 1,
    })
    expect(r.weight_kg).toBeNull()
  })

  it('thiếu số lượng hoặc chiều dài thì mọi đại lượng đều null', () => {
    const r = calcPartDerived({
      profile_shape: 'HOP',
      material_kind: 'AL',
      dim_a_mm: 20,
      dim_b_mm: 40,
      wall_thickness_mm: 1,
      qty: 2,
    })
    expect(r.total_length_m).toBeNull()
    expect(r.weight_kg).toBeNull()
    expect(r.paint_area_m2).toBeNull()
  })
})

describe('deviation', () => {
  it('đo lệch tương đối giữa số nhập tay và số theo hình học', () => {
    expect(deviation(1.1, 1)).toBeCloseTo(0.1, 6)
    expect(deviation(0.9, 1)).toBeCloseTo(0.1, 6)
    expect(deviation(1, 1)).toBe(0)
  })

  it('thiếu một vế thì không so được', () => {
    expect(deviation(null, 1)).toBeNull()
    expect(deviation(1, null)).toBeNull()
  })
})
