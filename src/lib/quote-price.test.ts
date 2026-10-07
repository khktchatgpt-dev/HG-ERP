import { describe, it, expect } from 'vitest'
import { quoteNetPrice } from './quote-price'

describe('quoteNetPrice — giá net dòng báo giá (giá in gửi khách = giá nạp sang đơn)', () => {
  it('không chiết khấu → giữ nguyên giá gộp', () => {
    expect(quoteNetPrice(145, null)).toBe(145)
    expect(quoteNetPrice(145, 0)).toBe(145)
    expect(quoteNetPrice(145, undefined)).toBe(145)
  })

  it('có chiết khấu → trừ % và làm tròn 2 số lẻ', () => {
    expect(quoteNetPrice(100, 10)).toBe(90)
    expect(quoteNetPrice(145, 5)).toBe(137.75)
    expect(quoteNetPrice(12.345, 10)).toBe(11.11)
  })

  it('chiết khấu âm coi như không có — không cộng thêm giá', () => {
    expect(quoteNetPrice(100, -5)).toBe(100)
  })
})
