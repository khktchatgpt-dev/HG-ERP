/**
 * Cache signed URL theo (bucket, path) để URL **ổn định giữa các lần render**.
 *
 * Vì sao cần: signed URL của Supabase mang token mới mỗi lần ký. URL được nhúng
 * vào HTML server-render, nên nếu mỗi render ra một URL khác thì cache key của
 * trình duyệt cũng khác → ảnh bị tải lại từ đầu mỗi lượt xem, dù Supabase đã
 * trả `Cache-Control: max-age=3600`. Giữ nguyên URL trong suốt vòng đời token
 * làm cache trình duyệt (và cache của Next Image optimizer) trúng trở lại.
 *
 * Đây là cache in-memory theo tiến trình. Trên serverless mỗi instance giữ cache
 * riêng và mất khi instance bị thu hồi — chấp nhận được, vì miss chỉ tốn thêm
 * một lần ký URL (rẻ), không ảnh hưởng tính đúng đắn.
 */

export type SignedUrlCacheEntry = { url: string; expiresAt: number }

export class SignedUrlCache {
  private readonly entries = new Map<string, SignedUrlCacheEntry>()

  constructor(
    /** Trần số entry, chặn rò rỉ bộ nhớ khi có nhiều file. */
    private readonly maxEntries = 5_000,
    /**
     * Trả URL sớm hơn hạn thật ngần này để người nhận còn kịp dùng. Không có nó,
     * một URL còn 1 giây vẫn được coi là hợp lệ và sẽ hết hạn ngay trên tay client.
     */
    private readonly safetyMarginMs = 60_000,
  ) {}

  static key(bucket: string, path: string): string {
    return `${bucket}:${path}`
  }

  /** URL còn hạn (đã trừ safety margin), hoặc null nếu cần ký lại. */
  get(key: string, now: number): SignedUrlCacheEntry | null {
    const hit = this.entries.get(key)
    if (!hit) return null
    if (hit.expiresAt - this.safetyMarginMs <= now) {
      this.entries.delete(key)
      return null
    }
    return hit
  }

  set(key: string, url: string, expiresAt: number, now: number): void {
    // Ghi lại key cũ phải xoá trước để insertion order phản ánh "mới nhất",
    // nếu không entry cũ sẽ giữ nguyên vị trí và bị evict sai thứ tự.
    this.entries.delete(key)
    this.entries.set(key, { url, expiresAt })
    this.evict(now)
  }

  private evict(now: number): void {
    if (this.entries.size <= this.maxEntries) return
    for (const [k, v] of this.entries) {
      if (v.expiresAt <= now) this.entries.delete(k)
    }
    // Vẫn quá trần sau khi dọn hạn → bỏ entry cũ nhất (Map giữ insertion order).
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  /** Chỉ dùng trong test. */
  get size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }
}
