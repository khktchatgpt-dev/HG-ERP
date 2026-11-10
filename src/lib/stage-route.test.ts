import { describe, expect, it } from 'vitest'
import {
  clipRoute,
  componentRoute,
  resolveComponentRoute,
  routeForGroup,
} from './stage-route'

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

describe('resolveComponentRoute/routeForGroup — nhóm đã biết thắng kế hoạch (10/11/2026)', () => {
  it('nhóm đã biết thắng kế hoạch; nhóm lạ mới lùi về kế hoạch; không gì cả thì rỗng', () => {
    // Kế hoạch tổ & hạn KHÔNG phải lộ trình: khung vẫn đi lộ trình nhóm.
    expect(resolveComponentRoute(['moc'], 'FRAME')).toEqual([
      'phoi',
      'han',
      'nguoi',
      'son',
    ])
    // Ngũ kim là hàng mua: kế hoạch dòng SP không kéo con vít lên sổ tổ Phôi.
    expect(resolveComponentRoute(['phoi', 'han', 'nguoi', 'son'], 'NGU_KIM')).toEqual([])
    // Gỗ chỉ qua sơn dù kế hoạch dòng SP có phôi → hàn.
    expect(resolveComponentRoute(['phoi', 'han', 'nguoi', 'son'], 'WOOD')).toEqual([
      'son',
    ])
    // Chưa phân nhóm → kế hoạch là đường lùi; không kế hoạch → rỗng (không đoán).
    expect(resolveComponentRoute(['phoi', 'son'], null)).toEqual(['phoi', 'son'])
    expect(resolveComponentRoute(['phoi', 'son'], 'NHOM_LA')).toEqual(['phoi', 'son'])
    expect(resolveComponentRoute(null, 'NHOM_LA')).toEqual([])
    // Lộ trình MẶC ĐỊNH của khung KHÔNG còn 'mai' (chốt 18/09/2026) — khác
    // với hằng R ở trên, vốn là lộ trình tuỳ ý để thử phép cắt.
    expect(resolveComponentRoute(null, 'FRAME')).toEqual(['phoi', 'han', 'nguoi', 'son'])
    expect(routeForGroup('NGU_KIM')).toEqual([])
    expect(routeForGroup(null)).toEqual([])
  })
})

describe('resolveComponentRoute / componentRoute — bậc "lộ trình khai" (0288, B2)', () => {
  it('thứ tự ưu tiên (10/11/2026): khai theo cụm → nhóm đã biết → kế hoạch', () => {
    // Kế hoạch tổ & hạn KHÔNG đè lộ trình cụm đã khai — job phẳng theo dòng SP
    // không nói được "cụm nhôm không hàn".
    expect(
      resolveComponentRoute(['phoi', 'son'], 'FRAME', ['phoi', 'nguoi', 'son']),
    ).toEqual(['phoi', 'nguoi', 'son'])
    // Cụm chưa khai, nhóm đã biết → nhóm; kế hoạch không chen.
    expect(resolveComponentRoute(['phoi', 'son'], 'FRAME', null)).toEqual(
      routeForGroup('FRAME'),
    )
    expect(resolveComponentRoute(['phoi', 'son'], 'FRAME', [])).toEqual(
      routeForGroup('FRAME'),
    )
    expect(resolveComponentRoute(null, 'FRAME', ['phoi', 'nguoi', 'son'])).toEqual([
      'phoi',
      'nguoi',
      'son',
    ])
    expect(resolveComponentRoute(null, 'FRAME', [])).toEqual(routeForGroup('FRAME'))
    expect(resolveComponentRoute(null, 'FRAME', null)).toEqual(routeForGroup('FRAME'))
  })

  it('lộ trình khai trả BẢN SAO — sửa kết quả không chạm mảng gốc', () => {
    const own = ['phoi', 'son']
    const r = resolveComponentRoute(null, 'FRAME', own)
    r.push('x')
    expect(own).toEqual(['phoi', 'son'])
  })

  it('componentRoute: khai rồi vẫn cắt theo first/final (dữ liệu cũ 0088 còn đọc được)', () => {
    expect(
      componentRoute(null, {
        group_code: 'FRAME',
        stages: ['phoi', 'nguoi', 'son'],
        first_stage: 'nguoi',
        final_stage: null,
      }),
    ).toEqual(['nguoi', 'son'])
    // Chưa khai → y hệt cách ghép cũ clipRoute(resolveComponentRoute(...)).
    expect(componentRoute(null, { group_code: 'FRAME', final_stage: 'phoi' })).toEqual([
      'phoi',
    ])
  })
})
