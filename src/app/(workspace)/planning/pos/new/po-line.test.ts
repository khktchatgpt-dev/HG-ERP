import { describe, expect, it } from 'vitest'
import { poLineAmount } from '@/lib/po-line'
import { deriveLine, type PoTemplate } from '@/lib/po-template'
import { draftOf, lineAmount, lineFromPo, lineProblem, lineReady } from './po-line'
import type { PoLineDto } from './po-line'

/**
 * MỞ ĐƠN ĐỂ SỬA KHÔNG ĐƯỢC LÀM ĐỔI SỐ TIỀN.
 *
 * Đây là hồi quy cho một bug thật: form sửa cũ trong PosManager không biết mẫu đơn
 * nên khi lưu lại đã bỏ hết thông số quy đổi (kg/m, dài cây, kg/đv, m²). Mất chúng
 * thì `deriveLine` rơi về price_basis 'unit' và thành tiền dòng nhôm tụt từ
 * (tổng kg × giá/kg) xuống (số cây × giá/kg) — sai ~6 lần, không cảnh báo gì.
 */

const base: PoLineDto = {
  material_id: 'm1',
  material_code: 'VT-001',
  material_name: 'Thanh nhôm',
  material_unit: 'cây',
  qty_ordered: 273,
  unit_price: 102_000,
  spec: null,
  note: 'Dọc ngồi',
  material_grade: null,
  product_code: null,
  dm_per_sp: null,
  qty_demand: null,
  qty_on_hand: null,
  waste_pct: null,
  die_code: null,
  weight_per_m: null,
  bar_length_m: null,
  bar_surplus: null,
  dimension_text: null,
  finish: null,
  weight_per_unit: null,
  open_style: null,
  pcs_per_ctn: null,
  inner_l_mm: null,
  inner_w_mm: null,
  inner_h_mm: null,
  area_m2: null,
  carton_basis: null,
}

/** Tiền của dòng ĐÃ LƯU, tính đúng cách server tính. */
function storedAmount(t: PoTemplate, dto: PoLineDto): number {
  const d = deriveLine(t, {
    qty_ordered: dto.qty_ordered,
    weight_per_m: dto.weight_per_m,
    bar_length_m: dto.bar_length_m,
    weight_per_unit: dto.weight_per_unit,
    area_m2: dto.area_m2,
    carton_basis: dto.carton_basis,
  })
  return poLineAmount({
    qty_ordered: dto.qty_ordered,
    unit_price: dto.unit_price,
    price_basis: d.price_basis,
    qty2: d.qty2,
  })
}

describe('mở đơn để sửa — thành tiền phải y nguyên', () => {
  const cases: [string, PoTemplate, PoLineDto][] = [
    [
      'nhôm (kg/m × dài cây × số cây)',
      'aluminium',
      { ...base, weight_per_m: 0.248, bar_length_m: 5.65, bar_surplus: 3 },
    ],
    [
      'inox theo kg/cây',
      'metal_kg',
      { ...base, qty_ordered: 20, unit_price: 73_200, weight_per_unit: 9.325 },
    ],
    [
      'bao bì tính theo m²',
      'carton',
      {
        ...base,
        qty_ordered: 300,
        unit_price: 5_000,
        area_m2: 1.6564,
        carton_basis: 'm2',
      },
    ],
    [
      'bao bì tính theo thùng',
      'carton',
      { ...base, qty_ordered: 300, unit_price: 8_282, carton_basis: 'ctn' },
    ],
    ['phụ kiện', 'accessory', { ...base, qty_ordered: 206, unit_price: 2_000 }],
  ]

  for (const [ten, template, dto] of cases) {
    it(ten, () => {
      const before = storedAmount(template, dto)
      const after = lineAmount(template, lineFromPo(dto))
      expect(after).toBeCloseTo(before, 6)
      expect(before).toBeGreaterThan(0)
    })
  }

  it('nhôm: giữ nguyên kg/m và dài cây chứ không rơi về SL × giá', () => {
    const dto = { ...base, weight_per_m: 0.248, bar_length_m: 5.65 }
    const d = draftOf(lineFromPo(dto))
    expect(d.weight_per_m).toBe(0.248)
    expect(d.bar_length_m).toBe(5.65)
    expect(deriveLine('aluminium', d).price_basis).toBe('unit2')
    // Bug cũ: mất thông số → 273 × 102.000 = 27.846.000 thay vì 39.017.815.
    expect(lineAmount('aluminium', lineFromPo(dto))).not.toBeCloseTo(27_846_000, 0)
  })

  it('dòng nạp lại từ đơn đã lưu là hợp lệ, không bắt nhập lại gì', () => {
    for (const [, template, dto] of cases) {
      const l = lineFromPo(dto)
      expect(lineProblem(template, l)).toBeNull()
      expect(lineReady(template, l)).toBe(true)
    }
  })

  it('ô trống về "" chứ không về 0 — phân biệt chưa nhập với nhập số 0', () => {
    const l = lineFromPo(base)
    expect(l.weight_per_m).toBe('')
    expect(l.qty_demand).toBe('')
    expect(l.material_grade).toBe('')
    expect(l.carton_basis).toBe('ctn') // mặc định, không phải null
  })

  it('đơn giá 0 vẫn giữ là 0, không biến thành ô trống', () => {
    // NCC cho hàng khuyến mãi / hàng bù — giá 0 là số thật, không phải chưa nhập.
    const l = lineFromPo({ ...base, unit_price: 0 })
    expect(l.price).toBe(0)
  })
})
