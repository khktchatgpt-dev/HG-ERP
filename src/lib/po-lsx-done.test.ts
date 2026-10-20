import { describe, expect, it } from 'vitest'
import { isPoOfDoneLsx } from './po-lsx-done'

describe('isPoOfDoneLsx — đơn còn mở của lệnh đã hoàn thành', () => {
  it('đơn chờ duyệt / nháp của lệnh đã xong → có', () => {
    expect(isPoOfDoneLsx({ status: 'pending_approval', production_order_id: 'l1', lsx_status: 'completed' })).toBe(true) // prettier-ignore
    expect(isPoOfDoneLsx({ status: 'draft', production_order_id: 'l1', lsx_status: 'completed' })).toBe(true) // prettier-ignore
  })
  it('đơn đã về đủ / đã huỷ → không (đã đóng sổ)', () => {
    expect(isPoOfDoneLsx({ status: 'received', production_order_id: 'l1', lsx_status: 'completed' })).toBe(false) // prettier-ignore
    expect(isPoOfDoneLsx({ status: 'cancelled', production_order_id: 'l1', lsx_status: 'completed' })).toBe(false) // prettier-ignore
  })
  it('lệnh còn chạy → không', () => {
    expect(isPoOfDoneLsx({ status: 'ordered', production_order_id: 'l1', lsx_status: 'approved' })).toBe(false) // prettier-ignore
  })
  it('đơn GỘP: chỉ tính khi MỌI lệnh đều xong', () => {
    const base = { status: 'ordered', production_order_id: 'l1', lsx_status: 'completed' }
    expect(isPoOfDoneLsx({ ...base, extra_lsx: [{ status: 'approved' }] })).toBe(false)
    expect(isPoOfDoneLsx({ ...base, extra_lsx: [{ status: 'completed' }] })).toBe(true)
  })
  it('đơn ngoài lệnh / chưa biết trạng thái lệnh → không', () => {
    expect(isPoOfDoneLsx({ status: 'ordered', production_order_id: null })).toBe(false)
    expect(isPoOfDoneLsx({ status: 'ordered', production_order_id: 'l1' })).toBe(false)
  })
})
