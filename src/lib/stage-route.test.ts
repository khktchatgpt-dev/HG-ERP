import { describe, expect, it } from 'vitest'
import { clipRoute, resolveComponentRoute, routeForGroup } from './stage-route'

const R = ['phoi', 'han', 'nguoi', 'mai', 'son']

describe('clipRoute — cắt lộ trình về khoảng [first..final] (0088)', () => {
  it('không mốc → nguyên lộ trình', () => {
    expect(clipRoute(R, null, null)).toEqual(R)
  })

  it('first_stage: cụm bắt đầu ở hàn → bỏ phôi', () => {
    expect(clipRoute(R, 'han', null)).toEqual(['han', 'nguoi', 'mai', 'son'])
  })

  it('final_stage: chi tiết dừng ở phôi', () => {
    expect(clipRoute(R, null, 'phoi')).toEqual(['phoi'])
  })

  it('cả hai mốc', () => {
    expect(clipRoute(R, 'han', 'mai')).toEqual(['han', 'nguoi', 'mai'])
  })

  it('mốc không thuộc lộ trình → bỏ mốc đó (như summarizeComponent)', () => {
    expect(clipRoute(R, 'khong-co', 'mai')).toEqual(['phoi', 'han', 'nguoi', 'mai'])
  })

  it('khoảng ngược → trả nguyên lộ trình, không nổ', () => {
    expect(clipRoute(R, 'son', 'phoi')).toEqual(R)
  })

  it('lộ trình rỗng an toàn', () => {
    expect(clipRoute([], null, 'phoi')).toEqual([])
  })
})

describe('resolveComponentRoute/routeForGroup — giữ hợp đồng cũ', () => {
  it('kế hoạch thắng nhóm; không kế hoạch thì suy nhóm; nhóm lạ rỗng', () => {
    expect(resolveComponentRoute(['moc'], 'FRAME')).toEqual(['moc'])
    expect(resolveComponentRoute(null, 'FRAME')).toEqual(R)
    expect(routeForGroup('NGU_KIM')).toEqual([])
    expect(routeForGroup(null)).toEqual([])
  })
})
