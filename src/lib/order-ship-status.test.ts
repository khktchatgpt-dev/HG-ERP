import { describe, it, expect } from 'vitest'
import {
  baseStatus,
  deliveryShortfall,
  shipCapacity,
  shipStatus,
  tolerance,
} from './order-ship-status'

describe('shipStatus — trạng thái suy từ Σ đợt xuất (D4, 07/10/2026)', () => {
  it('chưa xuất gì → giữ trạng thái nền', () => {
    expect(shipStatus('lsx_issued', 0, 100, null)).toBe('lsx_issued')
    expect(shipStatus('completed', 0, 100, 10)).toBe('completed')
  })
  it('xuất một phần → partially_shipped, kể cả khi lệnh chưa xong (LAURA 16 đợt)', () => {
    expect(shipStatus('lsx_issued', 30, 100, null)).toBe('partially_shipped')
    expect(shipStatus('completed', 89, 100, 10)).toBe('partially_shipped')
  })
  it('xuất đủ → shipped; dung sai 10% thì 90/100 là đủ', () => {
    expect(shipStatus('completed', 100, 100, null)).toBe('shipped')
    expect(shipStatus('completed', 90, 100, 10)).toBe('shipped')
    expect(shipStatus('lsx_issued', 105, 100, 10)).toBe('shipped')
  })
  it('đơn tổng 0 (chưa có dòng) → nền', () => {
    expect(shipStatus('confirmed', 5, 0, null)).toBe('confirmed')
  })
})

describe('shipCapacity — còn được xuất bao nhiêu (có dung sai)', () => {
  it('không dung sai: đúng số còn lại', () => {
    expect(shipCapacity(100, 30, null)).toBe(70)
    expect(shipCapacity(100, 100, 0)).toBe(0)
  })
  it('dung sai +10%: xuất quá SL đơn tới 110', () => {
    expect(shipCapacity(100, 100, 10)).toBe(10)
    expect(shipCapacity(100, 110, 10)).toBe(0)
  })
  it('dung sai lạ (âm, >100, NaN) → coi như 0 hoặc trần 100', () => {
    expect(tolerance(-5)).toBe(0)
    expect(tolerance(150)).toBe(100)
    expect(tolerance(Number.NaN)).toBe(0)
  })
})

describe('baseStatus — trạng thái nền khi gỡ hết đợt xuất', () => {
  it('đang ở nền thì giữ nguyên', () => {
    expect(baseStatus('lsx_issued', 'approved', true)).toBe('lsx_issued')
    expect(baseStatus('completed', 'completed', true)).toBe('completed')
  })
  it('đang partially_shipped → về theo lệnh', () => {
    expect(baseStatus('partially_shipped', 'completed', true)).toBe('completed')
    expect(baseStatus('shipped', 'in_progress', true)).toBe('lsx_issued')
    expect(baseStatus('partially_shipped', 'pending_approval', true)).toBe('lsx_pending')
    expect(baseStatus('partially_shipped', null, false)).toBe('confirmed')
  })
})

describe('deliveryShortfall — giao thiếu bao nhiêu so với mức đủ', () => {
  it('đủ (có dung sai) → 0', () => {
    expect(deliveryShortfall(100, 100, null)).toBe(0)
    expect(deliveryShortfall(90, 100, 10)).toBe(0)
  })
  it('thiếu → số còn thiếu tới mức đủ', () => {
    expect(deliveryShortfall(70, 100, null)).toBe(30)
    expect(deliveryShortfall(70, 100, 10)).toBe(20)
  })
})
