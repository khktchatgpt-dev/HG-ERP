import { describe, it, expect } from 'vitest'
import { describeSyncItem, diffLsxAgainstOrders, isAutoApplicable } from './lsx-sync'

const groups = [
  {
    id: 'g1',
    sales_order_id: 'o1',
    lines: [
      { id: 'l1', product_id: 'p1', product_code: 'SP1', qty: 100 },
      { id: 'l2', product_id: 'p2', product_code: 'SP2', qty: 60 },
      { id: 'l3', product_id: 'p2', product_code: 'SP2', qty: 40 }, // SP2 tách hai đợt
      { id: 'l4', product_id: 'p3', product_code: 'SP3', qty: 5 },
    ],
  },
  {
    id: 'g2',
    sales_order_id: null,
    lines: [{ id: 'l9', product_id: 'p9', product_code: 'SP9', qty: 1 }],
  },
]

describe('diffLsxAgainstOrders — so dòng đơn với dòng lệnh theo nhóm', () => {
  it('khớp hoàn toàn → không việc', () => {
    const don = new Map([
      [
        'o1',
        [
          { product_id: 'p1', product_code: 'SP1', qty: 100 },
          { product_id: 'p2', product_code: 'SP2', qty: 100 },
          { product_id: 'p3', product_code: 'SP3', qty: 5 },
        ],
      ],
    ])
    expect(diffLsxAgainstOrders(groups, don)).toEqual([])
  })

  it('đơn tăng SL dòng đơn lẻ → qty; đơn thêm SP → add; đơn bỏ SP → remove', () => {
    const don = new Map([
      [
        'o1',
        [
          { product_id: 'p1', product_code: 'SP1', qty: 120 },
          { product_id: 'p2', product_code: 'SP2', qty: 100 },
          { product_id: 'p4', product_code: 'SP4', qty: 7 },
        ],
      ],
    ])
    const out = diffLsxAgainstOrders(groups, don)
    expect(out).toContainEqual({
      kind: 'qty',
      group_id: 'g1',
      line_id: 'l1',
      product_code: 'SP1',
      from: 100,
      to: 120,
    })
    expect(out).toContainEqual({
      kind: 'add',
      group_id: 'g1',
      product_id: 'p4',
      product_code: 'SP4',
      qty: 7,
    })
    expect(out).toContainEqual({
      kind: 'remove',
      group_id: 'g1',
      line_id: 'l4',
      product_code: 'SP3',
      qty: 5,
    })
  })

  it('SP tách nhiều đợt mà Σ lệch đơn → split (không tự chia), không áp tự động', () => {
    const don = new Map([
      [
        'o1',
        [
          { product_id: 'p1', product_code: 'SP1', qty: 100 },
          { product_id: 'p2', product_code: 'SP2', qty: 90 },
          { product_id: 'p3', product_code: 'SP3', qty: 5 },
        ],
      ],
    ])
    const out = diffLsxAgainstOrders(groups, don)
    expect(out).toEqual([
      { kind: 'split', group_id: 'g1', product_code: 'SP2', lines: 2, from: 100, to: 90 },
    ])
    expect(isAutoApplicable(out[0])).toBe(false)
    expect(describeSyncItem(out[0])).toContain('chỉnh tay')
  })

  it('đơn gộp một SP thành hai dòng (D2) → so theo Σ', () => {
    const don = new Map([
      [
        'o1',
        [
          { product_id: 'p1', product_code: 'SP1', qty: 60 },
          { product_id: 'p1', product_code: 'SP1', qty: 40 },
          { product_id: 'p2', product_code: 'SP2', qty: 100 },
          { product_id: 'p3', product_code: 'SP3', qty: 5 },
        ],
      ],
    ])
    expect(diffLsxAgainstOrders(groups, don)).toEqual([])
  })

  it('nhóm không gắn đơn / đơn không có trong map → bỏ qua', () => {
    expect(diffLsxAgainstOrders(groups, new Map())).toEqual([])
  })
})
