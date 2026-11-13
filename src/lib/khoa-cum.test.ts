import { describe, expect, it } from 'vitest'
import { khoaCum } from './khoa-cum'

describe('khoaCum', () => {
  it('không phân biệt hoa thường, gọn khoảng trắng', () => {
    expect(khoaCum('Cụm tựa')).toBe(khoaCum('  cụm   tựa '))
    expect(khoaCum('Cụm mê')).not.toBe(khoaCum('Cụm tựa'))
  })
  it('null / rỗng → chuỗi rỗng', () => {
    expect(khoaCum(null)).toBe('')
    expect(khoaCum(undefined)).toBe('')
  })
})
