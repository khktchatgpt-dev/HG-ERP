import { describe, expect, it } from 'vitest'
import { khoangKyService } from './khoang-ky.service'

/**
 * Lỗi đã dính 23/10/2026: regex trong `chon` bị mất dấu `\` của `\d` (heredoc nuốt) → không
 * kỳ nào trên URL khớp, mọi màn theo kỳ luôn nhảy về kỳ hiện tại dù người dùng bấm kỳ trước.
 * Chỉ thử nhánh kỳ hợp lệ — nhánh còn lại đọc DB.
 */
describe('khoangKyService.chon', () => {
  it('nhận kỳ hợp lệ trên URL', async () => {
    expect(await khoangKyService.chon('2026-09', '2026-10-23')).toBe('2026-09')
    expect(await khoangKyService.chon('2025-12', '2026-10-23')).toBe('2025-12')
  })
})
