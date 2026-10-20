import { describe, expect, it } from 'vitest'
import { henGiaoText } from './hen-giao-text'

const T = '2026-10-05'

describe('henGiaoText', () => {
  it('quá hẹn → trễ N ngày, tô dừng', () => {
    expect(henGiaoText('2026-09-03', T)).toEqual({ text: '03/09 · trễ 32 ngày', tone: 'stop', tre: 32 }) // prettier-ignore
  })
  it('đúng hôm nay → hôm nay, tô vàng', () => {
    expect(henGiaoText('2026-10-05', T)).toMatchObject({
      text: '05/10 · hôm nay',
      tone: 'warn',
    })
  })
  it('chưa tới → còn N ngày, không tô', () => {
    expect(henGiaoText('2026-11-10', T)).toMatchObject({
      text: '10/11 · còn 36 ngày',
      tone: null,
    })
  })
  it('chưa hẹn → nói rõ, không để trống', () => {
    expect(henGiaoText(null, T)).toMatchObject({ text: '— chưa hẹn', tre: null })
  })
  it('nhận cả chuỗi có giờ (timestamptz)', () => {
    expect(henGiaoText('2026-10-07T00:00:00+00:00', T).text).toBe('07/10 · còn 2 ngày')
  })
})
