import { describe, expect, it } from 'vitest'
import { amountInWords, integerInWords } from './amount-words'

describe('integerInWords', () => {
  it('số nhỏ', () => {
    expect(integerInWords(0)).toBe('ZERO')
    expect(integerInWords(7)).toBe('SEVEN')
    expect(integerInWords(13)).toBe('THIRTEEN')
    expect(integerInWords(20)).toBe('TWENTY')
    expect(integerInWords(21)).toBe('TWENTY ONE')
  })

  it('trăm có AND kiểu Anh', () => {
    expect(integerInWords(677)).toBe('SIX HUNDRED AND SEVENTY SEVEN')
    expect(integerInWords(100)).toBe('ONE HUNDRED')
    expect(integerInWords(105)).toBe('ONE HUNDRED AND FIVE')
  })

  it('nghìn / triệu, bỏ nhóm 0', () => {
    expect(integerInWords(6677)).toBe('SIX THOUSAND SIX HUNDRED AND SEVENTY SEVEN')
    expect(integerInWords(78200)).toBe('SEVENTY EIGHT THOUSAND TWO HUNDRED')
    expect(integerInWords(1_000_000)).toBe('ONE MILLION')
    expect(integerInWords(2_000_015)).toBe('TWO MILLION FIFTEEN')
  })
})

describe('amountInWords', () => {
  it('đúng câu SAY của hợp đồng thật (17891HG-MX = 6,677 USD)', () => {
    expect(amountInWords(6677, 'USD')).toBe(
      'U.S DOLLARS SIX THOUSAND SIX HUNDRED AND SEVENTY SEVEN ONLY.',
    )
  })

  it('có cents', () => {
    expect(amountInWords(120.5, 'USD')).toBe(
      'U.S DOLLARS ONE HUNDRED AND TWENTY AND CENTS FIFTY ONLY.',
    )
  })

  it('EUR + mã lạ giữ nguyên', () => {
    expect(amountInWords(200, 'EUR')).toBe('EUROS TWO HUNDRED ONLY.')
    expect(amountInWords(200, 'JPY')).toBe('JPY TWO HUNDRED ONLY.')
  })
})
