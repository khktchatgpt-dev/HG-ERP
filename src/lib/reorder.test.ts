import { describe, it, expect } from 'vitest'
import { computeReorder, type ReorderInput } from './reorder'

const base = (over: Partial<ReorderInput>): ReorderInput => ({
  material_id: 'm1',
  code: 'VT-01',
  name: 'Ốc vít',
  unit: 'hộp',
  min_stock: 0,
  max_stock: null,
  reorder_point: null,
  reorder_qty: null,
  available: 0,
  ordered: 0,
  pending: 0,
  default_supplier_id: null,
  ...over,
})

describe('computeReorder — mua bù tồn (min-max / reorder point)', () => {
  it('không có ngưỡng (min=0, không reorder_point) → bỏ qua', () => {
    expect(computeReorder([base({ available: 0 })])).toHaveLength(0)
  })

  it('fallback min_stock làm ngưỡng; bù về đúng ngưỡng khi không có lô/max', () => {
    const [r] = computeReorder([base({ min_stock: 20, available: 8 })])
    expect(r.threshold).toBe(20)
    expect(r.suggest).toBe(12) // 20 − 8
  })

  it('reorder_point thắng min_stock; reorder_qty là lô đặt cố định', () => {
    const [r] = computeReorder([
      base({ min_stock: 5, reorder_point: 30, reorder_qty: 50, available: 10 }),
    ])
    expect(r.threshold).toBe(30)
    expect(r.suggest).toBe(50)
  })

  it('hàng đang về (ordered) cộng vào vị thế — đủ rồi thì KHÔNG đề xuất (chống đặt trùng)', () => {
    expect(
      computeReorder([base({ min_stock: 20, available: 8, ordered: 15 })]),
    ).toHaveLength(0)
  })

  it('bù tới max_stock khi có; PO chờ duyệt chỉ giơ cờ, không trừ vị thế', () => {
    const [r] = computeReorder([
      base({ min_stock: 20, max_stock: 100, available: 5, ordered: 5, pending: 30 }),
    ])
    expect(r.suggest).toBe(90) // 100 − (5+5)
    expect(r.has_pending).toBe(true)
  })

  it('available âm (thiếu cho LSX) vẫn tính đúng và xếp lên đầu', () => {
    const rows = computeReorder([
      base({ material_id: 'nhe', min_stock: 10, available: 9 }),
      base({ material_id: 'nang', min_stock: 10, available: -5 }),
    ])
    expect(rows[0].material_id).toBe('nang')
    expect(rows[0].suggest).toBe(15) // 10 − (−5)
  })
})
