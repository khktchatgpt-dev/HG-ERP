import { describe, it, expect } from 'vitest'
import { waitingDays } from './approval-helpers'

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
