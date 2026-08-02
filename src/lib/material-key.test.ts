import { describe, expect, it } from 'vitest'
import { prefixForGroup, scopedSureKey, softKey, sureKey } from './material-key'

/*
 * Bốn cách viết dưới đây là DỮ LIỆU THẬT — cùng một con long đền đã vào danh mục
 * bốn lần với bốn mã khác nhau, và đó là lý do `scripts/materials-dedupe.mjs` ra
 * đời. Chặn được đúng bốn ca này nghĩa là không đẻ thêm ca thứ năm.
 */
describe('sureKey — mức CHẮC CHẮN, chặn được lúc tạo', () => {
  const canon = sureKey('LĐN 6x16x2 đen')

  it.each([
    'LĐN 6x16x2 đen',
    'LĐN 6x16x2, màu đen',
    'lđn 6x16x2  đen',
    'LĐN 6x16x2 đen ',
  ])('"%s" cùng khoá', (name) => {
    expect(sureKey(name)).toBe(canon)
  })

  it('đuôi đơn vị ly/li không làm ra mã mới', () => {
    expect(sureKey('Hộp 25x50x1li')).toBe(sureKey('Hộp 25x50x1'))
    expect(sureKey('Hộp 25x50x1 ly')).toBe(sureKey('Hộp 25x50x1'))
  })

  it('KHÁC MÀU là hai mặt hàng thật — không được cùng khoá', () => {
    // Gộp nhầm chỗ này là đặt nhầm màu, tệ hơn là để trùng.
    expect(sureKey('LĐN 6x16x2 đen')).not.toBe(sureKey('LĐN 6x16x2 xám'))
  })

  it('khác quy cách thì khác khoá', () => {
    expect(sureKey('LĐN 6x16x2')).not.toBe(sureKey('LĐN 8x16x2'))
  })
})

describe('softKey — mức NGHI NGỜ, chỉ cảnh báo', () => {
  it('bắt sai chính tả ở phần chữ mà vẫn cùng quy cách', () => {
    expect(softKey('LĐN 6x16x2 đen')).toBe(softKey('LĐN 6x16x2 đem'))
  })

  it('tên KHÔNG CÓ SỐ thì bỏ qua', () => {
    // Không có vế này thì "Bao bì — Ghế Hali", "Bao bì bàn"… gom thành một cụm
    // 12 mặt hàng khác nhau, danh sách rà thành vô dụng.
    expect(softKey('Bao bì bàn')).toBeNull()
  })
})

describe('scopedSureKey — không so chéo vật liệu', () => {
  it('cùng tên nhưng khác nhóm là hai mặt hàng', () => {
    // "Hộp 25x50x1" của INOX (IX-0002) và "Hộp 25x50x1li" của NHÔM (NH-0080)
    // trùng từng ký tự sau chuẩn hoá nhưng giá chênh nhiều lần.
    expect(scopedSureKey('Hộp 25x50x1', 'Inox')).not.toBe(
      scopedSureKey('Hộp 25x50x1li', 'Nhôm'),
    )
  })

  it('cùng nhóm, khác cách viết → cùng khoá', () => {
    expect(scopedSureKey('Hộp 25x50x1', 'Inox')).toBe(
      scopedSureKey('hộp 25x50x1 li', 'INOX'),
    )
  })
})

describe('prefixForGroup — chỉ dùng khi nhóm chưa có mã nào để suy', () => {
  it.each([
    ['Ngũ kim - phụ kiện', 'NK'],
    ['Bao bì', 'BB'],
    ['Nhôm', 'NH'],
    ['Inox', 'IX'],
    ['Sắt', 'ST'],
  ])('%s → %s', (group, prefix) => {
    expect(prefixForGroup(group)).toBe(prefix)
  })

  it('nhóm lạ / bỏ trống → null, nơi gọi tự quyết', () => {
    expect(prefixForGroup('Vật tư linh tinh')).toBeNull()
    expect(prefixForGroup(null)).toBeNull()
  })
})
