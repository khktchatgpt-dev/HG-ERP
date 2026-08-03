import { describe, expect, it } from 'vitest'
import { poLineAmount } from './po-line'
import {
  cartonAreaM2,
  deriveLine,
  poTemplateMeta,
  suggestOrderQty,
  type PoTemplate,
} from './po-template'

/**
 * Số trong các test dưới đây lấy TỪ ĐƠN THẬT (thư mục E:\PO) chứ không bịa — mỗi
 * case ghi rõ nguồn để sau này ai sửa công thức còn đối chiếu được với giấy đang
 * ký. Trục kiểm: deriveLine → poLineAmount phải ra đúng cột "Thành tiền" của file.
 */

/** Tiền dòng đi qua đúng đường thật: mẫu → derive → poLineAmount. */
function amount(t: PoTemplate, l: Parameters<typeof deriveLine>[1], price: number) {
  const d = deriveLine(t, l)
  return poLineAmount({
    qty_ordered: l.qty_ordered,
    unit_price: price,
    price_basis: d.price_basis,
    qty2: d.qty2,
  })
}

describe('mẫu nhôm — tiền theo (kg/m × dài cây × số cây) × giá/kg', () => {
  it('khớp đơn Việt ECO, LSX 01/26-27 dòng 1 (Ghế 5 bậc Athos, TD-B768)', () => {
    // File: kg/m 0.248 · dài 5.65 m · 273 cây → 382.5276 kg · 102.000 đ/kg
    const line = { qty_ordered: 273, weight_per_m: 0.248, bar_length_m: 5.65 }
    const d = deriveLine('aluminium', line)
    expect(d.qty2).toBeCloseTo(382.5276, 4)
    expect(d.unit2).toBe('kg')
    expect(d.price_basis).toBe('unit2')
    expect(amount('aluminium', line, 102_000)).toBeCloseTo(39_017_815.2, 1)
  })

  it('chưa khai kg/m thì KHÔNG ra tiền 0 âm thầm — rơi về SL × giá', () => {
    const line = { qty_ordered: 10, weight_per_m: null, bar_length_m: 6 }
    expect(deriveLine('aluminium', line)).toEqual({
      qty2: null,
      unit2: null,
      price_basis: 'unit',
    })
    expect(amount('aluminium', line, 1000)).toBe(10_000)
  })

  it('thiếu chiều dài cây cũng vậy', () => {
    expect(
      deriveLine('aluminium', { qty_ordered: 5, weight_per_m: 0.3 }).price_basis,
    ).toBe('unit')
  })
})

describe('mẫu inox/sắt — tiền theo (SL × kg/đơn vị) × giá/kg', () => {
  it('khớp đơn Kim Vĩnh Phú, LSX 02 dòng 1 (Hộp 50x50x1.0li-HV)', () => {
    // File: 9.325 kg/cây · 20 cây → 186.5 kg · 73.200 đ/kg → 13.651.800
    const line = { qty_ordered: 20, weight_per_unit: 9.325 }
    expect(deriveLine('metal_kg', line).qty2).toBeCloseTo(186.5, 4)
    expect(amount('metal_kg', line, 73_200)).toBeCloseTo(13_651_800, 0)
  })

  it('khớp đơn Thông Đạt — inox TẤM (kg/tấm, không phải kg/m)', () => {
    // File: 1 tấm × 72 kg × 60.909,0909 đ/kg → 4.385.454,5
    const line = { qty_ordered: 1, weight_per_unit: 72 }
    expect(amount('metal_kg', line, 60_909.090909)).toBeCloseTo(4_385_454.5, 0)
  })
})

describe('mẫu phụ kiện — tiền theo SL đặt × đơn giá', () => {
  it('khớp đơn TTL, LSX 04 dòng 1 (Nút nhựa vuông 76)', () => {
    // File: SL đặt 206 · 2.000 đ → 412.000
    expect(amount('accessory', { qty_ordered: 206 }, 2000)).toBe(412_000)
  })

  it('không dùng qty2 dù dòng có lỡ mang thông số quy đổi', () => {
    const d = deriveLine('accessory', { qty_ordered: 100, weight_per_unit: 5 })
    expect(d).toEqual({ qty2: null, unit2: null, price_basis: 'unit' })
  })
})

describe('mẫu bao bì — chọn giá theo thùng hoặc theo m² từng dòng', () => {
  it('m²/thùng theo công thức AD (nắp âm dương) của file bao bì', () => {
    // File BB dòng 1: lọt lòng 660×660×120 → 1,6564 m²
    expect(cartonAreaM2('AD', 660, 660, 120)).toBeCloseTo(1.6564, 4)
    // File BB dòng 6: 1510×910×120 → 4,0834 m²
    expect(cartonAreaM2('AD', 1510, 910, 120)).toBeCloseTo(4.0834, 4)
  })

  it('m²/thùng theo công thức MR (một mảnh)', () => {
    // File BB dòng 2: 655×250×35 → 0,4495 m²
    expect(cartonAreaM2('MR', 655, 250, 35)).toBeCloseTo(0.4495, 4)
  })

  it('cách mở lạ / thiếu kích thước → null để nhân viên nhập m² tay', () => {
    expect(cartonAreaM2('XX', 660, 660, 120)).toBeNull()
    expect(cartonAreaM2('AD', 660, 660, 0)).toBeNull()
    expect(cartonAreaM2('AD', null, null, null)).toBeNull()
  })

  it('basis m² → tiền = tổng m² × giá/m²', () => {
    const line = { qty_ordered: 300, area_m2: 1.6564, carton_basis: 'm2' as const }
    expect(deriveLine('carton', line).qty2).toBeCloseTo(496.92, 2)
    expect(deriveLine('carton', line).unit2).toBe('m²')
    expect(amount('carton', line, 5000)).toBeCloseTo(2_484_600, 0)
  })

  it('basis thùng → tiền = số thùng × giá/thùng, kể cả khi đã biết m²', () => {
    const line = { qty_ordered: 300, area_m2: 1.6564, carton_basis: 'ctn' as const }
    expect(deriveLine('carton', line).price_basis).toBe('unit')
    expect(amount('carton', line, 8282)).toBe(2_484_600)
  })
})

/*
 * HAO HỤT ĐÃ BỎ (yêu cầu phòng Cung ứng).
 *
 * Trước đây gợi ý nhân thêm 3% mặc định cho mẫu phụ kiện. Con số đó áp cứng cho
 * mọi mặt hàng trong khi hao hụt thật khác nhau theo loại, nên người mua vẫn gõ
 * đè — cộng ngầm chỉ làm số gợi ý lệch khỏi thứ họ tự tính.
 *
 * Gợi ý nay là phép trừ trần trụi: nhu cầu − tồn.
 */
describe('SL cần đặt gợi ý — chỉ trừ tồn, KHÔNG cộng hao hụt', () => {
  it('nhu cầu trừ tồn, không nhân thêm gì', () => {
    expect(suggestOrderQty(200, 0)).toBe(200)
    expect(suggestOrderQty(400, 0)).toBe(400)
    expect(suggestOrderQty(1200, 0)).toBe(1200)
  })

  it('tồn đủ → 0, không đặt', () => {
    // File TTL dòng 3: cần 100, tồn 100 → 0
    expect(suggestOrderQty(100, 100)).toBe(0)
    expect(suggestOrderQty(100, 500)).toBe(0)
  })

  it('tồn một phần thì chỉ đặt phần thiếu', () => {
    // File HAPPYCO: cần 2800, tồn 800 → thiếu 2000 (đơn chốt 2500 do NCC bán lô)
    expect(suggestOrderQty(2800, 800)).toBe(2000)
  })

  it('phần thiếu lẻ thì làm tròn LÊN — đặt thiếu còn tệ hơn đặt dư', () => {
    expect(suggestOrderQty(350.5, 0)).toBe(351)
  })

  it('ô trống coi như 0', () => {
    expect(suggestOrderQty(100, null)).toBe(100)
    expect(suggestOrderQty(null, 50)).toBe(0)
  })
})

describe('metadata mẫu', () => {
  it('VAT và cách ghi VAT khác nhau theo mẫu — đúng như đơn thật', () => {
    expect(poTemplateMeta('accessory').vatRate).toBe(8)
    expect(poTemplateMeta('aluminium').vatRate).toBe(10)
    expect(poTemplateMeta('aluminium').priceIncludesVat).toBe(false) // "chưa gồm VAT"
    expect(poTemplateMeta('metal_kg').priceIncludesVat).toBe(true) // "đã gồm VAT"
  })

  it('chỉ mẫu phụ kiện có dòng Chiết khấu', () => {
    expect(poTemplateMeta('accessory').hasDiscount).toBe(true)
    expect(poTemplateMeta('aluminium').hasDiscount).toBe(false)
  })

  it('khối chữ ký khác nhau', () => {
    expect(poTemplateMeta('accessory').signerRole).toBe('TRƯỞNG PHÒNG CUNG ỨNG')
    expect(poTemplateMeta('aluminium').signerRole).toBe('TRƯỞNG PHÒNG KẾ HOẠCH')
  })

  it('mẫu lạ / null → rơi về simple thay vì nổ', () => {
    expect(poTemplateMeta(null).key).toBe('simple')
    expect(poTemplateMeta('xx' as PoTemplate).key).toBe('simple')
  })
})
