import { describe, expect, it } from 'vitest'
import {
  stageConfigPatchSchema,
  stageCreateSchema,
  stageFieldInputSchema,
} from './stage-config.schema'

const META = {
  count_level: 'cluster',
  core: { defect: 'on', rework: 'off', kg: 'off', worker: 'required' },
  input_from: 'phoi',
}

describe('stageConfigPatchSchema', () => {
  it('patch rỗng hợp lệ (không đổi gì)', () => {
    expect(stageConfigPatchSchema.safeParse({}).success).toBe(true)
  })

  it('meta đúng kiểu đi qua, count_level lạ bị chặn ở biên', () => {
    expect(stageConfigPatchSchema.safeParse({ meta: META }).success).toBe(true)
    expect(
      stageConfigPatchSchema.safeParse({ meta: { ...META, count_level: 'bo' } }).success,
    ).toBe(false)
    expect(
      stageConfigPatchSchema.safeParse({
        meta: { ...META, core: { ...META.core, kg: 'yes' } },
      }).success,
    ).toBe(false)
  })

  it('ô riêng: khoá trùng bị chặn; kiểu chọn phải có lựa chọn; min > max chặn', () => {
    const f = (k: string) => ({ field_key: k, label: k, kind: 'text' })
    expect(stageConfigPatchSchema.safeParse({ fields: [f('a'), f('a')] }).success).toBe(
      false,
    )
    expect(stageConfigPatchSchema.safeParse({ fields: [f('a'), f('b')] }).success).toBe(
      true,
    )
    expect(
      stageFieldInputSchema.safeParse({ field_key: 'tt', label: 'TT', kind: 'select' })
        .success,
    ).toBe(false)
    expect(
      stageFieldInputSchema.safeParse({
        field_key: 'tt',
        label: 'TT',
        kind: 'select',
        options: ['Hàng trần'],
      }).success,
    ).toBe(true)
    expect(
      stageFieldInputSchema.safeParse({
        field_key: 'n',
        label: 'N',
        kind: 'number',
        min_value: 5,
        max_value: 1,
      }).success,
    ).toBe(false)
  })

  it('khoá ô và mã lỗi chỉ chữ thường / số / gạch dưới — khoá đi vào jsonb, bất biến', () => {
    expect(
      stageFieldInputSchema.safeParse({ field_key: 'Máy hàn', label: 'x', kind: 'text' })
        .success,
    ).toBe(false)
    expect(
      stageConfigPatchSchema.safeParse({
        defect_codes: [{ code: 'HAN-NUT', label: 'x' }],
      }).success,
    ).toBe(false)
    expect(
      stageConfigPatchSchema.safeParse({
        defect_codes: [{ code: 'han_nut', label: 'x' }],
      }).success,
    ).toBe(true)
  })

  it('mã lỗi trùng trong một lượt bị chặn', () => {
    const r = stageConfigPatchSchema.safeParse({
      defect_codes: [
        { code: 'a', label: 'A' },
        { code: 'a', label: 'A2' },
      ],
    })
    expect(r.success).toBe(false)
  })
})

describe('stageCreateSchema', () => {
  it('mã mới đúng quy tắc, nhãn bắt buộc', () => {
    expect(stageCreateSchema.safeParse({ code: 'qc', label: 'Kiểm tra' }).success).toBe(
      true,
    )
    expect(stageCreateSchema.safeParse({ code: 'QC', label: 'Kiểm tra' }).success).toBe(
      false,
    )
    expect(stageCreateSchema.safeParse({ code: 'qc', label: '  ' }).success).toBe(false)
  })
})
