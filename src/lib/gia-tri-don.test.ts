import { describe, expect, it } from 'vitest'
import { giaTriDonBoard, mergeGtdQuy, type GtdOrder, type GtdPo } from './gia-tri-don'

const L1 = { id: 'L1', code: '01/26-27 - X', status: 'approved', customer_name: 'X' }
const L2 = { id: 'L2', code: '02/26-27 - Y', status: 'in_progress', customer_name: 'Y' }
const O = (over: Partial<GtdOrder>): GtdOrder => ({
  id: 'o',
  code: 'ĐH',
  lsx_id: 'L1',
  status: 'lsx_issued',
  currency: 'USD',
  fx_rate: 25400,
  due_date: null,
  ...over,
})
const PO = (over: Partial<GtdPo>): GtdPo => ({
  id: 'p',
  code: 'PO',
  lsx_id: 'L1',
  supplier_name: 'NCC',
  status: 'approved',
  currency: 'VND',
  fx_rate: null,
  amount: 0,
  extra_lsx: false,
  ...over,
})

describe('giaTriDonBoard — đơn bán cộng thẳng từ dòng, không thay bằng kế hoạch', () => {
  const b = giaTriDonBoard({
    lsx: [L1],
    orders: [O({ id: 'o1', code: 'A', due_date: '2026-12-30' }), O({ id: 'o2', code: 'B', due_date: '2026-11-01' })], // prettier-ignore
    orderLines: [
      { order_id: 'o1', qty: 100, unit_price: 10 },
      { order_id: 'o1', qty: 50, unit_price: 0 }, // chưa nhập giá → 0, không đoán
      { order_id: 'o2', qty: 10, unit_price: 2.5 },
    ],
    pos: [],
  })
  const r = b.rows[0]
  it('giá trị gốc theo tiền tệ và quy VND theo tỷ giá chốt từng đơn', () => {
    expect(r.order_amounts).toEqual([{ currency: 'USD', amount: 1025 }])
    expect(r.order_vnd).toEqual({ vnd: 1025 * 25400, missing: [] })
  })
  it('đếm dòng có giá / tổng dòng', () => {
    expect(r.order_lines).toBe(3)
    expect(r.priced_lines).toBe(2)
  })
  it('danh sách đơn xếp theo ngày giao', () => {
    expect(r.orders.map((o) => o.code)).toEqual(['B', 'A'])
    expect(r.orders[1]).toMatchObject({ amount: 1000, vnd: 25_400_000, lines: 2, priced_lines: 1 }) // prettier-ignore
  })
  it('lệnh không có đơn mua: po_vnd = 0, không phải null', () => {
    expect(r.po_count).toBe(0)
    expect(r.po_vnd).toEqual({ vnd: 0, missing: [] })
    expect(b.totals.lsx_without_pos).toBe(1)
  })
})

describe('giaTriDonBoard — đơn mua: nháp tách riêng, ngoại tệ thiếu tỷ giá nằm ở missing', () => {
  const b = giaTriDonBoard({
    lsx: [L1],
    orders: [],
    orderLines: [],
    pos: [
      PO({ id: 'p1', amount: 1_000_000 }),
      PO({ id: 'p2', amount: 500_000, status: 'draft' }),
      PO({ id: 'p3', amount: 200, currency: 'USD', fx_rate: 25000 }),
      PO({ id: 'p4', amount: 100, currency: 'USD', fx_rate: null, extra_lsx: true }),
      PO({ id: 'p5', amount: 999, status: 'cancelled' }), // service đã lọc; lib vẫn cộng nếu được đưa vào
    ],
  })
  const r = b.rows[0]
  it('cộng VND quy đổi, phần USD chưa tỷ giá không quy bừa', () => {
    expect(r.po_vnd.vnd).toBe(1_000_000 + 500_000 + 200 * 25000 + 999)
    expect(r.po_vnd.missing).toEqual([{ currency: 'USD', amount: 100 }])
  })
  it('nháp và đơn gộp lệnh được đếm riêng', () => {
    expect(r.po_draft_vnd).toBe(500_000)
    expect(r.po_extra_lsx).toBe(1)
    expect(r.pos.find((p) => p.id === 'p2')?.draft).toBe(true)
  })
  it('đơn mua xếp theo tiền giảm dần', () => {
    expect(r.pos.map((p) => p.id)).toEqual(['p3', 'p1', 'p2', 'p5', 'p4'])
  })
})

describe('giaTriDonBoard — xếp lệnh và tổng', () => {
  const b = giaTriDonBoard({
    lsx: [L1, L2],
    orders: [O({ id: 'o1', lsx_id: 'L2' }), O({ id: 'o2', lsx_id: 'L1', fx_rate: null })],
    orderLines: [
      { order_id: 'o1', qty: 1, unit_price: 100 },
      { order_id: 'o2', qty: 1, unit_price: 50 },
    ],
    pos: [PO({ id: 'p1', lsx_id: 'L1', amount: 9_000_000 })],
  })
  it('lệnh có đơn bán ghi giá đứng trước; cùng nhóm thì theo tiền', () => {
    // Cả hai đều có dòng ghi giá; L2 quy được 2,54 tr, L1 chưa quy (0 VND) → L2 trước.
    expect(b.rows.map((r) => r.code)).toEqual([L2.code, L1.code])
  })
  it('tổng: đơn bán theo tiền tệ gốc, VND đã quy + phần chưa quy, số lệnh có giá', () => {
    expect(b.totals.order_amounts).toEqual([{ currency: 'USD', amount: 150 }])
    expect(b.totals.order_vnd).toEqual({ vnd: 2_540_000, missing: [{ currency: 'USD', amount: 50 }] }) // prettier-ignore
    expect(b.totals.lsx_with_price).toBe(2)
    expect(b.totals.po_vnd.vnd).toBe(9_000_000)
    expect(b.totals.lsx_without_pos).toBe(1)
  })
  it('lệnh không có đơn bán: đếm vào lsx_without_orders, giá trị 0', () => {
    const b2 = giaTriDonBoard({ lsx: [L1], orders: [], orderLines: [], pos: [] })
    expect(b2.rows[0].order_vnd).toEqual({ vnd: 0, missing: [] })
    expect(b2.totals.lsx_without_orders).toBe(1)
    expect(b2.totals.lsx_with_price).toBe(0)
  })
})

describe('mergeGtdQuy', () => {
  it('gộp phần thiếu theo tiền tệ', () => {
    expect(
      mergeGtdQuy([
        { vnd: 1, missing: [{ currency: 'USD', amount: 1.5 }] },
        { vnd: 2, missing: [{ currency: 'USD', amount: 2.25 }, { currency: 'EUR', amount: 1 }] }, // prettier-ignore
      ]),
    ).toEqual({ vnd: 3, missing: [{ currency: 'USD', amount: 3.75 }, { currency: 'EUR', amount: 1 }] }) // prettier-ignore
  })
})
