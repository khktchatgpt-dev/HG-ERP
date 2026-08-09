import { describe, expect, it } from 'vitest'
import {
  namesAlike,
  prefixForGroup,
  scopedSureKey,
  softKey,
  sureKey,
} from './material-key'

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

  /*
   * VIẾT TẮT XƯỞNG (0124) — bằng chứng từ chính sổ Cung ứng: sheet "Tổng VT cần
   * mua" (LSX 04) phải ghi tay "Gộp 3 dòng (4x15 7 màu / 7M)", "Gộp 2 dòng
   * (xi trắng / XT)" vì hai cách viết đã thành hai mã.
   */
  it('7M và "7 màu" là MỘT — cùng khoá, chặn được lúc tạo', () => {
    expect(sureKey('Vít 4x15, 7M')).toBe(sureKey('Vít 4x15, 7 màu'))
  })

  it('XT và "xi trắng" là MỘT', () => {
    expect(sureKey('Eru 10, XT')).toBe(sureKey('Eru 10, xi trắng'))
    expect(sureKey('Vít 4x20 đầu dù đuôi cá, XT')).toBe(
      sureKey('Vít 4x20 đầu dù đuôi cá, xi trắng'),
    )
  })

  it('ĐBĐC = đầu bằng đuôi cá — nhưng KHÔNG lẫn với đầu dù', () => {
    expect(sureKey('Vít 4x20 ĐBĐC, XT')).toBe(
      sureKey('Vít 4x20 đầu bằng đuôi cá, xi trắng'),
    )
    // "đầu bằng" và "đầu dù" là hai loại vít thật (sổ ghi chú "Khác 'đầu dù'").
    expect(sureKey('Vít 4x20 đầu bằng đuôi cá')).not.toBe(
      sureKey('Vít 4x20 đầu dù đuôi cá'),
    )
  })

  it('khác quy cách thì khác khoá', () => {
    expect(sureKey('LĐN 6x16x2')).not.toBe(sureKey('LĐN 8x16x2'))
  })

  /*
   * HỒI QUY: bỏ dấu "/" làm "Cục típ 1/2" (1/2 inch) đụng "Cục típ 12" (12 mm).
   * Mức "chắc chắn" CHẶN CỨNG lúc tạo nên gộp sai ở đây = không khai được vật
   * tư = quên mua. Cả hai mã đều có thật trong sổ Cung ứng (DCC0195, DCC0197).
   */
  it('phân số KHÔNG được đụng số nguyên viết liền', () => {
    expect(sureKey('Cục típ 1/2')).not.toBe(sureKey('Cục típ 12'))
    expect(sureKey('Đầu cos 25/8')).not.toBe(sureKey('Đầu cos 258'))
  })

  it('cùng phân số, khác cách viết khoảng trắng → vẫn cùng khoá', () => {
    expect(sureKey('Cục típ 1/2')).toBe(sureKey('Cục típ 1 / 2'))
  })

  it('"25/8" và "25-8" thôi tự gộp — nhường cho mức nghi ngờ', () => {
    // Đánh đổi có chủ đích: mức "chắc chắn" không được sai, mức "nghi ngờ" bắt
    // hộ và chỉ cảnh báo chứ không chặn.
    expect(sureKey('Đầu cos 25/8')).not.toBe(sureKey('Đầu cos 25-8'))
    expect(softKey('Đầu cos 25/8')).toBe(softKey('Đầu cos 25-8'))
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

/*
 * SO MỜ mức "nghi ngờ" (0124) — các ca ilike-chứa-nhau lọt sạch. "Bộ tip Buri +
 * Cây xỏ" (LSX 04) và "Bộ Típ Bori + cây xỏ" (BKVT LSX 02) là MỘT món trong sổ
 * thật: không chứa nhau, không có số để softKey bám.
 */
describe('namesAlike — so mờ theo từ, chỉ để cảnh báo', () => {
  it('Buri/Bori, tip/Típ — một món hai cách viết', () => {
    expect(namesAlike('Bộ tip Buri + Cây xỏ', 'Bộ Típ Bori + cây xỏ')).toBe(true)
  })

  it('đen/đem — lỗi gõ thật từ danh mục', () => {
    expect(namesAlike('LĐN 6x16x2 đen', 'LĐN 6x16x2 , đem')).toBe(true)
  })

  it('từ mang CHỮ SỐ phải khớp tuyệt đối — 6x16x2 và 6x16x3 là hai cỡ', () => {
    expect(namesAlike('LĐN 6x16x2 đen', 'LĐN 6x16x3 đen')).toBe(false)
  })

  it('đen/xám lệch quá 1 ký tự — hai hàng thật, không báo', () => {
    expect(namesAlike('LĐN 6x16x2 đen', 'LĐN 6x16x2 xám')).toBe(false)
  })

  it('tên quá ngắn thì bỏ qua, không báo bừa', () => {
    expect(namesAlike('ốc', 'óc')).toBe(false)
  })

  it('viết tắt + so mờ chạy chung: "7M" khớp "7 màu" qua đường alike', () => {
    expect(namesAlike('Vít dù 4x15, 7M', 'Vít dù 4x15, 7 màu')).toBe(true)
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
