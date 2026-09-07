import { describe, expect, it } from 'vitest'
import { HAO_HUT_MAC_DINH, slDatHang } from './po-waste'

/**
 * Cột "SL Đặt hàng hh 3%" đi thẳng vào đơn gửi nhà cung cấp — sai ở đây là mua
 * sai. Test canh hai luật dễ hỏng nhất: LÀM TRÒN LÊN, và đơn vị nào thì tròn
 * về số nguyên.
 */
describe('slDatHang', () => {
  it('cộng hao hụt rồi làm tròn LÊN cho đơn vị không chia nhỏ được', () => {
    // 287,808 cây × 1,03 = 296,44 → phải đặt 297 cây, không phải 296.
    expect(slDatHang(287.808, 3, 'Cây')).toBe(297)
    expect(slDatHang(800, 3, 'con')).toBe(824)
    expect(slDatHang(100, 3, 'Cái')).toBe(103)
  })

  it('đơn vị đo lường giữ hai số lẻ, vẫn tròn lên', () => {
    expect(slDatHang(10, 3, 'kg')).toBe(10.3)
    expect(slDatHang(12.345, 3, 'm')).toBe(12.72)
    expect(slDatHang(1.001, 0, 'm2')).toBe(1.01)
  })

  it('không hao hụt thì vẫn làm tròn lên theo đơn vị — 287,81 cây là 288 cây', () => {
    expect(slDatHang(287.808, 0, 'cây')).toBe(288)
    expect(slDatHang(287.808, -5, 'cây')).toBe(288)
  })

  it('số nguyên sẵn không bị đội thêm vì sai số nhị phân', () => {
    expect(slDatHang(100, 0, 'cái')).toBe(100)
    expect(slDatHang(103, 0, 'cái')).toBe(103)
  })

  it('số vô nghĩa trả 0, không nổ', () => {
    expect(slDatHang(0, 3, 'cái')).toBe(0)
    expect(slDatHang(-5, 3, 'cái')).toBe(0)
    expect(slDatHang(Number.NaN, 3, 'cái')).toBe(0)
  })

  it('mặc định của phòng là 3%', () => {
    expect(HAO_HUT_MAC_DINH).toBe(3)
  })
})
