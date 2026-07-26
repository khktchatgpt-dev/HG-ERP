import { describe, expect, it } from 'vitest'
import { buildCopiedParts } from './bom-copy'

const src = [
  {
    id: 'old-1',
    product_id: 'sp-goc',
    created_at: '2026-01-01',
    group_code: 'FRAME',
    part_name: 'Chân',
    section_title: 'Quy cách :',
    unit_basis: '1 ghế',
    qty: 4,
    weight_kg: 1.6747,
    sort_order: 7,
  },
  {
    id: 'old-2',
    product_id: 'sp-goc',
    group_code: 'NGU_KIM',
    part_name: 'Bu lông M6x25',
    qty: 6,
    sort_order: 3,
  },
]

describe('buildCopiedParts', () => {
  it('không mang theo id / product_id / created_at của dòng gốc', () => {
    const out = buildCopiedParts(src, { productId: 'sp-moi' })
    for (const r of out) {
      expect(r.id).toBeUndefined()
      expect(r.created_at).toBeUndefined()
      expect(r.product_id).toBe('sp-moi')
    }
  })

  it('đánh lại sort_order liên tục, không giữ số cũ', () => {
    const out = buildCopiedParts(src, { productId: 'sp-moi' })
    expect(out.map((r) => r.sort_order)).toEqual([1, 2])
  })

  it('chép nối đuôi thì bắt đầu từ số thứ tự được truyền vào', () => {
    const out = buildCopiedParts(src, { productId: 'sp-moi', startOrder: 51 })
    expect(out.map((r) => r.sort_order)).toEqual([51, 52])
  })

  it('giữ nguyên quy cách và thông tin khối', () => {
    const [first] = buildCopiedParts(src, { productId: 'sp-moi' })
    expect(first.part_name).toBe('Chân')
    expect(first.section_title).toBe('Quy cách :')
    expect(first.unit_basis).toBe('1 ghế')
    expect(first.weight_kg).toBeCloseTo(1.6747, 6)
  })

  it('lọc theo nhóm khi được chỉ định', () => {
    const out = buildCopiedParts(src, { productId: 'sp-moi', groups: ['NGU_KIM'] })
    expect(out).toHaveLength(1)
    expect(out[0].part_name).toBe('Bu lông M6x25')
    expect(out[0].sort_order).toBe(1)
  })

  it('danh sách nhóm rỗng nghĩa là chép tất cả, không phải chép không gì', () => {
    expect(buildCopiedParts(src, { productId: 'x', groups: [] })).toHaveLength(2)
  })

  it('nguồn rỗng thì ra mảng rỗng', () => {
    expect(buildCopiedParts([], { productId: 'x' })).toEqual([])
  })
})
