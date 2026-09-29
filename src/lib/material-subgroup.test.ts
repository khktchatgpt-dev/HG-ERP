import { describe, expect, it } from 'vitest'
import { regroupPreview, similarSubs, subKey } from './material-subgroup'

const DIEN = [
  'Dây cáp & phụ kiện điện',
  'Đèn chiếu sáng',
  'Ắc quy - pin',
  'Thiết bị điện - đóng cắt',
]

describe('similarSubs — ca thật 29/09', () => {
  it('“Đèn - chiếu sáng” trùng khoá với “Đèn chiếu sáng”', () => {
    expect(subKey('Đèn - chiếu sáng')).toBe(subKey('Đèn chiếu sáng'))
    expect(similarSubs('Đèn - chiếu sáng', DIEN)).toEqual(['Đèn chiếu sáng'])
  })
  it('“Ắc quy” nằm gọn trong “Ắc quy - pin”', () => {
    expect(similarSubs('Ắc quy', DIEN)).toEqual(['Ắc quy - pin'])
  })
  it('chọn lại đúng nhãn cũ thì không báo', () => {
    expect(similarSubs('Đèn chiếu sáng', DIEN)).toEqual([])
  })
  it('nhãn mới khác hẳn thì không báo; quá ngắn không so', () => {
    expect(similarSubs('Cầu dao chống giật', DIEN)).toEqual([])
    expect(similarSubs('Đ', DIEN)).toEqual([])
  })
})

describe('regroupPreview', () => {
  const G = 'Sắt thép - tôn - tấm'
  const counts: Record<string, number> = {
    [`${G}|`]: 392,
    [`${G}|Tôn - thép tấm - thép lá`]: 48,
    'Inox|': 5,
  }
  const count = (p: { group: string | null; sub: string | null }) =>
    counts[`${p.group}|${p.sub ?? ''}`] ?? 0
  const four = Array.from({ length: 4 }, () => ({ group: G, sub: null }))

  it('artboard 17: 4 thép tấm vào “Tôn - thép tấm - thép lá” → 48→52, trống 392→388', () => {
    expect(regroupPreview(four, { sub: 'Tôn - thép tấm - thép lá' }, count)).toEqual([
      { group: G, sub: 'Tôn - thép tấm - thép lá', before: 48, after: 52 },
      { group: G, sub: null, before: 392, after: 388 },
    ])
  })
  it('đổi nhóm chính không kèm nhóm con → về TRỐNG ở nhóm mới (luật server)', () => {
    const r = regroupPreview(
      [{ group: G, sub: 'Tôn - thép tấm - thép lá' }],
      { group: 'Inox' },
      count,
    )
    expect(r).toContainEqual({ group: 'Inox', sub: null, before: 5, after: 6 })
    expect(r).toContainEqual({
      group: G,
      sub: 'Tôn - thép tấm - thép lá',
      before: 48,
      after: 47,
    })
  })
  it('mã đã đúng chỗ thì không tính', () => {
    expect(regroupPreview([{ group: G, sub: 'X' }], { sub: 'X' }, count)).toEqual([])
  })
})
