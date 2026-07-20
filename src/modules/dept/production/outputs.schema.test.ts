import { describe, expect, it } from 'vitest'
import { outputEntrySchema, outputRecordSchema } from './outputs.schema'

const UUID = '00000000-0000-4000-8000-000000000001'

describe('outputEntrySchema — phế > 0 bắt buộc nguyên nhân lỗi (0067)', () => {
  it('phế > 0 thiếu defect_reason → fail đúng path', () => {
    const r = outputEntrySchema.safeParse({ component_id: UUID, qty: 10, defect_qty: 2 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['defect_reason'])
    }
  })

  it('phế > 0 có lý do → pass; phế = 0 không cần lý do → pass', () => {
    expect(
      outputEntrySchema.safeParse({
        component_id: UUID,
        qty: 10,
        defect_qty: 2,
        defect_reason: 'han_nut',
      }).success,
    ).toBe(true)
    expect(
      outputEntrySchema.safeParse({ component_id: UUID, qty: 10, defect_qty: 0 }).success,
    ).toBe(true)
    // defect_qty bỏ trống (default 0) cũng không cần lý do.
    expect(outputEntrySchema.safeParse({ component_id: UUID, qty: 10 }).success).toBe(
      true,
    )
  })
})

describe('outputRecordSchema — lô nhập kèm entry có phế', () => {
  it('lô chứa dòng phế thiếu lý do → fail cả lô', () => {
    const r = outputRecordSchema.safeParse({
      stage: 'han',
      entry_date: '2026-07-20',
      entries: [
        { component_id: UUID, qty: 5 },
        { component_id: UUID, qty: 10, defect_qty: 1 },
      ],
    })
    expect(r.success).toBe(false)
  })
})
