import { describe, expect, it } from 'vitest'
import { chuanHoaO, docSo, hienSo, laSoSai } from './so-o-luoi'

describe('docSo — một luật cho gõ tay và dán', () => {
  it.each([
    ['1.390', 1390], // Dài cắt: trước 15/11 gõ tay ra 1,39
    ['1.390,5', 1390.5],
    ['12.345.678', 12345678],
    ['1,25', 1.25],
    ['1,125', 1.125], // ĐM kg ba số lẻ — po-paste từng đọc 1125
    ['0,525', 0.525],
    ['0.525', 0.525], // phần nguyên 0 → thập phân
    ['2.5', 2.5],
    ['1.25', 1.25],
    ['1390', 1390],
    [' 1 390 ', 1390],
    ['1,390.5', 1390.5], // kiểu Anh, không lẫn được
    ['1,234,567', 1234567],
    ['-3', -3],
    [',5', 0.5],
  ])('%s → %s', (raw, n) => {
    expect(docSo(raw)).toBe(n)
  })

  it.each(['abc', '1,2,3', '1.2.3', '12kg', '1.39.0', '-', '.', ''])(
    '"%s" không đọc được → null',
    (raw) => {
      expect(docSo(raw)).toBeNull()
    },
  )

  it('laSoSai: trống KHÔNG sai, chữ thì sai', () => {
    expect(laSoSai('')).toBe(false)
    expect(laSoSai('  ')).toBe(false)
    expect(laSoSai('abc')).toBe(true)
    expect(laSoSai('1,5')).toBe(false)
  })
})

describe('hienSo ↔ docSo', () => {
  it('số đã lưu mở ra rồi lưu lại không đổi', () => {
    for (const x of [0, 1, 1.125, 0.525, 1390, 1390.5, 2.25, 12345.678, 0.001, 1000])
      expect(docSo(hienSo(x))).toBe(x)
  })
  it('viết phẩy thập phân, không nhóm nghìn', () => {
    expect(hienSo(1.125)).toBe('1,125')
    expect(hienSo(1390)).toBe('1390')
    expect(hienSo(null)).toBe('')
  })
  it('chuanHoaO: gõ "1.390" thấy ngay 1390; chữ giữ nguyên để tô đỏ', () => {
    expect(chuanHoaO('1.390')).toBe('1390')
    expect(chuanHoaO('2.5')).toBe('2,5')
    expect(chuanHoaO(' abc ')).toBe('abc')
    expect(chuanHoaO('')).toBe('')
  })
})
