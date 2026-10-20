import { describe, expect, it } from 'vitest'
import { cancelBlock, supplierOrderBlock, underDemand } from './po-guards'

describe('supplierOrderBlock — NCC khoá đặt hàng phải CHẶN thật', () => {
  it('NCC bình thường đặt được', () => {
    expect(supplierOrderBlock({ is_active: true, can_order: true })).toBeNull()
  })
  it('khoá đặt hàng: chặn, nói lý do khoá và cách gỡ', () => {
    const why = supplierOrderBlock({
      is_active: true,
      can_order: false,
      lock_reason: 'Giao sai quy cách 3 lần',
    })
    expect(why).toMatch(/khoá đặt hàng — Giao sai quy cách 3 lần/)
    expect(why).toMatch(/chọn NCC khác/)
  })
  it('khoá không ghi lý do vẫn chặn', () => {
    expect(
      supplierOrderBlock({ is_active: true, can_order: false, lock_reason: '  ' }),
    ).toMatch(/khoá đặt hàng\./)
  })
  it('ngừng giao dịch chặn trước', () => {
    expect(supplierOrderBlock({ is_active: false, can_order: true })).toBe(
      'NCC đã ngừng giao dịch',
    )
  })
})

describe('cancelBlock — không huỷ cả đơn đã có hàng về', () => {
  it('đơn đã gửi chưa về gì: huỷ được', () => {
    expect(cancelBlock('ordered', 0)).toBeNull()
    expect(cancelBlock('draft', 0)).toMatch(/Xoá đơn/)
  })
  it('đơn về một phần: chặn, chỉ đường chốt thiếu', () => {
    expect(cancelBlock('partial', 800)).toMatch(/Chốt thiếu/)
  })
  it('kể cả trạng thái chưa kịp đổi mà đã có phiếu nhập: vẫn chặn', () => {
    expect(cancelBlock('confirmed', 5)).not.toBeNull()
  })
  it('đã về đủ / đã huỷ: chặn như cũ', () => {
    expect(cancelBlock('received', 0)).toMatch(/đã về đủ/)
    expect(cancelBlock('cancelled', 0)).toMatch(/đã huỷ/)
  })
})

describe('underDemand — đặt ít hơn nhu cầu lệnh', () => {
  it('đặt thiếu: trả phần thiếu', () => {
    expect(underDemand(800, 1000)).toBe(200)
  })
  it('đặt đủ hoặc dư: null', () => {
    expect(underDemand(1000, 1000)).toBeNull()
    expect(underDemand(1200, 1000)).toBeNull()
  })
  it('không có nhu cầu để so: null', () => {
    expect(underDemand(10, null)).toBeNull()
    expect(underDemand(10, 0)).toBeNull()
  })
  it('chưa gõ SL đặt: thiếu cả nhu cầu', () => {
    expect(underDemand(null, 50)).toBe(50)
  })
})
