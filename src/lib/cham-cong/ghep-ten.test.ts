import { describe, expect, it } from 'vitest'
import { boSo0, khongDau, khopDuoiTen } from './ghep-ten'

describe('khongDau', () => {
  it('bỏ dấu, đ → D, viết hoa, gọn khoảng trắng', () => {
    expect(khongDau('  Đào  Thị Hiền ')).toBe('DAO THI HIEN')
  })
})

describe('khopDuoiTen', () => {
  it('tên máy không dấu là 2 chữ cuối', () => {
    expect(khopDuoiTen('Phạm Văn Trọn', 'VAN TRON')).toBe(true)
  })
  it('tên máy có dấu (.203)', () => {
    expect(khopDuoiTen('Trương Văn Hùng', 'VĂN HÙNG')).toBe(true)
  })
  it('chữ viết tắt khớp chữ đầu', () => {
    expect(khopDuoiTen('Lê Đình Khương', 'D KHUONG')).toBe(true)
  })
  it('tên máy đầy đủ cũng khớp', () => {
    expect(khopDuoiTen('Đoàn Cẩm Tú Hằng', 'ĐOÀN CẨM TÚ HẰNG')).toBe(true)
  })
  it('khác tên thì không khớp', () => {
    expect(khopDuoiTen('Lê Thị Bích Hương', 'BÍCH PHƯƠNG')).toBe(false)
  })
  it('tên máy rỗng hoặc dài hơn họ tên thì không khớp', () => {
    expect(khopDuoiTen('Văn Bi', '')).toBe(false)
    expect(khopDuoiTen('Văn Bi', 'LE VAN BI')).toBe(false)
  })
})

describe('boSo0', () => {
  it('bỏ số 0 đầu, giữ số 0 duy nhất', () => {
    expect(boSo0('00604')).toBe('604')
    expect(boSo0('0')).toBe('0')
  })
})
