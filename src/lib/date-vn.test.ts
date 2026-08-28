import { describe, expect, it } from 'vitest'
import { isoToVn, maskVnDate, vnToIso } from './date-vn'

describe('isoToVn', () => {
  it('đổi ISO sang kiểu VN', () => {
    expect(isoToVn('2026-08-03')).toBe('03/08/2026')
  })
  it('bỏ qua phần giờ nếu có', () => {
    expect(isoToVn('2026-08-03T10:00:00Z')).toBe('03/08/2026')
  })
  it('rỗng/không đúng khuôn → chuỗi rỗng', () => {
    expect(isoToVn('')).toBe('')
    expect(isoToVn(null)).toBe('')
    expect(isoToVn('03/08/2026')).toBe('')
  })
})

describe('vnToIso', () => {
  it('đổi kiểu VN sang ISO', () => {
    expect(vnToIso('03/08/2026')).toBe('2026-08-03')
    expect(vnToIso('3/8/2026')).toBe('2026-08-03')
  })
  it('ngày không có thật → null', () => {
    expect(vnToIso('31/02/2026')).toBeNull()
    expect(vnToIso('31/04/2026')).toBeNull()
    expect(vnToIso('13/13/2026')).toBeNull()
  })
  it('29/02 chỉ đúng vào năm nhuận', () => {
    expect(vnToIso('29/02/2028')).toBe('2028-02-29')
    expect(vnToIso('29/02/2026')).toBeNull()
  })
  it('gõ dở → null, không nhảy giá trị dưới tay', () => {
    expect(vnToIso('03/08')).toBeNull()
    expect(vnToIso('')).toBeNull()
  })
})

describe('maskVnDate', () => {
  it('tự chèn dấu / khi gõ', () => {
    expect(maskVnDate('0')).toBe('0')
    expect(maskVnDate('03')).toBe('03')
    expect(maskVnDate('0308')).toBe('03/08')
    expect(maskVnDate('03082026')).toBe('03/08/2026')
  })
  it('giữ ranh giới người gõ chia — dấu nào cũng thành /', () => {
    expect(maskVnDate('3-8-2026')).toBe('3/8/2026')
    expect(maskVnDate('03.08.2026')).toBe('03/08/2026')
  })
  it('gõ dấu ngăn xong bỏ lửng thì giữ dấu', () => {
    expect(maskVnDate('03/')).toBe('03/')
    expect(maskVnDate('03/0')).toBe('03/0')
  })
  it('cắt phần thừa', () => {
    expect(maskVnDate('030820261')).toBe('03/08/2026')
  })
})
