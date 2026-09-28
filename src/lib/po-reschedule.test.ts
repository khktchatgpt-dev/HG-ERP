import { describe, expect, it } from 'vitest'
import { canReschedule, rescheduleNote, shiftPlannedShipments } from './po-reschedule'

describe('canReschedule — trạng thái nào dời được hẹn giao', () => {
  it('cho phép mọi trạng thái đơn đang chạy', () => {
    for (const s of ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']) {
      expect(canReschedule(s)).toEqual({ ok: true })
    }
  })

  it('đơn chưa duyệt thì chỉ về "Sửa đơn" — không mở đường vòng', () => {
    const g = canReschedule('pending_approval')
    expect(g.ok).toBe(false)
    expect(g.ok === false && g.reason).toContain('Sửa đơn')
  })

  it('đơn đã đóng thì chặn, kèm lý do đọc được', () => {
    for (const s of ['received', 'cancelled']) {
      const g = canReschedule(s)
      expect(g.ok).toBe(false)
      expect(g.ok === false && g.reason.length).toBeGreaterThan(10)
    }
  })
})

describe('rescheduleNote — vết dời hẹn', () => {
  it('ghi rõ ngày cũ → ngày mới theo lối dd/mm/yyyy', () => {
    expect(rescheduleNote('2026-07-12', '2026-07-20', 'NCC báo trễ tàu')).toBe(
      '[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC báo trễ tàu',
    )
  })

  it('chỉ là MỘT dòng vết — không kéo theo ghi chú cũ (vết vào Trao đổi, không vào note in phiếu)', () => {
    const line = rescheduleNote('2026-07-12', '2026-07-20', 'NCC báo trễ')
    expect(line).toBe('[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC báo trễ')
    expect(line).not.toContain('\n')
  })

  it('đơn chưa từng có hẹn giao thì ghi "chưa hẹn"', () => {
    expect(rescheduleNote(null, '2026-08-01', 'chốt được ngày')).toBe(
      '[Dời hẹn giao] chưa hẹn → 01/08/2026 · chốt được ngày',
    )
  })

  it('lý do để trống được — vết chỉ còn ngày cũ → ngày mới, không có dấu chấm giữa treo', () => {
    expect(rescheduleNote('2026-09-29', '2026-10-05', '')).toBe(
      '[Dời hẹn giao] 29/09/2026 → 05/10/2026',
    )
    expect(rescheduleNote('2026-09-29', '2026-10-05', '   ')).toBe(
      '[Dời hẹn giao] 29/09/2026 → 05/10/2026',
    )
  })

  it('cắt khoảng trắng thừa của lý do', () => {
    expect(rescheduleNote('2026-07-12', '2026-07-20', '  NCC hết hàng  ')).toBe(
      '[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC hết hàng',
    )
  })
})

describe('shiftPlannedShipments — dời cả đơn kéo theo đợt chưa giao', () => {
  const ships = [
    { id: 'd1', status: 'planned', expected_date: '2026-10-01' },
    { id: 'd2', status: 'planned', expected_date: '2026-10-10' },
    { id: 'd3', status: 'arrived', expected_date: '2026-09-25' },
    { id: 'd4', status: 'received', expected_date: '2026-09-20' },
  ]
  it('trượt đúng số ngày, giữ khoảng cách giữa các đợt; bỏ qua đợt đã tới / đã nhận', () => {
    expect(shiftPlannedShipments(ships, '2026-10-01', '2026-10-05')).toEqual([
      { id: 'd1', from: '2026-10-01', to: '2026-10-05' },
      { id: 'd2', from: '2026-10-10', to: '2026-10-14' },
    ])
  })
  it('qua tháng + dời sớm lên đều đúng', () => {
    expect(shiftPlannedShipments([ships[1]], '2026-10-01', '2026-09-28')).toEqual([
      { id: 'd2', from: '2026-10-10', to: '2026-10-07' },
    ])
  })
  it('đơn chưa có hẹn hoặc không đổi ngày → không trượt gì', () => {
    expect(shiftPlannedShipments(ships, null, '2026-10-05')).toEqual([])
    expect(shiftPlannedShipments(ships, '2026-10-01', '2026-10-01')).toEqual([])
  })
})
