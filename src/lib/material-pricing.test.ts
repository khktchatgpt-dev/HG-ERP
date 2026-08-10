import { describe, expect, it } from 'vitest'
import { weightPricing } from './material-pricing'

/*
 * Ca thật của phòng: đặt theo CÂY/TẤM/CUỘN nhưng NCC chào giá theo KG.
 *
 * Trước 10/08/2026 form khai vật tư chỉ hỏi barem khi đọc được tiết diện TỪ
 * TÊN, nên "Cuộn inox 304/2B" không bị hỏi gì — và danh mục có 961 mã tấm/cuộn
 * mà chỉ 4 mã khai được kg/đơn-vị.
 */
describe('weightPricing — nhận ra ca "đặt theo món, trả tiền theo cân"', () => {
  it('tên KHÔNG đọc được tiết diện vẫn nhắc, vì ĐVT đã nói rõ', () => {
    const r = weightPricing({
      name: 'Cuộn inox 304/2B',
      group_name: 'Sắt thép - inox - nhôm - tôn',
      unit: 'Cuộn',
      price_unit: '',
    })
    expect(r.countableUnit).toBe(true)
    expect(r.likely).toBe(true)
  })

  it('khai giá theo kg mà thiếu hệ số → cảnh báo (đơn sau sẽ bị chặn)', () => {
    const r = weightPricing({
      name: 'Inox 22122-011',
      unit: 'Tấm',
      price_unit: 'kg',
      unit2_factor: '',
    })
    expect(r.pricedByWeight).toBe(true)
    expect(r.missingFactor).toBe(true)
    // Đã khai giá theo kg thì không nhắc nữa — câu nhắc chỉ dành cho lúc trống.
    expect(r.likely).toBe(false)
  })

  it('có hệ số rồi thì thôi cảnh báo', () => {
    const r = weightPricing({ unit: 'Tấm', price_unit: 'kg', unit2_factor: '23.94' })
    expect(r.missingFactor).toBe(false)
  })

  it('ĐVT chính là kg → không phải ca quy đổi', () => {
    // "Nhôm la 5x50" bán theo kg: SL đặt đã là kg, không nhân gì nữa.
    const r = weightPricing({ name: 'Nhôm la 5x50', unit: 'Kg', price_unit: 'kg' })
    expect(r.pricedByWeight).toBe(false)
    expect(r.missingFactor).toBe(false)
  })

  it('hàng không phải kim loại thì không nhắc bừa', () => {
    // Thùng carton cũng là ĐVT đếm được, nhưng không ai chào theo cân.
    const r = weightPricing({
      name: 'BB chính Ghế Bank I',
      group_name: 'Bao bì - đóng gói - tem nhãn',
      unit: 'Thùng',
      price_unit: '',
    })
    expect(r.likely).toBe(false)
  })

  it('ĐVT đo lường (mét, m²) không phải hàng đếm được', () => {
    expect(weightPricing({ unit: 'Mét', name: 'Sắt la 40x3' }).countableUnit).toBe(false)
    expect(weightPricing({ unit: 'M²', name: 'Tôn' }).countableUnit).toBe(false)
  })
})
