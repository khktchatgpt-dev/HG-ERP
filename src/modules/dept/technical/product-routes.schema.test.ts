import { describe, expect, it } from 'vitest'
import { productClusterUpdateSchema, productRoutesSchema } from './technical.schema'

const U = '11111111-1111-4111-8111-111111111111'

describe('productRoutesSchema — lưu lộ trình theo cụm (0288)', () => {
  it('null = về suy theo nhóm; mảng rỗng bị chặn ở biên', () => {
    expect(
      productRoutesSchema.safeParse({ clusters: [{ id: U, stages: null }] }).success,
    ).toBe(true)
    expect(
      productRoutesSchema.safeParse({ clusters: [{ id: U, stages: [] }] }).success,
    ).toBe(false)
    expect(
      productRoutesSchema.safeParse({ parts: [{ id: U, stages: ['phoi', 'son'] }] })
        .success,
    ).toBe(true)
  })

  it('thiếu hai mảng → mặc định rỗng', () => {
    const r = productRoutesSchema.parse({})
    expect(r).toEqual({ clusters: [], parts: [] })
  })

  it('cụm: `stages` đi kèm patch cũ (first/final) không phá nhau', () => {
    expect(
      productClusterUpdateSchema.safeParse({
        stages: ['phoi', 'nguoi', 'son'],
        qty_per_product: 2,
      }).success,
    ).toBe(true)
  })
})
