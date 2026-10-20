import { describe, expect, it } from 'vitest'
import { cheCccd, chuanCccd, chuanSdt, hienSdt, tuoi } from './ca-nhan'

describe('kiểm số định danh, điện thoại', () => {
  it('CCCD 12 số hoặc CMND 9 số; bỏ khoảng trắng', () => {
    expect(chuanCccd('052 091 001 234')).toBe('052091001234')
    expect(chuanCccd('123456789')).toBe('123456789')
    expect(chuanCccd('05209100123')).toBeUndefined()
    expect(chuanCccd('  ')).toBeNull()
  })
  it('điện thoại VN, đổi +84 về 0', () => {
    expect(chuanSdt('0905 123 456')).toBe('0905123456')
    expect(chuanSdt('+84 905.123.456')).toBe('0905123456')
    expect(chuanSdt('84905123456')).toBe('0905123456')
    expect(chuanSdt('905123456')).toBeUndefined()
    expect(chuanSdt('')).toBeNull()
    expect(hienSdt('0905123456')).toBe('0905 123 456')
  })
  it('che CCCD chừa 4 số cuối; tuổi tròn năm', () => {
    expect(cheCccd('052091001234')).toBe('•••• 1234')
    expect(cheCccd(null)).toBeNull()
    expect(tuoi('1990-10-20', '2026-10-19')).toBe(35)
    expect(tuoi('1990-10-19', '2026-10-19')).toBe(36)
  })
})
