import { describe, expect, it } from 'vitest'
import { buildPurchasingWatch, type WatchInput } from './purchasing-watch'
import { classifyTodo } from './supply-watch'

const T = '2026-09-27'
const po = (o: Partial<WatchInput>): WatchInput => ({
  id: o.id ?? 'p',
  status: 'ordered',
  currency: 'VND',
  total: 100,
  assigned_to: 'nga',
  created_by: 'nga',
  supplier_id: 's1',
  supplier_name: 'CÔNG TY TNHH SX & TM TÂN THÀNH LONG',
  expected_at: '2026-10-10',
  ordered_at: '2026-09-26',
  confirmed_at: null,
  ...o,
})

describe('buildPurchasingWatch — số của Giám đốc = số của trang đích', () => {
  const rows = [
    po({
      id: 'a',
      status: 'pending_approval',
      assigned_to: 'huy',
      currency: 'USD',
      total: 5,
    }),
    po({ id: 'b', status: 'approved' }),
    po({ id: 'c', status: 'ordered', ordered_at: '2026-09-20' }), // gửi quá 2 ngày → chưa xác nhận
    po({ id: 'd', status: 'ordered', expected_at: null, confirmed_at: '2026-09-21' }), // chưa hẹn
    po({ id: 'e', status: 'confirmed', confirmed_at: '2026-09-01', expected_at: '2026-09-01', assigned_to: 'truyen', supplier_id: 's2', supplier_name: 'THÉP VISA', total: 900 }), // prettier-ignore
    po({ id: 'f', status: 'received' }),
    po({ id: 'g', status: 'draft' }),
  ]
  const w = buildPurchasingWatch(rows, T)

  it('ô việc đếm bằng CHÍNH classifyTodo (làn Hộp thư) + chờ ký = pending_approval', () => {
    for (const k of ['unsent', 'unconfirmed', 'no_eta', 'overdue'] as const) {
      const want = rows.filter(
        (p) => p.status !== 'draft' && classifyTodo(p, T) === k,
      ).length
      expect(w.tiles[k]).toBe(want)
    }
    expect(w.tiles.pending).toBe(1)
  })

  it('đơn đang mở không gồm nháp / về đủ / huỷ', () => {
    expect(w.open).toBe(5)
  })

  it('theo người mua: người cầm đơn (lib/supply-scope), tiền cam kết chỉ tính đơn đã gửi', () => {
    const nga = w.buyers.find((b) => b.id === 'nga')!
    expect(nga).toMatchObject({
      pending: 0,
      unsent: 1,
      sent: 2,
      unconfirmed: 1,
      no_eta: 1,
    })
    expect(nga.committed).toEqual([{ currency: 'VND', value: 200 }])
    const huy = w.buyers.find((b) => b.id === 'huy')!
    expect(huy).toMatchObject({ pending: 1, sent: 0 })
    expect(huy.committed).toEqual([])
  })

  it('theo NCC: tên gọn, lớn trước, cộng riêng từng loại tiền', () => {
    expect(w.suppliers.map((s) => s.short)).toEqual(['THÉP VISA', 'TÂN THÀNH LONG'])
    expect(w.committed).toEqual([{ currency: 'VND', value: 1100 }])
  })
})
