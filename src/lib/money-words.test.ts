import { describe, it, expect } from 'vitest'
import { intToEnglishWords, usdAmountInWords } from './money-words'

describe('intToEnglishWords', () => {
  it('cơ bản', () => {
    expect(intToEnglishWords(0)).toBe('ZERO')
    expect(intToEnglishWords(7)).toBe('SEVEN')
    expect(intToEnglishWords(15)).toBe('FIFTEEN')
    expect(intToEnglishWords(42)).toBe('FORTY TWO')
    expect(intToEnglishWords(100)).toBe('ONE HUNDRED')
    expect(intToEnglishWords(215)).toBe('TWO HUNDRED FIFTEEN')
  })

  it('nghìn / triệu', () => {
    expect(intToEnglishWords(1000)).toBe('ONE THOUSAND')
    expect(intToEnglishWords(15692)).toBe('FIFTEEN THOUSAND SIX HUNDRED NINETY TWO')
    expect(intToEnglishWords(2_000_001)).toBe('TWO MILLION ONE')
  })
})

describe('usdAmountInWords — khớp mẫu Sale Contract', () => {
  it('15,692.96 → như mẫu in thật', () => {
    expect(usdAmountInWords(15692.96)).toBe(
      'US DOLLARS FIFTEEN THOUSAND SIX HUNDRED NINETY TWO AND CENTS NINETY SIX ONLY',
    )
  })

  it('số chẵn không in cents', () => {
    expect(usdAmountInWords(660)).toBe('US DOLLARS SIX HUNDRED SIXTY ONLY')
  })
})
