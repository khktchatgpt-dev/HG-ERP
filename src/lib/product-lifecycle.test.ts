import { describe, it, expect } from 'vitest'
import { flagsFor, requiresReason, isLifecycle, LIFECYCLES } from './product-lifecycle'

/**
 * Trạng thái hồ sơ là nguồn duy nhất người dùng chạm vào (0145), còn các cờ cũ
 * được ghi theo. Hai luật dưới đây sai là thư viện SP hiện nhầm: SP ngừng dùng
 * vẫn nằm trong danh sách đang dùng, hoặc SP chưa duyệt mẫu lại gắn cờ đã chốt.
 */

describe('flagsFor', () => {
  it('chỉ "ngừng dùng" mới tắt is_active', () => {
    for (const s of LIFECYCLES) {
      expect(flagsFor(s).is_active).toBe(s !== 'discontinued')
    }
  })

  it('cờ chốt mẫu bật từ chặng "đã duyệt mẫu" và giữ khi đang sản xuất', () => {
    expect(flagsFor('draft').sample_confirmed).toBe(false)
    expect(flagsFor('review').sample_confirmed).toBe(false)
    expect(flagsFor('approved').sample_confirmed).toBe(true)
    expect(flagsFor('production').sample_confirmed).toBe(true)
  })

  it('ngừng dùng thì gỡ luôn cờ chốt mẫu — hồ sơ không còn dùng để chạy hàng', () => {
    expect(flagsFor('discontinued').sample_confirmed).toBe(false)
  })
})

describe('requiresReason', () => {
  it('đi tới thì không bắt lý do', () => {
    expect(requiresReason('draft', 'review')).toBe(false)
    expect(requiresReason('approved', 'production')).toBe(false)
  })

  it('đi lùi thì bắt lý do', () => {
    expect(requiresReason('approved', 'draft')).toBe(true)
    expect(requiresReason('production', 'review')).toBe(true)
    // Gỡ khỏi "ngừng dùng" cũng là lùi — phải nói vì sao dùng lại.
    expect(requiresReason('discontinued', 'production')).toBe(true)
  })
})

describe('isLifecycle', () => {
  it('chặn giá trị lạ từ URL / body', () => {
    expect(isLifecycle('production')).toBe(true)
    expect(isLifecycle('Production')).toBe(false)
    expect(isLifecycle(null)).toBe(false)
  })
})
