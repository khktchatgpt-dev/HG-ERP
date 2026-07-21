/**
 * Fixed-window rate limiter, in-memory.
 *
 * Đủ dùng khi deploy 1 instance Node (hiện tại). Nếu chuyển sang serverless /
 * nhiều instance thì mỗi instance đếm riêng — lúc đó thay bằng Upstash/Redis
 * nhưng giữ nguyên interface consume/reset này.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
// Chặn map phình vô hạn nếu bị quét key lạ — quá ngưỡng thì dọn bucket hết hạn.
const MAX_BUCKETS = 10_000

export type RateLimitResult = {
  ok: boolean
  /** Số lượt còn lại trong window (0 khi đã bị chặn). */
  remaining: number
  /** Khi bị chặn: còn bao nhiêu giây nữa window mới reset. */
  retryAfterSec: number
}

export function consumeRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweepExpired(now)
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.limit - 1, retryAfterSec: 0 }
  }

  bucket.count += 1
  if (bucket.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }
  return { ok: true, remaining: opts.limit - bucket.count, retryAfterSec: 0 }
}

/** Xoá bucket (vd: login thành công thì tha các lần sai trước đó). */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
