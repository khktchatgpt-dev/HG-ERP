import { describe, expect, it } from 'vitest'
import { NCC_CHUA_BIET, groupBySupplier, type BangKeRow } from './lsx-bang-ke'

const row = (over: Partial<BangKeRow>): BangKeRow =>
  ({
    material_id: over.material_code ?? 'm',
    material_code: 'X',
    material_name: 'X',
    unit: 'cái',
    group_name: null,
    source: 'bom',
    deviates: false,
    auto_needed: null,
    draft_needed: 0,
    edited_by: null,
    edited_at: null,
    from_products: [],
    incomplete: false,
    qty_needed: 0,
    qty_issued: 0,
    qty_remaining: 0,
    on_hand: 0,
    reserved_others: 0,
    available: 0,
    ordered: 0,
    pending: 0,
    draft: 0,
    received: 0,
    suggest: 0,
    status: 'none',
    note: null,
    pos: [],
    ...over,
  }) as BangKeRow

const gia = (id: string | null, name: string, price: number, cur = 'VND') => ({
  unit_price: price,
  currency: cur,
  supplier_id: id,
  supplier_name: name,
  po_code: 'PO-1',
  at: '2026-09-01T00:00:00.000Z',
})

describe('groupBySupplier', () => {
  it('gom theo NCC lần mua gần nhất, khối chưa biết NCC xuống cuối', () => {
    const out = groupBySupplier([
      row({ material_code: 'A', suggest: 10, last_price: gia('s1', 'Kim Phát', 100) }),
      row({ material_code: 'B', suggest: 5 }), // chưa mua bao giờ
      row({ material_code: 'C', suggest: 7, last_price: gia('s1', 'Kim Phát', 200) }),
      row({ material_code: 'D', suggest: 3, last_price: gia('s2', 'Visa', 50) }),
    ])
    expect(out.map((b) => b.supplier_name)).toEqual(['Kim Phát', 'Visa', NCC_CHUA_BIET])
    expect(out[0].rows.map((r) => r.material_code)).toEqual(['A', 'C'])
  })

  it('bỏ dòng không còn phải đặt', () => {
    const out = groupBySupplier([
      row({ material_code: 'A', suggest: 0, last_price: gia('s1', 'Kim Phát', 100) }),
    ])
    expect(out).toEqual([])
  })

  it('tiền tính theo SỐ ĐẶT (đã cộng hao hụt), tách theo tiền tệ', () => {
    const out = groupBySupplier(
      [
        row({ material_code: 'A', suggest: 100, last_price: gia('s1', 'KP', 1000) }),
        row({
          material_code: 'B',
          suggest: 10,
          last_price: gia('s1', 'KP', 2, 'USD'),
        }),
      ],
      3,
    )
    // 100 cái ×1,03 → 103 (tròn lên) × 1.000 = 103.000 ; 10 → 11 × 2 = 22 USD
    expect(out[0].tien.get('VND')).toBe(103_000)
    expect(out[0].tien.get('USD')).toBe(22)
  })
})
