import { describe, expect, it } from 'vitest'
import { extractKitApi } from '../../../../scripts/kit-api-lib.mjs'
import committed from './kit-api.json'

/**
 * BẢNG THUỘC TÍNH KHÔNG ĐƯỢC CŨ HƠN MÃ (B7). Trang tài liệu đọc `kit-api.json`
 * đã commit; sửa prop trong kit mà quên sinh lại thì trang nói sai IM LẶNG. Test
 * này trích lại từ mã và so — lệch là đỏ, kèm đúng câu lệnh phải chạy.
 */
describe('kit-api.json', () => {
  it('khớp mã nguồn kit hiện tại', { timeout: 60_000 }, () => {
    const fresh = extractKitApi()
    expect(
      JSON.stringify(fresh),
      'kit-api.json cũ hơn mã kit — chạy `npm run kit:api` rồi commit file sinh ra',
    ).toBe(JSON.stringify(committed))
  })
})
