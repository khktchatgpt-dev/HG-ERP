import { describe, expect, it } from 'vitest'
import { emptyDraft, num, rowProblems, toDraft, type Draft } from './dinh-hinh.shared'

/** Bảng chi tiết — ô số đọc một luật, sai thì chặn tại chỗ (15/11/2026). */
const dong = (x: Partial<Draft>): Draft => ({ ...emptyDraft('l1'), name: 'Chân', ...x })

describe('Bảng chi tiết — ô số', () => {
  it('số đã lưu mở ra bày phẩy thập phân, lưu lại không đổi (ĐM kg ba số lẻ)', () => {
    const d = toDraft({
      ...emptyDraftRow(),
      dm_kg: 1.125,
      spec_length_mm: 1390,
      qty_per_unit: 4,
    })
    expect(d.dm_kg).toBe('1,125')
    expect(num(d.dm_kg)).toBe(1.125)
    expect(num(d.spec_length_mm)).toBe(1390)
  })

  it('gõ "1.390" ở Dài cắt là 1390, không phải 1,39', () => {
    expect(num('1.390')).toBe(1390)
    expect(rowProblems(dong({ spec_length_mm: '1.390' }))).toEqual([])
  })

  it('chữ trong ô số → lỗi đúng cột, không coi như trống', () => {
    expect(rowProblems(dong({ dm_kg: 'abc' }))).toEqual([
      { key: 'dm_kg', msg: 'ĐM kg "abc" không phải số' },
    ])
    expect(rowProblems(dong({ qty_per_unit: 'hai' }))).toEqual([
      { key: 'qty_per_unit', msg: 'CT/SP "hai" không phải số' },
    ])
  })

  it('số âm bị chặn trước khi bấm Lưu', () => {
    expect(rowProblems(dong({ dm_kg: '-2' }))).toEqual([
      { key: 'dm_kg', msg: 'ĐM kg không được âm' },
    ])
    expect(rowProblems(dong({ spec_width_mm: '-5' }))[0].key).toBe('spec_width_mm')
  })

  it('ô số trống vẫn hợp lệ (trừ CT/SP)', () => {
    expect(rowProblems(dong({ dm_kg: '', spec_length_mm: '' }))).toEqual([])
    expect(rowProblems(dong({ qty_per_unit: '' }))).toEqual([
      { key: 'qty_per_unit', msg: 'CT/SP phải > 0' },
    ])
  })
})

function emptyDraftRow() {
  return {
    production_order_line_id: 'l1',
    kind: 'part' as const,
    cluster: null,
    name: 'Chân',
    group_code: 'FRAME',
    material_id: null,
    material_type: null,
    spec_thickness_mm: null,
    spec_width_mm: null,
    spec_length_mm: null,
    wall_thickness_mm: null,
    unit: 'cái',
    qty_per_unit: 1,
    dm_kg: null,
    pcs_per_bar: null,
    qty_per_assembly: null,
    first_stage: null,
    final_stage: null,
    stages: null,
    note: null,
  }
}
