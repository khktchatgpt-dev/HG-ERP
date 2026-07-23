import { describe, expect, it } from 'vitest'
import { assessSupplyReadiness, type SupplyPo } from './supply-readiness'

const TODAY = '2026-07-22'
const po = (status: SupplyPo['status'], expected_at: string | null = null): SupplyPo => ({
  status,
  expected_at,
})

describe('assessSupplyReadiness', () => {
  it('không PO + có định mức → cần đặt (none, amber)', () => {
    const r = assessSupplyReadiness([], true, TODAY)
    expect(r.level).toBe('none')
    expect(r.tone).toBe('amber')
    expect(r.activeCount).toBe(0)
  })

  it('không PO + chưa có định mức → chưa tới bước mua (na, zinc)', () => {
    const r = assessSupplyReadiness([], false, TODAY)
    expect(r.level).toBe('na')
    expect(r.tone).toBe('zinc')
  })

  it('mọi PO đã về đủ → ready (green)', () => {
    const r = assessSupplyReadiness([po('received'), po('received')], true, TODAY)
    expect(r.level).toBe('ready')
    expect(r.tone).toBe('green')
    expect(r.receivedCount).toBe(2)
    expect(r.activeCount).toBe(2)
  })

  it('đã đặt nhưng chưa về đủ → inflight (sky)', () => {
    const r = assessSupplyReadiness([po('received'), po('in_transit')], true, TODAY)
    expect(r.level).toBe('inflight')
    expect(r.receivedCount).toBe(1)
  })

  it('còn PO chờ duyệt → pending, ưu tiên hơn "đang về"', () => {
    const r = assessSupplyReadiness(
      [po('received'), po('in_transit'), po('pending_approval')],
      true,
      TODAY,
    )
    expect(r.level).toBe('pending')
    expect(r.tone).toBe('amber')
  })

  it('PO đã huỷ bị loại khỏi mọi phép đếm', () => {
    const r = assessSupplyReadiness([po('received'), po('cancelled')], true, TODAY)
    expect(r.level).toBe('ready')
    expect(r.activeCount).toBe(1)
  })

  it('đếm PO quá hẹn (chưa về đủ, hẹn < hôm nay); received không tính quá hẹn', () => {
    const r = assessSupplyReadiness(
      [
        po('in_transit', '2026-07-20'), // quá hẹn
        po('partial', '2026-07-25'), // còn hạn
        po('received', '2026-07-01'), // đã về → không tính
      ],
      true,
      TODAY,
    )
    expect(r.overdueCount).toBe(1)
  })

  it('nextExpected = hẹn về gần nhất trong các PO CHƯA về đủ', () => {
    const r = assessSupplyReadiness(
      [
        po('received', '2026-07-10'), // đã về → bỏ qua
        po('in_transit', '2026-07-28'),
        po('ordered', '2026-07-24'),
      ],
      true,
      TODAY,
    )
    expect(r.nextExpected).toBe('2026-07-24')
  })

  it('không có hẹn giao nào → nextExpected null', () => {
    const r = assessSupplyReadiness(
      [po('ordered', null), po('approved', null)],
      true,
      TODAY,
    )
    expect(r.nextExpected).toBeNull()
  })
})
