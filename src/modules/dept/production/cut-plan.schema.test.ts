import { describe, expect, it } from 'vitest'
import { cutPlanDocSchema } from './cut-plan.schema'

const base = {
  title: '',
  item: '',
  spec: '',
  stock_length_mm: 6000,
  lines: [{ key: 1, part_name: 'A', length_mm: 1390.5, qty: 3, note: '' }],
}

describe('cutPlanDocSchema', () => {
  it('chiều dài được số lẻ, số lượng phải nguyên', () => {
    expect(cutPlanDocSchema.safeParse(base).success).toBe(true)
    const bad = { ...base, lines: [{ ...base.lines[0], qty: 2.5 }] }
    expect(cutPlanDocSchema.safeParse(bad).success).toBe(false)
  })
  it('ô trống là chuỗi rỗng, cây tiêu chuẩn phải > 0', () => {
    const blank = {
      ...base,
      lines: [{ key: 1, part_name: '', length_mm: '', qty: '', note: '' }],
    }
    expect(cutPlanDocSchema.safeParse(blank).success).toBe(true)
    expect(cutPlanDocSchema.safeParse({ ...base, stock_length_mm: 0 }).success).toBe(
      false,
    )
  })
})
