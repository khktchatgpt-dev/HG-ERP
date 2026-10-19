import { describe, expect, it } from 'vitest'
import { docDem, gioVn } from './phieu-dem.shared'

describe('docDem — chữ gõ → số đếm', () => {
  it('trống KHÔNG phải 0', () => {
    expect(docDem('')).toBeNull()
    expect(docDem('   ')).toBeNull()
    expect(docDem(undefined)).toBeNull()
  })
  it('0 là số đếm hợp lệ', () => expect(docDem('0')).toBe(0))
  it('luật số VN: "1.390" = 1390, "12,5" = 12,5', () => {
    expect(docDem('1.390')).toBe(1390)
    expect(docDem('12,5')).toBe(12.5)
  })
  it('chữ hoặc số âm → null', () => {
    expect(docDem('abc')).toBeNull()
    expect(docDem('-3')).toBeNull()
  })
})

describe('gioVn', () => {
  it('ngày/tháng giờ:phút theo giờ Việt Nam', () => {
    expect(gioVn('2026-10-19T04:26:00Z')).toBe('19/10 11:26')
    expect(gioVn('2026-10-19T17:05:00Z')).toBe('20/10 00:05')
    expect(gioVn(null)).toBe('')
  })
})
