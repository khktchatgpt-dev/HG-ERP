import { describe, expect, it } from 'vitest'
import { SignedUrlCache } from './signed-url-cache'

const HOUR = 60 * 60 * 1000
const MARGIN = 60_000

describe('SignedUrlCache', () => {
  it('trả cùng một URL khi còn hạn — đây là lý do cache tồn tại', () => {
    const cache = new SignedUrlCache()
    const now = 1_000_000
    cache.set('attachments:a.png', 'https://x/a?token=1', now + HOUR, now)

    // Render lần 2, 5 phút sau: phải ra ĐÚNG URL cũ, không phải token mới.
    // URL đổi = cache key trình duyệt đổi = tải lại ảnh gốc.
    expect(cache.get('attachments:a.png', now + 5 * 60_000)?.url).toBe(
      'https://x/a?token=1',
    )
  })

  it('miss khi chưa có key', () => {
    const cache = new SignedUrlCache()
    expect(cache.get('attachments:missing.png', 0)).toBeNull()
  })

  it('coi là hết hạn sớm hơn hạn thật đúng bằng safety margin', () => {
    const cache = new SignedUrlCache()
    const now = 0
    const expiresAt = now + HOUR
    cache.set('b:1', 'url', expiresAt, now)

    // Ngay trước mốc margin: vẫn dùng được.
    expect(cache.get('b:1', expiresAt - MARGIN - 1)).not.toBeNull()
    // Đúng mốc margin: coi như hết, để client không cầm URL chết trên tay.
    expect(cache.get('b:1', expiresAt - MARGIN)).toBeNull()
  })

  it('dọn entry hết hạn khỏi Map chứ không chỉ trả null', () => {
    const cache = new SignedUrlCache()
    cache.set('b:1', 'url', HOUR, 0)
    expect(cache.size).toBe(1)
    cache.get('b:1', HOUR) // quá hạn
    expect(cache.size).toBe(0)
  })

  it('delete bỏ đúng một entry, không đụng entry khác', () => {
    const cache = new SignedUrlCache()
    cache.set('b:1', 'u1', HOUR, 0)
    cache.set('b:2', 'u2', HOUR, 0)
    cache.delete('b:1')
    expect(cache.get('b:1', 0)).toBeNull()
    expect(cache.get('b:2', 0)?.url).toBe('u2')
  })

  it('không vượt trần entry — chặn rò rỉ bộ nhớ', () => {
    const cache = new SignedUrlCache(3)
    for (let i = 0; i < 10; i++) cache.set(`b:${i}`, `u${i}`, HOUR, 0)
    expect(cache.size).toBeLessThanOrEqual(3)
  })

  it('evict ưu tiên entry đã hết hạn trước khi đụng entry còn hạn', () => {
    const cache = new SignedUrlCache(2)
    const now = 10 * HOUR
    cache.set('stale', 'u-stale', now - HOUR, now - 2 * HOUR) // đã hết hạn
    cache.set('fresh', 'u-fresh', now + HOUR, now)
    cache.set('newest', 'u-newest', now + HOUR, now) // vượt trần → phải dọn 'stale'

    expect(cache.get('stale', now)).toBeNull()
    expect(cache.get('fresh', now)?.url).toBe('u-fresh')
    expect(cache.get('newest', now)?.url).toBe('u-newest')
  })

  it('ghi lại key đã có thì cập nhật giá trị, không nhân đôi entry', () => {
    const cache = new SignedUrlCache()
    cache.set('b:1', 'old', HOUR, 0)
    cache.set('b:1', 'new', 2 * HOUR, 0)
    expect(cache.size).toBe(1)
    expect(cache.get('b:1', 0)?.url).toBe('new')
  })

  it('key gộp bucket + path — cùng path khác bucket là 2 entry', () => {
    expect(SignedUrlCache.key('attachments', 'a/b.png')).not.toBe(
      SignedUrlCache.key('private', 'a/b.png'),
    )
  })
})
