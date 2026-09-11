import { describe, expect, it } from 'vitest'
import {
  batchesToShipments,
  receiptVerdict,
  receiveActions,
  scheduleRows,
  shipmentBadge,
  shipmentEmptyHint,
  lineShortAction,
} from './nhan-hang'

describe('batchesToShipments', () => {
  it('gộp các mảnh cùng ngày thành một đợt, bỏ mảnh rỗng, sắp theo ngày', () => {
    const out = batchesToShipments(['a', 'b'], {
      a: [
        { date: '2026-09-20', qty: 100 },
        { date: '2026-09-15', qty: 50 },
      ],
      b: [
        { date: '2026-09-20', qty: '' },
        { date: '2026-09-20', qty: 30 },
      ],
    })
    expect(out).toEqual([
      { expected_date: '2026-09-15', lines: [{ po_line_id: 'a', qty: 50 }] },
      {
        expected_date: '2026-09-20',
        lines: [
          { po_line_id: 'a', qty: 100 },
          { po_line_id: 'b', qty: 30 },
        ],
      },
    ])
  })
  it('không có mảnh nào có số thì không có đợt', () => {
    expect(batchesToShipments(['a'], { a: [{ date: '2026-09-20', qty: 0 }] })).toEqual([])
  })
})

describe('receiptVerdict', () => {
  it('đủ / thiếu / chưa về / dư / chốt thiếu', () => {
    expect(receiptVerdict(10, { qty_received: 10, qty_missing: 0, closed_short_at: null }).label).toBe('Đủ') // prettier-ignore
    expect(receiptVerdict(10, { qty_received: 4, qty_missing: 6, closed_short_at: null })).toMatchObject({ label: 'Thiếu 6', kind: 'part' }) // prettier-ignore
    expect(receiptVerdict(10, { qty_received: 0, qty_missing: 10, closed_short_at: null })).toMatchObject({ label: 'Chưa về', kind: 'idle' }) // prettier-ignore
    expect(receiptVerdict(10, { qty_received: 12, qty_missing: -2, closed_short_at: null })).toMatchObject({ label: 'Dư 2', kind: 'done' }) // prettier-ignore
    expect(receiptVerdict(10, { qty_received: 4, qty_missing: 6, closed_short_at: '2026-09-01' })).toMatchObject({ label: 'Chốt thiếu 6', kind: 'short' }) // prettier-ignore
  })
  it('không có sổ trạng thái thì suy từ SL đặt', () => {
    expect(receiptVerdict(7, undefined)).toMatchObject({ label: 'Chưa về', missing: 7 })
  })
})

describe('scheduleRows', () => {
  it('cộng SL đã hẹn qua các đợt còn sống, đợt huỷ không tính', () => {
    const rows = scheduleRows(
      [{ id: 'a', name: 'Thép', unit: 'kg', qty_ordered: 100 }],
      [
        { status: 'planned', lines: [{ po_line_id: 'a', qty: 40 }] },
        { status: 'cancelled', lines: [{ po_line_id: 'a', qty: 60 }] },
        { status: 'received', lines: [{ po_line_id: 'a', qty: 30 }] },
      ],
    )
    expect(rows[0]).toMatchObject({ done: 70, left: 30 })
  })
})

describe('shipmentBadge', () => {
  it('quá hẹn thắng "đang hẹn", nhưng đợt đã nhận / đã huỷ không bao giờ quá hẹn', () => {
    expect(shipmentBadge('planned', true).tone).toBe('stop')
    expect(shipmentBadge('received', true).label).toBe('Đã nhận')
    expect(shipmentBadge('cancelled', true).label).toBe('Đã huỷ')
  })
})

describe('receiveActions', () => {
  it('đơn đã gửi NCC: xác nhận được, chưa thêm đợt được', () => {
    const a = receiveActions({ status: 'ordered', canEdit: true, hasStockLines: true, openStockLines: 3 }) // prettier-ignore
    expect(a.confirm.ok).toBe(true)
    expect(a.addShipment.ok).toBe(false)
    expect(a.receive.ok).toBe(true)
    expect(a.closeShort.ok).toBe(true)
    expect(a.acceptByHand.ok).toBe(false)
  })
  it('không phải người phụ trách thì mọi nút ghi đều khoá kèm lý do, nút DẪN sang Kho vẫn mở', () => {
    const a = receiveActions({ status: 'confirmed', canEdit: false, hasStockLines: true, openStockLines: 1 }) // prettier-ignore
    expect(a.addShipment).toEqual({
      ok: false,
      why: 'Chỉ người phụ trách đơn mới làm được',
    })
    expect(a.receive.ok).toBe(true)
  })
  it('đơn toàn dòng tự do: nghiệm thu ngoài sổ, không chia đợt', () => {
    const a = receiveActions({ status: 'in_transit', canEdit: true, hasStockLines: false, openStockLines: 0 }) // prettier-ignore
    expect(a.acceptByHand.ok).toBe(true)
    expect(a.addShipment.why).toMatch(/không có dòng vật tư kho/)
  })
  it('gợi ý trống đổi theo bước', () => {
    expect(shipmentEmptyHint('ordered', true)).toMatch(/NCC xác nhận/)
    expect(shipmentEmptyHint('partial', false)).toMatch(/tự gõ/)
  })
})

describe('lineShortAction — việc chốt thiếu của TỪNG dòng', () => {
  const sent = { poStatus: 'partial', canEdit: true }

  it('dòng còn thiếu trên đơn đã gửi → chốt được', () => {
    expect(lineShortAction({ qty_open: 40, closed_short_at: null }, sent)).toEqual({
      kind: 'close',
    })
  })

  it('dòng ĐÃ chốt → đổi thành mở lại, không phải chốt tiếp', () => {
    expect(
      lineShortAction({ qty_open: 40, closed_short_at: '2026-09-01T00:00:00Z' }, sent),
    ).toEqual({ kind: 'reopen' })
  })

  it('dòng về đủ thì không bày nút nào — nút chết còn tệ hơn không có nút', () => {
    expect(lineShortAction({ qty_open: 0, closed_short_at: null }, sent).kind).toBe('none')
    // Dòng dư (qty_open âm) cũng vậy.
    expect(lineShortAction({ qty_open: -2, closed_short_at: null }, sent).kind).toBe('none')
  })

  it('đơn chưa gửi NCC: nút CÓ mặt nhưng khoá kèm lý do', () => {
    const r = lineShortAction({ qty_open: 5, closed_short_at: null }, { poStatus: 'draft', canEdit: true }) // prettier-ignore
    expect(r.kind).toBe('close')
    expect(r.blocked).toMatch(/đã gửi NCC/)
  })

  it('đơn đã huỷ thì không mở lại dòng được — khớp chặn của service', () => {
    const r = lineShortAction({ qty_open: 5, closed_short_at: '2026-09-01T00:00:00Z' }, { poStatus: 'cancelled', canEdit: true }) // prettier-ignore
    expect(r.blocked).toMatch(/đã huỷ/)
  })

  it('không phải người phụ trách thì khoá cả hai chiều', () => {
    const ctx = { poStatus: 'partial', canEdit: false }
    expect(lineShortAction({ qty_open: 5, closed_short_at: null }, ctx).blocked).toMatch(/người phụ trách/) // prettier-ignore
    expect(lineShortAction({ qty_open: 5, closed_short_at: '2026-09-01T00:00:00Z' }, ctx).blocked).toMatch(/người phụ trách/) // prettier-ignore
  })

  it('dòng không có trong sổ kho (dòng tự do) thì không có việc gì', () => {
    expect(lineShortAction(undefined, sent).kind).toBe('none')
  })
})
