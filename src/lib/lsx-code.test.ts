import { describe, expect, it } from 'vitest'
import { shortCustomerLabel, suggestLsxCode } from './lsx-code'

describe('shortCustomerLabel', () => {
  it('bỏ cụm loại hình doanh nghiệp ở đầu tên', () => {
    expect(shortCustomerLabel('CÔNG TY TNHH ROSCO VIỆT NAM')).toBe('ROSCO')
    expect(shortCustomerLabel('Cty CP Laura Furniture')).toBe('Laura')
    expect(shortCustomerLabel('Công ty TNHH MTV Yotrio')).toBe('Yotrio')
  })

  it('giữ nguyên tên không có cụm loại hình', () => {
    expect(shortCustomerLabel('MERXX HANDELS GMBH')).toBe('MERXX')
    expect(shortCustomerLabel('Rosco')).toBe('Rosco')
  })

  it('không cắt nhầm tên riêng trùng chữ với cụm loại hình', () => {
    // "cổ phần" phải đủ hai chữ mới bị bỏ — "Phan Gia" là tên riêng.
    expect(shortCustomerLabel('Phan Gia Decor')).toBe('Phan')
  })

  it('gọt dấu câu và chịu được tên rỗng', () => {
    expect(shortCustomerLabel('  YOTRIO,  GROUP ')).toBe('YOTRIO')
    expect(shortCustomerLabel('   ')).toBe('')
  })
})

describe('suggestLsxCode', () => {
  const opts = { customerName: 'ROSCO', year: 2026 }

  it('khách chưa có lệnh nào trong năm → bắt đầu từ 01', () => {
    expect(suggestLsxCode({ ...opts, existingCodes: [] })).toBe('01/26 - ROSCO')
  })

  it('lấy số lớn nhất trong năm rồi +1, không phải đếm số dòng', () => {
    // Lệnh 02 đã bị huỷ/xoá khỏi danh sách — vẫn phải ra 04, không quay lại 03.
    expect(
      suggestLsxCode({ ...opts, existingCodes: ['01/26 - Rosco', '03/26 - Rosco'] }),
    ).toBe('04/26 - ROSCO')
  })

  it('bỏ qua lệnh của năm khác', () => {
    expect(
      suggestLsxCode({ ...opts, existingCodes: ['07/25 - Rosco', '12/25 - Rosco'] }),
    ).toBe('01/26 - ROSCO')
  })

  it('bỏ qua mã cũ không theo mẫu NN/YY', () => {
    expect(
      suggestLsxCode({
        ...opts,
        existingCodes: ['LSX-2026-0001', 'DEMO-LSX-01', '02/26 - Rosco'],
      }),
    ).toBe('03/26 - ROSCO')
  })

  it('chịu được số lệnh viết thoáng và số không dẫn đầu', () => {
    expect(suggestLsxCode({ ...opts, existingCodes: [' 9 / 26 - Rosco'] })).toBe(
      '10/26 - ROSCO',
    )
    expect(suggestLsxCode({ ...opts, existingCodes: ['009/26'] })).toBe('10/26 - ROSCO')
  })

  it('không nhầm 4 số năm thành số thứ tự', () => {
    // "01/2026" — 2 số sau là "20", không phải "26" → không tính vào năm 26.
    expect(suggestLsxCode({ ...opts, existingCodes: ['01/2026 - Rosco'] })).toBe(
      '01/26 - ROSCO',
    )
  })

  it('khách không tên thì chỉ còn số', () => {
    expect(suggestLsxCode({ customerName: '', existingCodes: [], year: 2026 })).toBe(
      '01/26',
    )
  })
})
