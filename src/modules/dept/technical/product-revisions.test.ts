import { describe, it, expect } from 'vitest'
import { diffFields, snapshotFields, snapshotParts } from './product-revisions.repo'
import type { Product, ProductPart } from './technical.repo'

/**
 * Lịch sử phiên bản (0143) chỉ đáng tin nếu dòng "so với bản trước đã đổi gì"
 * nói đúng — người đọc dựa vào đó để biết có phải đi mua lại vật tư không.
 */

const product = (over: Partial<Product> = {}) =>
  ({
    id: 'p1',
    code: 'TB0272HG-IR',
    name: 'Bàn',
    length_mm: 1200,
    packing: { loading_40hc: 100 },
    tech_spec: {},
    bom_rev: 2,
    locked_at: '2026-08-13T00:00:00Z',
    updated_at: '2026-08-13T00:00:00Z',
    ...over,
  }) as unknown as Product

const part = (over: Partial<ProductPart> = {}) =>
  ({
    part_no: 1,
    part_name: 'Chân bàn',
    group_code: 'A',
    material_code: 'VT-001',
    qty: 4,
    unit: 'cây',
    weight_kg: 1.2,
    sort_order: 1,
    ...over,
  }) as unknown as ProductPart

describe('snapshotFields', () => {
  it('chụp trường nội dung, BỎ cột kiểm soát (locked_at/updated_at)', () => {
    const snap = snapshotFields(product())
    expect(snap.code).toBe('TB0272HG-IR')
    expect(snap.length_mm).toBe(1200)
    // Cột này đổi ở MỌI nhịp khoá — chụp vào thì lần nào cũng báo "có đổi".
    expect(snap).not.toHaveProperty('locked_at')
    expect(snap).not.toHaveProperty('updated_at')
  })
})

describe('diffFields', () => {
  it('bản chốt ĐẦU TIÊN không có gì để so → rỗng', () => {
    expect(diffFields(null, snapshotFields(product()), false)).toEqual([])
  })

  it('không đổi gì → rỗng', () => {
    const before = snapshotFields(product())
    expect(diffFields(before, snapshotFields(product()), false)).toEqual([])
  })

  it('bắt được trường phẳng đổi', () => {
    const before = snapshotFields(product())
    const after = snapshotFields(product({ length_mm: 1400 }))
    expect(diffFields(before, after, false)).toEqual(['length_mm'])
  })

  it('bắt được jsonb lồng nhau đổi (packing / tech_spec)', () => {
    const before = snapshotFields(product())
    const after = snapshotFields(product({ packing: { loading_40hc: 120 } as never }))
    expect(diffFields(before, after, false)).toEqual(['packing'])
  })

  it('null và undefined coi như MỘT — khỏi báo đổi oan', () => {
    const before = snapshotFields(product({ hs_code: null }))
    const after = snapshotFields(product({ hs_code: undefined as never }))
    expect(diffFields(before, after, false)).toEqual([])
  })

  it('định mức đổi thì thêm khoá ảo "parts"', () => {
    const before = snapshotFields(product())
    expect(diffFields(before, snapshotFields(product()), true)).toEqual(['parts'])
  })
})

describe('snapshotParts', () => {
  it('giữ đúng phần cần đối chiếu sau này, không kéo cả 40 cột hình học', () => {
    const snap = snapshotParts([part({ dim_a_mm: 30 } as never)])
    expect(snap).toEqual([
      {
        part_no: 1,
        part_name: 'Chân bàn',
        group_code: 'A',
        material_code: 'VT-001',
        qty: 4,
        unit: 'cây',
        weight_kg: 1.2,
      },
    ])
  })

  it('đổi SỐ LƯỢNG định mức thì ảnh chụp khác nhau (nguồn của cờ partsChanged)', () => {
    const a = JSON.stringify(snapshotParts([part()]))
    const b = JSON.stringify(snapshotParts([part({ qty: 6 })]))
    expect(a).not.toBe(b)
  })
})
