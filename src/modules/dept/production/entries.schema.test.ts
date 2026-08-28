import { describe, it, expect } from 'vitest'
import { entryLineSchema } from './entries.schema'

/**
 * Luật dòng sổ (0173): dòng phải có SL đạt HOẶC phế (không dòng rỗng);
 * phế > 0 bắt buộc lý do. qty = 0 hợp lệ khi CHỈ báo phế lô cũ.
 */
describe('entryLineSchema', () => {
  const base = { component_id: '5f0e8db4-6f65-4f5e-9c8b-1a2b3c4d5e6f' }

  it('dòng thường: qty > 0 → hợp lệ', () => {
    const r = entryLineSchema.safeParse({ ...base, qty: 30 })
    expect(r.success).toBe(true)
  })

  it('dòng CHỈ CÓ PHẾ: qty 0 + defect + lý do → hợp lệ', () => {
    const r = entryLineSchema.safeParse({
      ...base,
      qty: 0,
      defect_qty: 3,
      defect_reason: 'móp cạnh',
    })
    expect(r.success).toBe(true)
  })

  it('dòng rỗng (qty 0, phế 0) → từ chối', () => {
    const r = entryLineSchema.safeParse({ ...base, qty: 0, defect_qty: 0 })
    expect(r.success).toBe(false)
  })

  it('qty âm → từ chối', () => {
    const r = entryLineSchema.safeParse({ ...base, qty: -1, defect_qty: 2 })
    expect(r.success).toBe(false)
  })

  it('phế > 0 mà thiếu lý do → từ chối', () => {
    const r = entryLineSchema.safeParse({ ...base, qty: 10, defect_qty: 2 })
    expect(r.success).toBe(false)
  })

  it('id ảo cụm mặc nhiên default-asm:<uuid> → hợp lệ (27/08)', () => {
    const r = entryLineSchema.safeParse({
      component_id: 'default-asm:5f0e8db4-6f65-4f5e-9c8b-1a2b3c4d5e6f',
      qty: 12,
    })
    expect(r.success).toBe(true)
  })

  it('id không phải uuid / tiền tố lạ → từ chối', () => {
    expect(entryLineSchema.safeParse({ component_id: 'abc', qty: 1 }).success).toBe(false)
    expect(
      entryLineSchema.safeParse({
        component_id: 'khac:5f0e8db4-6f65-4f5e-9c8b-1a2b3c4d5e6f',
        qty: 1,
      }).success,
    ).toBe(false)
  })
})
