import { describe, expect, it } from 'vitest'
import { poAdjustSchema } from './pos.schema'

/** Hàng rào biên API của điều chỉnh đơn mua — nguyên nhân + lệnh (0227). */
describe('poAdjustSchema — nguyên nhân', () => {
  const LSX = '0b2c6f3e-9a1d-4c6e-8f7a-2d3b4c5d6e7f'
  const base = {
    base_seq: 0,
    reason: 'Khách giảm 86 bộ sofa',
    lines: [{ material_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', qty_ordered: 10 }],
  }

  it('thiếu nguyên nhân → chặn', () => {
    const r = poAdjustSchema.safeParse(base)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Chọn nguyên nhân điều chỉnh')
  })

  it('nguyên nhân lạ → chặn', () => {
    expect(poAdjustSchema.safeParse({ ...base, cause: 'vui' }).success).toBe(false)
  })

  it('Khách đổi đơn mà không có lệnh → chặn ở lsx_ids', () => {
    const r = poAdjustSchema.safeParse({ ...base, cause: 'khach_doi' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['lsx_ids'])
  })

  it('Khách đổi đơn + lệnh → qua; nguyên nhân khác không cần lệnh', () => {
    expect(
      poAdjustSchema.safeParse({ ...base, cause: 'khach_doi', lsx_ids: [LSX] }).success,
    ).toBe(true)
    const r = poAdjustSchema.safeParse({ ...base, cause: 'ncc_doi' })
    expect(r.success).toBe(true)
    expect(r.data?.lsx_ids).toEqual([])
  })

  it('lệnh phải là uuid', () => {
    expect(
      poAdjustSchema.safeParse({ ...base, cause: 'khach_doi', lsx_ids: ['02/26-27'] })
        .success,
    ).toBe(false)
  })
})
