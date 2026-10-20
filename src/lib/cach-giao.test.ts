import { describe, expect, it } from 'vitest'
import { cachGiao, tenChanh } from './cach-giao'

/** Các câu dưới là câu THẬT trên 97 đơn (đo 01/10/2026), chép nguyên văn. */
describe('cachGiao', () => {
  it('tận xưởng — tên công ty hoặc địa chỉ xưởng', () => {
    expect(cachGiao('CÔNG TY TNHH SX & TM HOÀNG GIA')).toBe('xuong')
    expect(
      cachGiao(
        'CÔNG TY TNHH SX-TM HOÀNG GIA - Lô C3, Cụm CN Cát Nhơn, Xã Xuân An, Gia Lai',
      ),
    ).toBe('xuong')
    expect(cachGiao('Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Gia Lai')).toBe(
      'xuong',
    )
  })

  it('gửi chành — ba cách ghi của cùng một chành', () => {
    expect(cachGiao('Nhà xe Hùng vịnh, QL 1A, Q12, Bãi xe miền nam.')).toBe('chanh')
    expect(cachGiao('Nhà xe hùng Vịnh, QL 1A, Q12, Tp.HCM')).toBe('chanh')
    expect(cachGiao('Chành xe hùng vịnh, QL 1A, Q12, Bãi xe miền nam')).toBe('chanh')
  })

  it('HG tự lấy — tại kho bên bán', () => {
    expect(cachGiao('Tại Kho bên bán')).toBe('tu_lay')
  })

  it('nhập khẩu — cảng / CIF', () => {
    expect(cachGiao('CIF Ho Chi Minh — cảng đi Shanghai, cảng đến TP. Hồ Chí Minh')).toBe(
      'nhap_khau',
    )
    expect(cachGiao('Cảng đi Shanghai — cảng đến Quy Nhơn')).toBe('nhap_khau')
  })

  it('trống thì là CHƯA GHI, không đoán tận xưởng', () => {
    expect(cachGiao(null)).toBeNull()
    expect(cachGiao('   ')).toBeNull()
  })
})

describe('tenChanh', () => {
  it('ba cách ghi ra cùng một tên', () => {
    expect(tenChanh('Nhà xe Hùng vịnh, QL 1A, Q12, Bãi xe miền nam.')).toBe('Hùng Vịnh')
    expect(tenChanh('Nhà xe hùng Vịnh, QL 1A, Q12, Tp.HCM')).toBe('Hùng Vịnh')
    expect(tenChanh('Chành xe hùng vịnh, QL 1A, Q12, Bãi xe miền nam')).toBe('Hùng Vịnh')
  })

  it('không phải chành thì không có tên', () => {
    expect(tenChanh('Tại Kho bên bán')).toBeNull()
  })
})
