import { describe, expect, it } from 'vitest'
import { inputCellsFor, zonesFor } from './part-layouts'

/**
 * Thẻ sửa dựng từ `zonesFor`, lưới ngang dựng từ `inputCellsFor`. Hai đường phải
 * cùng MỘT bộ ô — lệch một ô là thẻ giấu mất thứ người nhập cần khai, hoặc bày
 * ra thứ biểu mẫu của nhóm đó không có.
 */
const GROUPS = [
  'FRAME',
  'WOOD',
  'POLYWOOD',
  'PANEL',
  'CUSHION',
  'FABRIC',
  'NGU_KIM',
  'PACKAGING',
  'LABEL',
  'ZIPPER',
]

describe('zonesFor — vùng của thẻ sửa', () => {
  it.each(GROUPS)('%s: các vùng gộp lại đúng bằng bộ ô của lưới', (g) => {
    const flat = zonesFor(g).flatMap((z) => z.cells.map((c) => c.key))
    const grid = inputCellsFor(g).map((c) => c.key)
    expect([...flat].sort()).toEqual([...grid].sort())
  })

  it.each(GROUPS)('%s: không ô nào lặp ở hai vùng', (g) => {
    const flat = zonesFor(g).flatMap((z) => z.cells.map((c) => c.key))
    expect(new Set(flat).size).toBe(flat.length)
  })

  it.each(GROUPS)('%s: vùng đầu không nhãn, các vùng sau đều có nhãn', (g) => {
    const zones = zonesFor(g)
    expect(zones[0].label).toBeNull()
    expect(zones.slice(1).every((z) => !!z.label)).toBe(true)
  })

  it('ngũ kim không có vùng tiết diện và không có ô cụm', () => {
    const keys = zonesFor('NGU_KIM').flatMap((z) => z.cells.map((c) => c.key))
    expect(keys).not.toContain('dim_a_mm')
    expect(keys).not.toContain('bar_length_m')
    expect(keys).not.toContain('cluster_name')
  })

  it('khung có đủ vùng "Để cung ứng mua"', () => {
    const zone = zonesFor('FRAME').find((z) => z.label === 'Để cung ứng mua')
    expect(zone?.cells.map((c) => c.key)).toEqual([
      'material_code',
      'profile_code',
      'kg_per_m',
      'bar_length_m',
      'pcs_per_bar',
    ])
  })
})
