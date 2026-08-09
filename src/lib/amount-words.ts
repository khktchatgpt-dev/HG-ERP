/**
 * Số tiền BẰNG CHỮ tiếng Anh cho dòng "SAY:" của Sales Contract — theo đúng văn
 * phong hợp đồng thật của công ty:
 *   6677 USD → "U.S DOLLARS SIX THOUSAND SIX HUNDRED AND SEVENTY SEVEN ONLY."
 * "AND" chen trước cụm chục-đơn vị cuối của mỗi nhóm trăm (kiểu Anh), phần lẻ
 * (cents) ghi "AND CENTS …" — hợp đồng cũ toàn số chẵn nên cents hiếm gặp.
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
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION']

/** 1–999 → chữ ("SIX HUNDRED AND SEVENTY SEVEN"). */
function threeDigits(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) parts.push(`${ONES[hundreds]} HUNDRED`)
  if (rest > 0) {
    const restWords =
      rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]} ${ONES[rest % 10]}`.trim()
    parts.push(hundreds > 0 ? `AND ${restWords}` : restWords)
  }
  return parts.join(' ')
}

/** Số nguyên không âm → chữ hoa tiếng Anh. 0 → "ZERO". */
export function integerInWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return 'ZERO'
  const groups: number[] = []
  let v = Math.floor(n)
  while (v > 0) {
    groups.push(v % 1000)
    v = Math.floor(v / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    const scale = SCALES[i]
    parts.push(scale ? `${threeDigits(groups[i])} ${scale}` : threeDigits(groups[i]))
  }
  return parts.join(' ')
}

/** Tên tiền tệ theo văn phong hợp đồng cũ; mã lạ giữ nguyên mã. */
const CURRENCY_WORDS: Record<string, string> = {
  USD: 'U.S DOLLARS',
  EUR: 'EUROS',
  VND: 'VIETNAM DONG',
  GBP: 'BRITISH POUNDS',
}

/**
 * "SAY : U.S DOLLARS SIX THOUSAND SIX HUNDRED AND SEVENTY SEVEN ONLY."
 * (chỉ phần sau "SAY :" — caller tự ghép nhãn).
 */
export function amountInWords(amount: number, currency: string): string {
  const cur = CURRENCY_WORDS[currency.toUpperCase()] ?? currency.toUpperCase()
  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)
  let words = `${cur} ${integerInWords(whole)}`
  if (cents > 0) words += ` AND CENTS ${integerInWords(cents)}`
  return `${words} ONLY.`
}
