import { describe, expect, it } from 'vitest'
import { consumeRateLimit, resetRateLimit } from './rate-limit'

const OPTS = { limit: 3, windowMs: 60_000 }
const T0 = 1_000_000

describe('consumeRateLimit', () => {
  it('cho qua đủ limit lượt trong window', () => {
    const key = 'k:allow'
    expect(consumeRateLimit(key, OPTS, T0)).toEqual({
      ok: true,
      remaining: 2,
      retryAfterSec: 0,
    })
    expect(consumeRateLimit(key, OPTS, T0 + 1000).ok).toBe(true)
    expect(consumeRateLimit(key, OPTS, T0 + 2000)).toEqual({
      ok: true,
      remaining: 0,
      retryAfterSec: 0,
    })
  })

  it('chặn lượt vượt limit và trả retryAfterSec đếm ngược tới hết window', () => {
    const key = 'k:block'
    for (let i = 0; i < 3; i++) consumeRateLimit(key, OPTS, T0)
    const blocked = consumeRateLimit(key, OPTS, T0 + 10_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSec).toBe(50) // (60s window - 10s trôi qua)
  })

  it('window hết hạn thì đếm lại từ đầu', () => {
    const key = 'k:expire'
    for (let i = 0; i < 4; i++) consumeRateLimit(key, OPTS, T0)
    expect(consumeRateLimit(key, OPTS, T0).ok).toBe(false)
    const after = consumeRateLimit(key, OPTS, T0 + 61_000)
    expect(after).toEqual({ ok: true, remaining: 2, retryAfterSec: 0 })
  })

  it('resetRateLimit xoá bucket ngay lập tức', () => {
    const key = 'k:reset'
    for (let i = 0; i < 4; i++) consumeRateLimit(key, OPTS, T0)
    expect(consumeRateLimit(key, OPTS, T0).ok).toBe(false)
    resetRateLimit(key)
    expect(consumeRateLimit(key, OPTS, T0).ok).toBe(true)
  })

  it('key khác nhau đếm độc lập', () => {
    for (let i = 0; i < 4; i++) consumeRateLimit('k:a', OPTS, T0)
    expect(consumeRateLimit('k:a', OPTS, T0).ok).toBe(false)
    expect(consumeRateLimit('k:b', OPTS, T0).ok).toBe(true)
  })
})
