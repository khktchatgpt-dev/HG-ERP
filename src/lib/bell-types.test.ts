import { describe, expect, it } from 'vitest'
import { BELL_TYPES, isBellType } from './bell-types'

describe('loại thông báo lên chuông (05/11/2026)', () => {
  it('chỉ loại việc giao của module tasks, đủ hai chiều người giao ↔ người nhận', () => {
    expect([...BELL_TYPES].sort()).toEqual(
      [
        'approved',
        'assigned',
        'commented',
        'reassigned',
        'rejected',
        'status_changed',
        'submitted',
      ].sort(),
    )
  })

  it('cảnh báo kho / đơn mua / lệnh / lương không lên chuông', () => {
    for (const t of [
      'wh_receipt',
      'po_submitted',
      'po_late',
      'wh_stock_low',
      'lsx_approved',
      'payroll_submitted',
      'feedback_new',
    ]) {
      expect(isBellType(t), t).toBe(false)
    }
    expect(isBellType('assigned')).toBe(true)
  })
})
