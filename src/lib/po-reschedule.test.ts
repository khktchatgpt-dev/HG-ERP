import { describe, expect, it } from 'vitest'
import { canReschedule, rescheduleNote } from './po-reschedule'

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
    expect(rescheduleNote('2026-07-12', '2026-07-20', 'NCC báo trễ tàu', null)).toBe(
      '[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC báo trễ tàu',
    )
  })

  it('giữ nguyên ghi chú cũ ở dưới — đọc từ trên xuống là ra lịch sử', () => {
    const once = rescheduleNote('2026-07-12', '2026-07-20', 'NCC báo trễ', 'Giao cổng B')
    expect(once).toBe('[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC báo trễ\nGiao cổng B')

    const twice = rescheduleNote('2026-07-20', '2026-07-28', 'trễ tiếp', once)
    expect(twice.split('\n')).toEqual([
      '[Dời hẹn giao] 20/07/2026 → 28/07/2026 · trễ tiếp',
      '[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC báo trễ',
      'Giao cổng B',
    ])
  })

  it('đơn chưa từng có hẹn giao thì ghi "chưa hẹn"', () => {
    expect(rescheduleNote(null, '2026-08-01', 'chốt được ngày', null)).toBe(
      '[Dời hẹn giao] chưa hẹn → 01/08/2026 · chốt được ngày',
    )
  })

  it('cắt khoảng trắng thừa của lý do', () => {
    expect(rescheduleNote('2026-07-12', '2026-07-20', '  NCC hết hàng  ', null)).toBe(
      '[Dời hẹn giao] 12/07/2026 → 20/07/2026 · NCC hết hàng',
    )
  })
})
