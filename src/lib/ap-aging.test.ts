import { describe, expect, it } from 'vitest'
import { agingTotals, bucketOf, buildAging, type AgingInvoice } from './ap-aging'
import { rateFor, realizedFxDiff, sumToBase, toBase } from './fx'

const TODAY = '2026-09-11'
const inv = (o: Partial<AgingInvoice> = {}): AgingInvoice => ({
  invoice_id: 'i1',
  invoice_no: 'HD-1',
  supplier_id: 's1',
  supplier_name: 'NCC A',
  currency: 'VND',
  total: 1_000_000,
  paid: 0,
  due_date: '2026-10-01',
  invoice_date: '2026-09-01',
  fx_rate: null,
  ...o,
})

describe('bucketOf — tuổi tính theo HẠN, không theo ngày hoá đơn', () => {
  it('chưa tới hạn thì chưa đến hạn, dù hoá đơn đã lâu', () => {
    expect(bucketOf('2026-12-01', TODAY)).toBe('chua_den_han')
    expect(bucketOf(TODAY, TODAY)).toBe('chua_den_han')
  })

  it('chia đúng bốn mốc quá hạn', () => {
    expect(bucketOf('2026-09-10', TODAY)).toBe('qua_1_30') // 1 ngày
    expect(bucketOf('2026-08-12', TODAY)).toBe('qua_1_30') // 30 ngày
    expect(bucketOf('2026-08-11', TODAY)).toBe('qua_31_60') // 31 ngày
    expect(bucketOf('2026-07-13', TODAY)).toBe('qua_31_60') // 60 ngày
    expect(bucketOf('2026-07-12', TODAY)).toBe('qua_61_90') // 61 ngày
    expect(bucketOf('2026-06-03', TODAY)).toBe('qua_90') // 100 ngày
  })

  /**
   * Hoá đơn không khai hạn là LỖI DỮ LIỆU cần sửa, không phải khoản nợ an toàn.
   * Gộp nó vào "chưa đến hạn" là giấu lỗi đi.
   */
  it('chưa khai hạn có rổ RIÊNG, không gộp vào "chưa đến hạn"', () => {
    expect(bucketOf(null, TODAY)).toBe('chua_co_han')
  })
})

describe('buildAging', () => {
  it('trừ đã trả, bỏ hoá đơn đã trả đủ', () => {
    const rows = buildAging(
      [
        inv({ invoice_id: 'a', total: 1_000_000, paid: 400_000 }),
        inv({ invoice_id: 'b', total: 500_000, paid: 500_000 }),
      ],
      TODAY,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(600_000)
    expect(rows[0].invoice_count).toBe(1)
  })

  it('tách theo NCC × TIỀN TỆ, không cộng USD vào VND', () => {
    const rows = buildAging(
      [
        inv({ invoice_id: 'a', currency: 'VND', total: 1_000_000 }),
        inv({ invoice_id: 'b', currency: 'USD', total: 500, fx_rate: 25_400 }),
      ],
      TODAY,
    )
    expect(rows).toHaveLength(2)
    const usd = rows.find((r) => r.currency === 'USD')!
    expect(usd.total).toBe(500)
    expect(usd.total_base).toBe(12_700_000) // 500 × 25.400
    expect(rows.every((r) => r.total !== 1_000_500)).toBe(true)
  })

  /**
   * Một khoản 10.000 USD hiện thành "0 đ" đọc ra là "không nợ gì" — sai nguy
   * hiểm hơn hẳn "chưa quy đổi được".
   */
  it('thiếu tỷ giá thì total_base = null, KHÔNG phải 0', () => {
    const rows = buildAging([inv({ currency: 'USD', total: 10_000, fx_rate: null })], TODAY) // prettier-ignore
    expect(rows[0].total).toBe(10_000)
    expect(rows[0].total_base).toBeNull()
  })

  it('xếp NCC quá hạn lâu nhất lên đầu', () => {
    const rows = buildAging(
      [
        inv({ invoice_id: 'a', supplier_id: 's1', supplier_name: 'A', due_date: '2026-09-05' }), // prettier-ignore
        inv({ invoice_id: 'b', supplier_id: 's2', supplier_name: 'B', due_date: '2026-05-01' }), // prettier-ignore
      ],
      TODAY,
    )
    expect(rows[0].supplier_name).toBe('B')
    expect(rows[0].worst_days).toBeGreaterThan(100)
  })

  it('gộp nhiều hoá đơn của một NCC vào đúng rổ', () => {
    const rows = buildAging(
      [
        inv({ invoice_id: 'a', due_date: '2026-12-01', total: 100 }),
        inv({ invoice_id: 'b', due_date: '2026-09-01', total: 200 }),
        inv({ invoice_id: 'c', due_date: null, total: 300 }),
      ],
      TODAY,
    )
    const r = rows[0]
    expect(r.buckets.chua_den_han).toBe(100)
    expect(r.buckets.qua_1_30).toBe(200)
    expect(r.buckets.chua_co_han).toBe(300)
    expect(r.total).toBe(600)
  })
})

describe('agingTotals', () => {
  it('cộng theo rổ, tách tiền tệ, VND đứng trước', () => {
    const rows = buildAging(
      [
        inv({ invoice_id: 'a', currency: 'USD', total: 100, fx_rate: 25_000 }),
        inv({ invoice_id: 'b', currency: 'VND', total: 5_000_000 }),
      ],
      TODAY,
    )
    const t = agingTotals(rows)
    expect(t[0].currency).toBe('VND')
    expect(t[0].total).toBe(5_000_000)
    expect(t[1].total).toBe(100)
  })
})

describe('fx — quy đổi và chênh lệch', () => {
  const rates = [
    { currency: 'USD', rate_date: '2026-08-01', rate: 25_000 },
    { currency: 'USD', rate_date: '2026-09-01', rate: 25_400 },
  ]

  it('lấy dòng MỚI NHẤT có ngày <= ngày chứng từ', () => {
    expect(rateFor(rates, 'USD', '2026-08-15')).toBe(25_000)
    expect(rateFor(rates, 'USD', '2026-09-05')).toBe(25_400)
  })

  /** Tỷ giá ngày mai chưa tồn tại lúc lập chứng từ hôm nay. */
  it('KHÔNG lấy tỷ giá của ngày sau chứng từ', () => {
    expect(rateFor(rates, 'USD', '2026-07-01')).toBeNull()
  })

  it('VND luôn là 1, không cần khai', () => {
    expect(rateFor([], 'VND', '2026-01-01')).toBe(1)
    expect(toBase(1234.56, 'VND', null)).toBe(1234.56)
  })

  it('thiếu tỷ giá thì toBase trả null', () => {
    expect(toBase(100, 'USD', null)).toBeNull()
    expect(toBase(100, 'USD', 0)).toBeNull()
  })

  it('sumToBase trả kèm phần KHÔNG quy đổi được, không giấu đi', () => {
    const r = sumToBase([
      { amount: 1_000_000, currency: 'VND', rate: null },
      { amount: 100, currency: 'USD', rate: 25_000 },
      { amount: 50, currency: 'EUR', rate: null },
      { amount: 20, currency: 'EUR', rate: null },
    ])
    expect(r.base).toBe(3_500_000) // 1.000.000 + 2.500.000
    expect(r.missing).toEqual([{ currency: 'EUR', amount: 70 }])
  })

  it('chênh lệch tỷ giá đã thực hiện: dương là LỖ', () => {
    // Ghi nợ 10.000 USD @25.400, trả @26.000 → lỗ 6.000.000
    expect(realizedFxDiff(10_000, 'USD', 25_400, 26_000)).toBe(6_000_000)
    expect(realizedFxDiff(10_000, 'USD', 26_000, 25_400)).toBe(-6_000_000)
    expect(realizedFxDiff(1_000_000, 'VND', null, null)).toBe(0)
    expect(realizedFxDiff(100, 'USD', null, 26_000)).toBeNull()
  })
})
