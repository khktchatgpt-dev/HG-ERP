import { describe, expect, it } from 'vitest'
import { laiLoBoard, mergeQuy, type LaiLoPlan, type LaiLoPo } from './lai-lo'

const LSX = { id: 'L1', code: '01/26-27 - X', status: 'in_progress', customer_name: 'X' }
const P = (
  id: string,
  direct: number,
  overhead: number,
  profit: number,
  currency = 'USD',
): LaiLoPlan => ({ product_id: id, direct, overhead, profit, price: direct + overhead + profit, currency }) // prettier-ignore
const PO = (over: Partial<LaiLoPo>): LaiLoPo => ({
  id: 'po',
  code: 'PO',
  lsx_id: 'L1',
  supplier_id: 's1',
  supplier_name: 'NCC 1',
  currency: 'VND',
  fx_rate: null,
  status: 'approved',
  amount: 0,
  ...over,
})

describe('laiLoBoard — một lệnh đủ số', () => {
  const base = {
    lsx: [LSX],
    lsxLines: [
      { lsx_id: 'L1', product_id: 'a', product_code: 'A', qty: 100 },
      { lsx_id: 'L1', product_id: 'a', product_code: 'A', qty: 50 }, // cùng SP, hai dòng
      { lsx_id: 'L1', product_id: 'b', product_code: 'B', qty: 10 },
    ],
    plans: [P('a', 60, 10, 10), P('b', 100, 20, 30)],
    orders: [{ id: 'o1', code: 'SO1', lsx_id: 'L1', currency: 'USD', fx_rate: 25000 }],
    orderLines: [
      { order_id: 'o1', product_id: 'a', qty: 150, unit_price: 80 },
      { order_id: 'o1', product_id: 'b', qty: 10, unit_price: 150 },
    ],
    pos: [
      PO({ id: 'p1', amount: 200_000_000 }),
      PO({ id: 'p2', amount: 1000, currency: 'USD', fx_rate: 25400, status: 'draft', supplier_id: 's2', supplier_name: 'NCC 2' }), // prettier-ignore
    ],
  }

  it('gộp SP, tính ba vế kế hoạch và doanh thu đơn theo tỷ giá chốt', () => {
    const { rows } = laiLoBoard(base)
    const r = rows[0]
    expect(r.product_count).toBe(2)
    expect(r.qty_total).toBe(160)
    // Giá thành KH = 150×70 + 10×120 = 11.700 USD × 25.000
    expect(r.plan_cost).toEqual({ vnd: 292_500_000, missing: [] })
    // Lợi nhuận KH = 150×10 + 10×30 = 1.800 USD
    expect(r.plan_profit).toEqual({ vnd: 45_000_000, missing: [] })
    // Doanh thu đơn = 150×80 + 10×150 = 13.500 USD
    expect(r.revenue).toEqual({ vnd: 337_500_000, missing: [] })
    expect(r.revenue_source).toBe('order')
    expect(r.priced_lines).toBe(2)
  })

  it('cam kết mua quy theo tỷ giá CHỐT TỪNG ĐƠN, tách phần nháp', () => {
    const r = laiLoBoard(base).rows[0]
    expect(r.committed).toEqual({ vnd: 225_400_000, missing: [] })
    expect(r.committed_draft).toBe(25_400_000)
    expect(r.suppliers.map((s) => [s.name, s.vnd, s.has_draft])).toEqual([
      ['NCC 1', 200_000_000, false],
      ['NCC 2', 25_400_000, true],
    ])
  })

  it('kết luận theo ngưỡng của chính lệnh: biên dưới lợi nhuận KH → ăn vào lợi nhuận', () => {
    const r = laiLoBoard(base).rows[0]
    expect(r.ratio_pct).toBe(77.1) // 225,4 / 292,5
    expect(r.margin).toBe(112_100_000) // 337,5 − 225,4
    // 112,1 tr > LN KH 45 tr → trong kế hoạch
    expect(r.verdict).toBe('on')
    expect(r.missing).toEqual([])
  })

  it('mua vượt giá thành KH là đỏ dù doanh thu còn cao hơn', () => {
    const r = laiLoBoard({
      ...base,
      pos: [PO({ id: 'p1', amount: 300_000_000 })],
    }).rows[0]
    expect(r.ratio_pct).toBe(102.6)
    expect(r.margin).toBe(37_500_000)
    expect(r.verdict).toBe('lo')
  })

  it('biên dương nhưng dưới lợi nhuận KH → ăn vào lợi nhuận (bán rẻ hơn báo giá)', () => {
    // Bán 70 USD thay vì FOB KH 80 → doanh thu 12.000 USD = 300 tr; mua 292 tr → biên 8 tr < LN KH 45 tr
    const r = laiLoBoard({
      ...base,
      orderLines: [
        { order_id: 'o1', product_id: 'a', qty: 150, unit_price: 70 },
        { order_id: 'o1', product_id: 'b', qty: 10, unit_price: 150 },
      ],
      pos: [PO({ id: 'p1', amount: 292_000_000 })],
    }).rows[0]
    expect(r.ratio_pct).toBe(99.8)
    expect(r.margin).toBe(8_000_000)
    expect(r.verdict).toBe('an_lai')
  })
})

describe('laiLoBoard — thiếu số thì KHÔNG ra số', () => {
  const lines = [
    { lsx_id: 'L1', product_id: 'a', product_code: 'A', qty: 100 },
    { lsx_id: 'L1', product_id: 'b', product_code: 'B', qty: 10 },
  ]

  it('một SP chưa có giá thành → cả ba vế kế hoạch null, nói thiếu mấy SP', () => {
    const r = laiLoBoard({
      lsx: [LSX],
      lsxLines: lines,
      plans: [P('a', 60, 10, 10)],
      orders: [],
      orderLines: [],
      pos: [],
    }).rows[0]
    expect(r.plan_cost).toBeNull()
    expect(r.revenue).toBeNull()
    expect(r.verdict).toBe('thieu')
    expect(r.missing.map((m) => m.kind)).toEqual(['plan', 'order'])
    expect(r.missing[0].text).toBe('1/2 SP chưa có giá thành kế hoạch')
  })

  it('SP chưa gắn hồ sơ (product_id null) vẫn đếm là SP chưa có giá thành', () => {
    const r = laiLoBoard({
      lsx: [LSX],
      lsxLines: [{ lsx_id: 'L1', product_id: null, product_code: 'Z', qty: 5 }],
      plans: [],
      orders: [],
      orderLines: [],
      pos: [],
    }).rows[0]
    expect(r.product_count).toBe(1)
    expect(r.planned_products).toBe(0)
  })

  it('đơn bán chưa có giá → doanh thu tạm theo FOB kế hoạch, ghi nguồn "plan"', () => {
    const r = laiLoBoard({
      lsx: [LSX],
      lsxLines: lines,
      plans: [P('a', 60, 10, 10), P('b', 100, 20, 30)],
      orders: [{ id: 'o1', code: 'SO1', lsx_id: 'L1', currency: 'USD', fx_rate: 25000 }],
      orderLines: [{ order_id: 'o1', product_id: 'a', qty: 100, unit_price: 0 }],
      pos: [PO({ id: 'p1', amount: 100_000_000 })],
    }).rows[0]
    // 100×80 + 10×150 = 9.500 USD
    expect(r.revenue).toEqual({ vnd: 237_500_000, missing: [] })
    expect(r.revenue_source).toBe('plan')
    expect(r.missing[0]).toMatchObject({ kind: 'price' })
    expect(r.verdict).toBe('on')
  })

  it('lệnh không có đơn bán → kế hoạch USD không quy được (không có tỷ giá của lệnh)', () => {
    const r = laiLoBoard({
      lsx: [LSX],
      lsxLines: lines,
      plans: [P('a', 60, 10, 10), P('b', 100, 20, 30)],
      orders: [],
      orderLines: [],
      pos: [],
    }).rows[0]
    expect(r.plan_cost).toEqual({ vnd: 0, missing: [{ currency: 'USD', amount: 8200 }] })
    expect(r.ratio_pct).toBeNull()
    expect(r.verdict).toBe('thieu')
  })

  it('đơn mua USD chưa tỷ giá → nằm ở missing, KHÔNG cộng vào tổng, không kết luận', () => {
    const { rows, totals } = laiLoBoard({
      lsx: [LSX],
      lsxLines: lines,
      plans: [P('a', 60, 10, 10), P('b', 100, 20, 30)],
      orders: [{ id: 'o1', code: 'SO1', lsx_id: 'L1', currency: 'USD', fx_rate: 25000 }],
      orderLines: [{ order_id: 'o1', product_id: 'a', qty: 100, unit_price: 80 }],
      pos: [
        PO({ id: 'p1', amount: 100_000_000 }),
        PO({ id: 'p2', amount: 2000, currency: 'USD', fx_rate: null }),
      ],
    })
    const r = rows[0]
    expect(r.committed).toEqual({
      vnd: 100_000_000,
      missing: [{ currency: 'USD', amount: 2000 }],
    })
    expect(r.po_missing_fx).toBe(1)
    expect(r.margin).toBeNull()
    expect(r.verdict).toBe('thieu')
    expect(r.missing.map((m) => m.kind)).toEqual(['po_fx'])
    expect(r.suppliers[1].vnd).toBeNull()
    expect(totals.committed.missing).toEqual([{ currency: 'USD', amount: 2000 }])
    expect(totals.conclusive).toBe(0)
  })
})

describe('laiLoBoard — sắp xếp và tổng', () => {
  it('lệnh nguy cơ lỗ lên đầu, rồi ăn lợi nhuận, rồi thiếu số, rồi trong kế hoạch', () => {
    const mk = (id: string, poAmount: number, price = 120, withPlan = true) => ({
      lsx: { id, code: id, status: 'in_progress', customer_name: null },
      line: { lsx_id: id, product_id: `${id}p`, product_code: `${id}P`, qty: 10 },
      plan: withPlan ? [P(`${id}p`, 100, 0, 20)] : [],
      order: { id: `${id}o`, code: 'SO', lsx_id: id, currency: 'USD', fx_rate: 25000 },
      oline: { order_id: `${id}o`, product_id: `${id}p`, qty: 10, unit_price: price },
      po: PO({ id: `${id}po`, lsx_id: id, amount: poAmount }),
    })
    // Giá thành KH = 1.000 USD = 25 tr; doanh thu = 1.200 USD = 30 tr; LN KH = 5 tr
    const on = mk('ON', 20_000_000)
    // Bán 110 thay vì 120 → doanh thu 27,5 tr; mua 24 tr → biên 3,5 tr < LN KH 5 tr
    const an = mk('AN', 24_000_000, 110)
    const lo = mk('LO', 26_000_000)
    const thieu = mk('TH', 1_000_000, 120, false)
    const all = [on, an, lo, thieu]
    const { rows, totals } = laiLoBoard({
      lsx: all.map((x) => x.lsx),
      lsxLines: all.map((x) => x.line),
      plans: all.flatMap((x) => x.plan),
      orders: all.map((x) => x.order),
      orderLines: all.map((x) => x.oline),
      pos: all.map((x) => x.po),
    })
    expect(rows.map((r) => r.code)).toEqual(['LO', 'AN', 'TH', 'ON'])
    expect(rows.map((r) => r.verdict)).toEqual(['lo', 'an_lai', 'thieu', 'on'])
    expect(totals.committed.vnd).toBe(71_000_000)
    expect(totals.plan_products).toBe(3)
    expect(totals.products).toBe(4)
    expect(totals.conclusive).toBe(3)
    expect(totals.at_risk).toBe(2)
  })

  it('mergeQuy gộp phần thiếu theo tiền tệ', () => {
    expect(
      mergeQuy([
        { vnd: 1, missing: [{ currency: 'USD', amount: 1.5 }] },
        { vnd: 2, missing: [{ currency: 'USD', amount: 2 }, { currency: 'EUR', amount: 3 }] },
      ]),
    ).toEqual({ vnd: 3, missing: [{ currency: 'USD', amount: 3.5 }, { currency: 'EUR', amount: 3 }] }) // prettier-ignore
  })
})
