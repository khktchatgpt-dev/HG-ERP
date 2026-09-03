import { describe, expect, it } from 'vitest'
import { materialRegroupSchema } from './warehouse.schema'

/**
 * Đổi nhóm hàng loạt (03/09/2026): payload phải nói ĐỔI CÁI GÌ. Gửi rỗng cả hai
 * là một lệnh update không làm gì nhưng vẫn đẻ vết — chặn ở biên.
 */
describe('materialRegroupSchema', () => {
  const ids = ['3f4b2a2e-6c4c-4c1b-9a3e-1f2d3c4b5a6e']

  it('đổi nhóm chính, nhóm phụ về trống (đổi nhóm là nhóm phụ cũ hết nghĩa)', () => {
    const r = materialRegroupSchema.parse({
      ids,
      group_name: 'Sắt thép - inox - nhôm - tôn',
    })
    expect(r.group_name).toBe('Sắt thép - inox - nhôm - tôn')
    expect(r.sub_group).toBeUndefined()
  })

  it('chỉ đổi nhóm phụ, kể cả xoá nhóm phụ (null)', () => {
    expect(
      materialRegroupSchema.parse({ ids, sub_group: 'Nhôm - thanh & tấm' }).sub_group,
    ).toBe('Nhôm - thanh & tấm')
    expect(materialRegroupSchema.parse({ ids, sub_group: null }).sub_group).toBeNull()
  })

  it('không nói đổi gì → từ chối', () => {
    expect(() => materialRegroupSchema.parse({ ids })).toThrow()
  })

  it('cắt khoảng trắng; nhóm chính trống coi như không gửi', () => {
    const r = materialRegroupSchema.parse({ ids, group_name: '  ', sub_group: ' Vít ' })
    expect(r.group_name).toBeUndefined()
    expect(r.sub_group).toBe('Vít')
  })

  it('tối đa 500 mã một lượt, tối thiểu 1', () => {
    expect(() => materialRegroupSchema.parse({ ids: [], sub_group: 'x' })).toThrow()
    expect(() =>
      materialRegroupSchema.parse({ ids: Array(501).fill(ids[0]), sub_group: 'x' }),
    ).toThrow()
  })
})
