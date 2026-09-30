import { describe, expect, it } from 'vitest'
import { duplicateLinePairs, duplicateLinesMessage, poLineDupKey } from './po-line-dup'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

describe('duplicateLinePairs — trùng dòng đơn mua', () => {
  it('cùng cây nhôm, KHÁC chiều dài cắt → không trùng (PO-2026-0114, hộp 25x50 mềm 6 dòng)', () => {
    const lines = [5.1, 5.3, 5.5, 5.8, 5.9, 6].map((len) => ({
      material_id: A,
      spec: 'Hộp 25x50 mềm T1.2',
      bar_length_m: len,
    }))
    expect(duplicateLinePairs(lines)).toEqual([])
  })

  it('cùng mã, cùng quy cách, cùng chiều dài → trùng thật', () => {
    const lines = [
      { material_id: A, spec: 'Hộp 20x40', bar_length_m: 6 },
      { material_id: B, spec: 'x', bar_length_m: 6 },
      { material_id: A, spec: ' hộp  20X40 ', bar_length_m: '6' },
    ]
    expect(duplicateLinePairs(lines)).toEqual([[0, 2]])
  })

  it('cùng mã, cùng chiều dài nhưng KHÁC quy cách → không trùng', () => {
    expect(
      duplicateLinePairs([
        { material_id: A, spec: 'mềm', bar_length_m: 6 },
        { material_id: A, spec: 'cứng', bar_length_m: 6 },
      ]),
    ).toEqual([])
  })

  it('không khai chiều dài (vít, bao bì) cùng mã → vẫn trùng như trước', () => {
    expect(
      duplicateLinePairs([{ material_id: A }, { material_id: A, bar_length_m: '' }]),
    ).toEqual([[0, 1]])
  })

  it('dòng tự do (không vật tư) không xét', () => {
    expect(duplicateLinePairs([{ material_id: null }, { material_id: null }])).toEqual([])
    expect(poLineDupKey({ material_id: null })).toBeNull()
  })

  it('dòng thứ ba trùng thì trỏ về dòng đầu tiên, câu báo đánh số từ 1', () => {
    const pairs = duplicateLinePairs([
      { material_id: A },
      { material_id: A },
      { material_id: A },
    ])
    expect(pairs).toEqual([
      [0, 1],
      [0, 2],
    ])
    expect(duplicateLinesMessage(pairs)).toBe(
      'Dòng 2 trùng dòng 1, Dòng 3 trùng dòng 1: cùng mã, cùng quy cách, cùng chiều dài cây',
    )
    expect(duplicateLinesMessage([])).toBeNull()
  })
})
