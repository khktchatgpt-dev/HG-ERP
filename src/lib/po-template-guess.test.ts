import { describe, expect, it } from 'vitest'
import { guessTemplate, resolveTemplate } from './po-template-guess'

/*
 * Tên trong các case dưới đây là DỮ LIỆU THẬT từ sổ Cung ứng. Bản đoán đầu tiên
 * gán mẫu theo NHÓM và sai đúng những ca này — cụm "Nhôm - thanh & tấm" 548
 * dòng mà chỉ 180 là nhôm thật.
 */
describe('guessTemplate — chữ "nhôm" trong tên không có nghĩa là mẫu nhôm', () => {
  it.each([
    // Cromate/thụ động là HOÁ CHẤT xử lý bề mặt → mẫu chemical (08/08/2026 —
    // ý test vẫn là "không phải nhôm"; điều khoản Kiệm Tâm khác hẳn sơn).
    ['Cromate nhôm', 'chemical'],
    ['Thụ động nhôm(Al-7130R)', 'chemical'],
    ['Dây hàn mig nhôm ER 4043 1.6mm', 'simple'],
    ['Cân treo nhôm 150kg/8', 'simple'],
    ['Chốt Nhôm', 'accessory'],
  ])('%s → %s', (name, tpl) => {
    expect(guessTemplate(name, null, 0.5).template).toBe(tpl)
  })

  it('nhôm định hình có kg/m mới ra mẫu nhôm', () => {
    expect(guessTemplate('Nhôm la 3x25', null, 0.2062).template).toBe('aluminium')
  })

  it('nhôm KHÔNG có kg/m → simple, để dòng đơn khỏi bị chặn', () => {
    // lineReady chặn gửi dòng nhôm thiếu kg/m; người soạn đơn kẹt sẽ gõ đại.
    const g = guessTemplate('Nhôm la 3x25', null, null)
    expect(g.template).toBe('simple')
    expect(g.reason).toContain('chưa có kg/m')
  })
})

describe('guessTemplate — ngũ kim xét trước vật liệu', () => {
  it('"Bu lông ... sắt xi 7 màu" là ngũ kim, không phải hàng sắt cây', () => {
    // "sắt xi" là lớp mạ. Xét vật liệu trước thì 89 con bu lông mang metal_kg,
    // tức bị đòi kg/đơn-vị trong khi NCC chào theo con.
    expect(guessTemplate('Bu lông LGC 6x20x15 sắt xi 7 màu').template).toBe('accessory')
  })

  it('hàng sắt/inox có quy cách thật → metal_kg', () => {
    expect(guessTemplate('Thép hộp mạ kẽm 20x40x1.0mm').template).toBe('metal_kg')
    expect(guessTemplate('Hộp kẽm 13x26x0.8x6000mm').template).toBe('metal_kg')
  })
})

describe('guessTemplate — các mẫu còn lại', () => {
  it.each([
    ['Thùng carton 5 lớp KT: 715x660x415', 'carton'],
    ['Tem made in VietNam', 'accessory'],
    ['Nút nhựa vuông 76', 'accessory'],
    ['Vòng bi 6203', 'simple'],
    // 4 mẫu 08/08/2026 — tên thật từ đơn Drive Cung ứng.
    ['Mây dẹp Treviso', 'rattan'],
    ['Dây rope tròn 6mm', 'rattan'],
    ['Sơn xám cát ngoài trời', 'paint'],
    ['Tẩy dầu phun TD-226S (20kg/can)', 'chemical'],
    ['Nano Phosphat NCP-01.KT (25kg/can)', 'chemical'],
    ['Mút dai 5mm x 1.05m x 50m', 'foam'],
    ['DDH VÁN ÉP phủ phim 12mm', 'foam'],
    ['Xốp nổ 1.4m x 100m', 'foam'],
  ])('%s → %s', (name, tpl) => {
    expect(guessTemplate(name).template).toBe(tpl)
  })

  it('không suy được từ tên thì dựa nhóm phụ', () => {
    const g = guessTemplate('LGC 6x25x15', 'Bulon - tán - đinh tán')
    expect(g.template).toBe('accessory')
    expect(g.reason).toContain('nhóm phụ')
  })

  it('luôn kèm lý do — không bắt người dùng tin mù', () => {
    expect(guessTemplate('Vòng bi 6203').reason.length).toBeGreaterThan(5)
  })
})

describe('resolveTemplate — người chọn thắng máy đoán', () => {
  it('giữ mẫu người dùng đã chọn', () => {
    const g = guessTemplate('Vòng bi 6203')
    expect(resolveTemplate('metal_kg', g)).toBe('metal_kg')
  })

  it('giá trị lạ / bỏ trống thì lấy mẫu đoán', () => {
    const g = guessTemplate('Tem made in VietNam')
    expect(resolveTemplate(null, g)).toBe('accessory')
    expect(resolveTemplate('linh tinh', g)).toBe('accessory')
  })
})
