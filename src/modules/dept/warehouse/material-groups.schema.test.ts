import { describe, expect, it } from 'vitest'
import {
  materialGroupCreateSchema,
  materialGroupUpdateSchema,
  materialSubGroupActionSchema,
} from './material-groups.schema'

describe('material-groups schema', () => {
  it('tên nhóm cắt khoảng trắng, chặn rỗng/quá ngắn', () => {
    expect(materialGroupCreateSchema.parse({ name: '  Vật tư điện  ' }).name).toBe(
      'Vật tư điện',
    )
    expect(() => materialGroupCreateSchema.parse({ name: ' ' })).toThrow()
    expect(() => materialGroupCreateSchema.parse({ name: 'A' })).toThrow()
  })

  it('sửa nhóm phải nói đổi gì', () => {
    expect(() => materialGroupUpdateSchema.parse({})).toThrow()
    expect(materialGroupUpdateSchema.parse({ is_active: false }).is_active).toBe(false)
  })

  it('nhóm phụ: rename có from/to, delete có name — không lẫn', () => {
    const r = materialSubGroupActionSchema.parse({
      action: 'rename',
      group_name: 'Sắt thép - inox - nhôm - tôn',
      from: 'Sắt - thép - inox - tôn - nhôm',
      to: 'Sắt - thép - inox - tôn',
    })
    expect(r.action).toBe('rename')
    expect(() =>
      materialSubGroupActionSchema.parse({
        action: 'delete',
        group_name: 'X',
        from: 'a',
      }),
    ).toThrow()
  })
})
