import { describe, it, expect } from 'vitest'
import { money, moneyByCurrency, waitingDays } from './approval-helpers'

/*
 * 14/08/2026 — file này từng phủ thêm waitingTone / isBulkApprovable /
 * comparePending / matchesFilter / summarizeBulk. Các hàm đó đã xoá cùng
 * ApprovalCockpit; phần việc của chúng chuyển sang `execService.signBox`
 * (đã có test riêng ở src/modules/core/exec/exec.service.test.ts) và cờ
 * `SignItem.big`.
 */

const NOW = '2026-07-20T10:00:00Z'

describe('waitingDays', () => {
  it('đếm số ngày trọn đã chờ', () => {
    expect(waitingDays('2026-07-20T09:00:00Z', NOW)).toBe(0)
    expect(waitingDays('2026-07-18T10:00:00Z', NOW)).toBe(2)
    expect(waitingDays('2026-07-16T09:00:00Z', NOW)).toBe(4)
  })
  it('created_at ở tương lai → 0 (không âm)', () => {
    expect(waitingDays('2026-07-25T00:00:00Z', NOW)).toBe(0)
  })
  it('ngày không hợp lệ → 0', () => {
    expect(waitingDays('not-a-date', NOW)).toBe(0)
  })
})

describe('money — luôn kèm mã tiền tệ', () => {
  it('VND làm tròn về đồng, USD giữ 2 số lẻ', () => {
    expect(money(50_000_000, 'VND')).toBe('50.000.000 VND')
    expect(money(3_000.5, 'USD')).toBe('3.000,5 USD')
  })
  it('không bao giờ in "₫" trần — bản cũ in ₫ cho cả đơn USD', () => {
    expect(money(3_000, 'USD')).not.toContain('₫')
    expect(money(3_000, 'USD')).toContain('USD')
  })
})

describe('moneyByCurrency — không cộng chung hai loại tiền', () => {
  it('cộng theo từng tiền tệ rồi nối lại', () => {
    expect(
      moneyByCurrency([
        { value: 1_000, currency: 'USD' },
        { value: 500, currency: 'USD' },
        { value: 2_000_000, currency: 'VND' },
      ]),
    ).toBe('1.500 USD · 2.000.000 VND')
  })
  it('bỏ nhánh 0 đồng', () => {
    expect(
      moneyByCurrency([
        { value: 0, currency: 'VND' },
        { value: 800, currency: 'USD' },
      ]),
    ).toBe('800 USD')
  })
  it('chưa có đơn giá (mọi giá trị 0) → "—", không phải "0 USD"', () => {
    expect(moneyByCurrency([{ value: 0, currency: 'USD' }])).toBe('—')
    expect(moneyByCurrency([])).toBe('—')
  })
})
