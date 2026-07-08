/**
 * Số tiền → chữ tiếng Anh (in Sale Contract: "SAY: US DOLLARS … ONLY.").
 * Đủ dùng tới hàng tỷ; phần cent làm tròn 2 chữ số.
 */
const ONES = [
  '',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN',
]
const TENS = [
  '',
  '',
  'TWENTY',
  'THIRTY',
  'FORTY',
  'FIFTY',
  'SIXTY',
  'SEVENTY',
  'EIGHTY',
  'NINETY',
]

function threeDigits(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h) parts.push(`${ONES[h]} HUNDRED`)
  if (r >= 20) {
    const t = TENS[Math.floor(r / 10)]
    const o = r % 10
    parts.push(o ? `${t} ${ONES[o]}` : t)
  } else if (r > 0) {
    parts.push(ONES[r])
  }
  return parts.join(' ')
}

export function intToEnglishWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return 'ZERO'
  const units: [number, string][] = [
    [1_000_000_000, 'BILLION'],
    [1_000_000, 'MILLION'],
    [1_000, 'THOUSAND'],
  ]
  const parts: string[] = []
  let rest = Math.floor(n)
  for (const [value, label] of units) {
    if (rest >= value) {
      parts.push(`${threeDigits(Math.floor(rest / value))} ${label}`)
      rest %= value
    }
  }
  if (rest > 0) parts.push(threeDigits(rest))
  return parts.join(' ')
}

/** 15692.96 USD → "US DOLLARS FIFTEEN THOUSAND SIX HUNDRED NINETY TWO AND CENTS NINETY SIX ONLY". */
export function usdAmountInWords(amount: number): string {
  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)
  const wholeWords = intToEnglishWords(whole)
  return cents > 0
    ? `US DOLLARS ${wholeWords} AND CENTS ${intToEnglishWords(cents)} ONLY`
    : `US DOLLARS ${wholeWords} ONLY`
}
