import { describe, expect, it } from 'vitest'
import { bangCongQuerySchema, keoSchema } from './cham-cong.schema'

describe('keoSchema', () => {
  it('nhận khoảng ngày ISO', () => {
    expect(keoSchema.safeParse({ tu: '2026-09-01', den: '2026-09-07' }).success).toBe(
      true,
    )
    expect(keoSchema.safeParse({ tu: '2026-09-07', den: '2026-09-07' }).success).toBe(
      true,
    )
  })
  it('chặn ngày sai dạng, đến trước từ, quá 1 năm', () => {
    expect(keoSchema.safeParse({ tu: '01/09/2026', den: '2026-09-07' }).success).toBe(
      false,
    )
    expect(keoSchema.safeParse({ tu: '2026-09-07', den: '2026-09-01' }).success).toBe(
      false,
    )
    expect(keoSchema.safeParse({ tu: '2025-01-01', den: '2026-09-01' }).success).toBe(
      false,
    )
  })
})

describe('bangCongQuerySchema', () => {
  it('chỉ nhận YYYY-MM', () => {
    expect(bangCongQuerySchema.safeParse({ thang: '2026-09' }).success).toBe(true)
    expect(bangCongQuerySchema.safeParse({ thang: '2026-13' }).success).toBe(false)
  })
})
