import { describe, expect, it } from 'vitest'
import {
  matchSummary,
  threeWayMatch,
  unlinkedInvoiceAmount,
  type MatchInvoiceLine,
  type MatchMovement,
  type MatchPoLine,
} from './three-way-match'

const line = (o: Partial<MatchPoLine> = {}): MatchPoLine => ({
  id: 'L1',
  material_code: 'MA-001',
  material_name: 'Thép hộp 30x30',
  unit: 'cây',
  qty_ordered: 100,
  unit_price: 50_000,
  ...o,
})
const mv = (o: Partial<MatchMovement> = {}): MatchMovement => ({
  po_line_id: 'L1',
  direction: 'in',
  qty: 100,
  unit_cost: 50_000,
  ...o,
})
const iv = (o: Partial<MatchInvoiceLine> = {}): MatchInvoiceLine => ({
  po_line_id: 'L1',
  invoice_id: 'I1',
  invoice_no: 'HD-001',
  qty: 100,
  unit_price: 50_000,
  amount: 5_000_000,
  ...o,
})

describe('threeWayMatch — bốn kết luận, mỗi cái nói đúng một chuyện', () => {
  it('ba vế bằng nhau thì KHỚP', () => {
    const [r] = threeWayMatch([line()], [mv()], [iv()])
    expect(r.verdict).toBe('khop')
    expect(r.amount_ordered).toBe(5_000_000)
    expect(r.amount_received).toBe(5_000_000)
    expect(r.amount_invoiced).toBe(5_000_000)
    expect(r.amount_gap).toBe(0)
  })

  it('hàng về rồi mà chưa có hoá đơn → CHỜ HOÁ ĐƠN, kèm số tiền nợ thật', () => {
    const [r] = threeWayMatch([line()], [mv()], [])
    expect(r.verdict).toBe('cho_hoa_don')
    expect(r.amount_gap).toBe(5_000_000)
    expect(r.invoices).toEqual([])
  })

  it('NCC xuất hoá đơn cho hàng chưa vào kho → ĐÒI TRƯỚC', () => {
    const [r] = threeWayMatch([line()], [], [iv()])
    expect(r.verdict).toBe('doi_truoc')
    expect(r.amount_gap).toBe(-5_000_000)
  })

  it('chưa về gì và cũng chưa có hoá đơn thì KHÔNG phải lỗi', () => {
    expect(threeWayMatch([line()], [], [])[0].verdict).toBe('chua_phat_sinh')
  })

  it('đúng số lượng nhưng NCC tính giá khác → LỆCH GIÁ, không gọi là thiếu hàng', () => {
    const [r] = threeWayMatch([line()], [mv()], [iv({ unit_price: 52_000, amount: 5_200_000 })]) // prettier-ignore
    expect(r.verdict).toBe('lech_gia')
    expect(r.qty_gap).toBe(0)
    expect(r.amount_gap).toBe(-200_000)
  })

  /**
   * Hoá đơn NCC làm tròn tới đồng. Báo động vì vài xu thì người dùng học cách
   * phớt lờ cảnh báo, rồi bỏ qua luôn cái thật.
   */
  it('chênh dưới 1 đồng là tiếng ồn làm tròn, vẫn coi là KHỚP', () => {
    const [r] = threeWayMatch([line()], [mv()], [iv({ amount: 5_000_000.4 })])
    expect(r.verdict).toBe('khop')
  })
})

describe('threeWayMatch — các ca thật hay gặp', () => {
  it('phiếu đảo (movement out) CẤN TRỪ phần đã nhận', () => {
    const [r] = threeWayMatch(
      [line()],
      [mv(), mv({ direction: 'out', qty: 30 })],
      [iv({ qty: 70, amount: 3_500_000 })],
    )
    expect(r.qty_received).toBe(70)
    expect(r.amount_received).toBe(3_500_000)
    expect(r.verdict).toBe('khop')
  })

  /**
   * ĐÂY LÀ LỖI GỐC mà đối chiếu ba chiều sinh ra để chữa: công nợ theo sổ kho
   * tính bằng qty × unit_cost, nên phiếu nhập KHÔNG có giá đóng góp 0 đồng và
   * khoản nợ biến mất (`missing_price_count` của payables tự thú điều này).
   * Ở đây hàng vẫn đếm là đã về, và hoá đơn NCC mới là vế đòi tiền.
   */
  it('phiếu nhập KHÔNG có giá: số lượng vẫn đếm, tiền về bằng 0 — bày ra chứ không giấu', () => {
    const [r] = threeWayMatch([line()], [mv({ unit_cost: null })], [iv()])
    expect(r.qty_received).toBe(100)
    expect(r.amount_received).toBe(0)
    // Số lượng khớp nên KHÔNG phải "thiếu hàng"; lệch nằm ở tiền.
    expect(r.verdict).toBe('lech_gia')
    expect(r.amount_gap).toBe(-5_000_000)
  })

  it('nhiều hoá đơn cùng đòi một dòng thì cộng dồn và giữ đủ số hoá đơn', () => {
    const [r] = threeWayMatch(
      [line()],
      [mv()],
      [
        iv({ invoice_id: 'I1', invoice_no: 'HD-001', qty: 60, amount: 3_000_000 }),
        iv({ invoice_id: 'I2', invoice_no: 'HD-002', qty: 40, amount: 2_000_000 }),
      ],
    )
    expect(r.qty_invoiced).toBe(100)
    expect(r.verdict).toBe('khop')
    expect(r.invoices.map((x) => x.invoice_no)).toEqual(['HD-001', 'HD-002'])
  })

  /**
   * Dòng nhôm tính tiền theo TỔNG KG (`price_basis: 'unit2'`). Nhân thẳng
   * qty × giá ra số khác hẳn — nên vế ĐẶT phải đi qua `poLineAmount`.
   */
  it('dòng tính giá theo đơn vị 2 (đ/kg) lấy đúng tiền của đơn', () => {
    const [r] = threeWayMatch(
      [line({ qty_ordered: 20, unit_price: 42_000, price_basis: 'unit2', qty2: 1_250 })],
      [],
      [],
    )
    // 1.250 kg × 42.000 đ/kg, KHÔNG phải 20 cây × 42.000.
    expect(r.amount_ordered).toBe(52_500_000)
  })

  it('dòng đã chốt thiếu vẫn đối chiếu bình thường, chỉ gắn cờ', () => {
    const [r] = threeWayMatch(
      [line({ closed_short_at: '2026-09-01T00:00:00Z' })],
      [mv({ qty: 60 })],
      [iv({ qty: 60, amount: 3_000_000 })],
    )
    expect(r.closed_short).toBe(true)
    expect(r.verdict).toBe('khop')
  })

  it('dòng đơn không có giá thì vế ĐẶT bằng 0, không ném lỗi', () => {
    const [r] = threeWayMatch([line({ unit_price: null })], [], [])
    expect(r.amount_ordered).toBe(0)
  })
})

describe('tiền ngoài dòng đơn mua', () => {
  it('phí vận chuyển không gắn dòng thì KHÔNG lọt vào bảng đối chiếu', () => {
    const rows = threeWayMatch(
      [line()],
      [mv()],
      [iv(), iv({ po_line_id: null, qty: 1, amount: 500_000 })],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].verdict).toBe('khop')
  })

  it('nhưng được cộng riêng để tổng hoá đơn vẫn khớp tổng bảng', () => {
    expect(
      unlinkedInvoiceAmount([iv(), iv({ po_line_id: null, qty: 1, amount: 500_000 })]),
    ).toBe(500_000)
  })
})

describe('matchSummary — dải đầu trang nói được một câu', () => {
  it('gộp đúng ba loại tiền lệch, mỗi loại một con số dương', () => {
    const rows = threeWayMatch(
      [line({ id: 'A' }), line({ id: 'B' }), line({ id: 'C' }), line({ id: 'D' })],
      [mv({ po_line_id: 'A' }), mv({ po_line_id: 'B' }), mv({ po_line_id: 'C' })],
      [
        iv({ po_line_id: 'A' }),
        // B: đã về, chưa có hoá đơn
        iv({ po_line_id: 'C', amount: 5_300_000 }),
        // D: hoá đơn về trước hàng
        iv({ po_line_id: 'D' }),
      ],
    )
    const s = matchSummary(rows)
    expect(s.byVerdict).toEqual({ khop: 1, cho_hoa_don: 1, doi_truoc: 1, lech_gia: 1, chua_phat_sinh: 0 }) // prettier-ignore
    expect(s.amount_cho_hoa_don).toBe(5_000_000)
    expect(s.amount_doi_truoc).toBe(5_000_000)
    expect(s.amount_lech_gia).toBe(-300_000)
  })
})
