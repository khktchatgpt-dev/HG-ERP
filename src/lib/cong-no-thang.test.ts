import { describe, expect, it } from 'vitest'
import type { ReceiptMove } from './ap-receipt-ledger'
import {
  monthRows,
  monthTotals,
  monthsWithDocs,
  supplierSheet,
  toDocs,
} from './cong-no-thang'

let seq = 0
const mv = (o: Partial<ReceiptMove> = {}): ReceiptMove => ({
  move_id: String(++seq).padStart(4, '0'),
  item_name: 'Eru 10, xi trắng',
  item_unit: 'Con',
  lsx_code: '06/26-27 - MX',
  qty: 7457,
  unit_cost: 350,
  direction: 'in',
  doc_id: 'd64',
  doc_code: 'PNK-2026-0064',
  doc_date: '2026-10-02',
  supplier_doc_no: null,
  is_reversal: false,
  po_id: 'p41',
  po_code: 'PO-2026-0041',
  currency: 'VND',
  supplier_id: 'mt',
  supplier_name: 'Minh Thắng',
  vat_rate: 8,
  price_includes_vat: false,
  terms_payment: null,
  supplier_net_days: null,
  ...o,
})

describe('toDocs — phiếu × đơn, tiền theo dòng', () => {
  it('gộp dòng cùng phiếu, VAT theo dòng, tổng phiếu = tổng dòng', () => {
    const [d] = toDocs([mv(), mv({ item_name: 'Long đền chẻ lỗ 10', unit_cost: 130 })])
    expect(d.lines).toHaveLength(2)
    expect(d.lines[0]).toEqual({ name: 'Eru 10, xi trắng', unit: 'Con', qty: 7457, price: 350, net: 2_609_950, vat: 208_796, amount: 2_818_746 }) // prettier-ignore
    expect(d.net).toBe(2_609_950 + 969_410)
    expect(d.amount).toBe(2_818_746 + 1_046_962.8)
    expect(d).toMatchObject({
      kind: 'in',
      supplier_id: 'mt',
      currency: 'VND',
      unpriced: 0,
    })
  })

  it('phiếu đảo: số ÂM, ghi phiếu gốc', () => {
    const [d] = toDocs(
      [mv({ direction: 'out', is_reversal: true, doc_id: 'x5', doc_code: 'PXK-2026-0005', doc_date: '2026-10-01', qty: 7457.2 })], // prettier-ignore
      new Map([['x5', { code: 'PNK-2026-0026', date: '2026-09-11' }]]),
    )
    expect(d.kind).toBe('reversal')
    expect(d.reversal_of).toEqual({ code: 'PNK-2026-0026', date: '2026-09-11' })
    expect(d.lines[0].qty).toBe(-7457.2)
    expect(d.amount).toBeLessThan(0)
  })

  it('dòng chưa có giá VẪN HIỆN, không cộng, được đếm', () => {
    const [d] = toDocs([mv(), mv({ unit_cost: null, item_name: 'Hộp trượt' })])
    expect(d.lines[1]).toMatchObject({ name: 'Hộp trượt', price: null, amount: null })
    expect(d.amount).toBe(2_818_746)
    expect(d.unpriced).toBe(1)
  })

  it('xếp theo ngày tăng dần trong sổ', () => {
    const docs = toDocs([mv({ doc_id: 'b', doc_code: 'PNK-B', doc_date: '2026-10-09' }), mv({ doc_id: 'a', doc_code: 'PNK-A', doc_date: '2026-10-02' })]) // prettier-ignore
    expect(docs.map((d) => d.doc_code)).toEqual(['PNK-A', 'PNK-B'])
  })
})

describe('Màn 1 — monthRows / monthTotals', () => {
  const moves = [
    mv(), // MT tháng 10: 2.818.746
    mv({
      direction: 'out',
      is_reversal: true,
      doc_id: 'x5',
      doc_code: 'PXK-2026-0005',
      doc_date: '2026-10-01',
      qty: 1000,
    }), // −378.000 // prettier-ignore
    mv({ doc_id: 'd26', doc_code: 'PNK-2026-0026', doc_date: '2026-09-11' }), // tháng 9 — không tính
    mv({ supplier_id: 'dg', supplier_name: 'Nhôm Đoàn Gia', doc_id: 'd90', doc_code: 'PNK-2026-0090', vat_rate: 0, qty: 1, unit_cost: 490_856_123 }), // prettier-ignore
    mv({ supplier_id: 'td', supplier_name: 'Thành Đạt', currency: 'USD', doc_id: 'u1', doc_code: 'PNK-2026-0101', qty: 100, unit_cost: 2.5 }), // prettier-ignore
  ]
  const rows = monthRows(toDocs(moves), '2026-10')

  it('mỗi NCC × tiền tệ một dòng, chỉ phiếu trong tháng, trừ phiếu đảo', () => {
    const mt = rows.find((r) => r.supplier_id === 'mt')!
    expect(mt.docs).toBe(2)
    expect(mt.amount).toBe(2_818_746 - 378_000)
  })

  it('VND trước, tổng cộng giảm dần, USD cuối', () => {
    expect(rows.map((r) => r.supplier_id)).toEqual(['dg', 'mt', 'td'])
  })

  it('tổng theo từng tiền tệ, không cộng lẫn', () => {
    const t = monthTotals(rows)
    expect(t.find((x) => x.currency === 'VND')).toMatchObject({ suppliers: 2, docs: 3, amount: 490_856_123 + 2_440_746 }) // prettier-ignore
    expect(t.find((x) => x.currency === 'USD')).toMatchObject({
      suppliers: 1,
      amount: 270,
    })
  })

  it('các tháng có phiếu, mới nhất trước', () => {
    expect(monthsWithDocs(moves)).toEqual([
      { month: '2026-10', docs: 4 },
      { month: '2026-09', docs: 1 },
    ])
  })
})

describe('Màn 2 — supplierSheet', () => {
  it('tháng mới nhất trước, mỗi tháng chốt tổng', () => {
    const sheet = supplierSheet(
      toDocs([mv({ doc_id: 'd26', doc_code: 'PNK-2026-0026', doc_date: '2026-09-11' }), mv(), mv({ unit_cost: null })]), // prettier-ignore
    )
    expect(sheet.map((m) => m.month)).toEqual(['2026-10', '2026-09'])
    expect(sheet[0]).toMatchObject({ amount: 2_818_746, unpriced: 1 })
    expect(sheet[1].amount).toBe(2_818_746)
  })
})
