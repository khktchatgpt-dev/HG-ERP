import { db } from '@/server/db'
import type { FileBucket } from './files.schema'
import { SignedUrlCache } from './signed-url-cache'

/**
 * 1 giờ. Trước đây là 60s, gây 2 vấn đề: (1) URL nhúng trong HTML server-render
 * hết hạn ngay khi user để trang mở quá 1 phút — nặng nhất ở trang in, user
 * chỉnh khổ giấy xong là ảnh 403; (2) token đổi mỗi render nên cache trình duyệt
 * không bao giờ trúng → mỗi lượt xem tải lại toàn bộ ảnh gốc.
 * Đánh đổi: URL lỡ rò rỉ sẽ sống 1 giờ thay vì 1 phút. Chấp nhận được với ERP nội bộ.
 */
const SIGNED_GET_TTL_SECONDS = 60 * 60

const urlCache = new SignedUrlCache()

/**
 * Hạn THẬT của URL ký — đọc claim `exp` trong token JWT thay vì tự cộng
 * `Date.now() + ttl`. Lý do: Supabase xác thực bằng ĐỒNG HỒ CỦA NÓ; nếu máy
 * chạy app lệch giờ / ngủ đông giữa chừng, cache tính theo giờ local sẽ giữ
 * URL "tươi giả" trong khi Supabase đã coi hết hạn (InvalidJWT exp) — ảnh vỡ
 * hàng loạt. Không đọc được token → fallback cách tính cũ.
 */
export function signedUrlExpiryMs(signedUrl: string, fallbackMs: number): number {
  const m = signedUrl.match(/token=([^&]+)/)
  if (!m) return fallbackMs
  try {
    const payload = JSON.parse(
      Buffer.from(m[1].split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : fallbackMs
  } catch {
    return fallbackMs
  }
}

export const storage = {
  async createSignedUploadUrl(
    bucket: FileBucket,
    path: string,
  ): Promise<{ uploadUrl: string; token: string }> {
    const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path)
    if (error || !data) throw new Error(error?.message ?? 'signed upload failed')
    return { uploadUrl: data.signedUrl, token: data.token }
  },

  /**
   * Đẩy thẳng byte từ SERVER lên Storage — dùng khi file được sinh/bóc ở server
   * chứ không do trình duyệt PUT (vd ảnh nhúng bóc ra từ file Excel báo giá).
   * Luồng 3 bước (init → PUT → finalize) không áp được vì không có client PUT.
   */
  async uploadBuffer(
    bucket: FileBucket,
    path: string,
    body: Buffer,
    contentType: string,
    opts: { upsert?: boolean } = {},
  ): Promise<void> {
    const { error } = await db()
      .storage.from(bucket)
      .upload(path, body, { contentType, upsert: opts.upsert ?? false })
    if (error) throw new Error(error.message)
  },

  /**
   * URL ký sẵn để tải file, kèm thời điểm hết hạn. Cache theo (bucket, path) nên
   * các lần render trong cùng vòng đời token trả về **đúng một URL** — xem
   * `signed-url-cache.ts` để biết vì sao điều đó quan trọng với chi phí egress.
   */
  /**
   * `downloadAs` đặt `Content-Disposition: attachment; filename="…"` trên URL ký.
   *
   * Cần vì ĐƯỜNG DẪN trên Storage đã bị `sanitizeFilename` lột sạch dấu tiếng
   * Việt (đúng — tránh rắc rối mã hoá ở tầng lưu trữ), nên nếu mở thẳng URL thì
   * trình duyệt lấy tên từ đường dẫn và lưu ra "BOM_MERXX_Gh_5_b_c_Ferrara.xlsx".
   * Tên đẹp vẫn nằm nguyên ở cột `files.filename` — trả nó lại qua header này.
   *
   * CHỈ dùng cho nút tải xuống. Ảnh và PDF xem trực tiếp phải để trống, không
   * thì `<img>` / `<iframe>` biến thành tải file.
   */
  async createSignedDownloadUrl(
    bucket: FileBucket,
    path: string,
    ttlSeconds = SIGNED_GET_TTL_SECONDS,
    downloadAs?: string,
  ): Promise<{ url: string; expiresAt: number }> {
    const now = Date.now()
    const key = SignedUrlCache.key(bucket, path, downloadAs)
    const hit = urlCache.get(key, now)
    if (hit) return { url: hit.url, expiresAt: hit.expiresAt }

    const { data, error } = await db()
      .storage.from(bucket)
      .createSignedUrl(path, ttlSeconds)
    if (error || !data) throw new Error(error?.message ?? 'signed url failed')

    /**
     * Tự nối `download` thay vì dùng option `{ download }` của supabase-js.
     *
     * KHÔNG phải sở thích: `createSignedUrl` của SDK mã hoá tên file bằng
     * `URLSearchParams` (ra `Gh%E1%BA%BF`) rồi bọc TOÀN BỘ url trong
     * `encodeURI()`, khiến mọi dấu `%` bị mã hoá lần nữa thành `%25E1%25BA%25BF`.
     * Kết quả là trình duyệt lưu ra tên "Gh%E1%BA%BF 5 b%E1%BA%ADc…" — hỏng
     * đúng cái ta đang đi sửa. Nối tay thì chỉ mã hoá một lần, và cũng không
     * còn phụ thuộc vào việc SDK bao giờ vá lỗi đó.
     */
    const signedUrl = downloadAs
      ? `${data.signedUrl}&download=${encodeURIComponent(downloadAs)}`
      : data.signedUrl

    const expiresAt = signedUrlExpiryMs(signedUrl, now + ttlSeconds * 1000)
    urlCache.set(key, signedUrl, expiresAt, now)
    return { url: signedUrl, expiresAt }
  },

  /**
   * Ký NHIỀU path trong 1 lần gọi (`createSignedUrls`) — dùng cho thư viện SP
   * nạp N ảnh/lần tải: trước đây N lần `createSignedUrl` → giờ 1 round-trip cho
   * các path chưa cache. Tôn trọng cache theo (bucket, path) như bản đơn.
   */
  async createSignedDownloadUrls(
    bucket: FileBucket,
    paths: string[],
    ttlSeconds = SIGNED_GET_TTL_SECONDS,
  ): Promise<Map<string, { url: string; expiresAt: number }>> {
    const now = Date.now()
    const out = new Map<string, { url: string; expiresAt: number }>()
    const misses: string[] = []
    for (const path of paths) {
      if (out.has(path) || misses.includes(path)) continue
      const hit = urlCache.get(SignedUrlCache.key(bucket, path), now)
      if (hit) out.set(path, { url: hit.url, expiresAt: hit.expiresAt })
      else misses.push(path)
    }
    if (misses.length > 0) {
      const { data, error } = await db()
        .storage.from(bucket)
        .createSignedUrls(misses, ttlSeconds)
      if (error) throw new Error(error.message)
      const fallback = now + ttlSeconds * 1000
      for (const item of data ?? []) {
        if (item.error || !item.signedUrl || !item.path) continue
        const expiresAt = signedUrlExpiryMs(item.signedUrl, fallback)
        urlCache.set(
          SignedUrlCache.key(bucket, item.path),
          item.signedUrl,
          expiresAt,
          now,
        )
        out.set(item.path, { url: item.signedUrl, expiresAt })
      }
    }
    return out
  },

  /** Bỏ URL đã cache — gọi khi object bị xoá/ghi đè để không trả URL chết. */
  invalidateSignedUrl(bucket: FileBucket, path: string): void {
    urlCache.delete(SignedUrlCache.key(bucket, path))
  },

  /**
   * Đọc N BYTE ĐẦU của object — để soi chữ ký định dạng (magic number) mà không
   * phải kéo cả file 50MB về server. Dùng HTTP Range trên URL ký; Storage của
   * Supabase hỗ trợ Range nên chỉ tốn đúng chừng ấy byte.
   *
   * null = không đọc được (object chưa có, mạng lỗi, host không trả Range) —
   * chỗ gọi tự quyết định coi đó là "không kiểm được" chứ không phải "file xấu".
   */
  async readHead(
    bucket: FileBucket,
    path: string,
    bytes: number,
  ): Promise<Uint8Array | null> {
    try {
      const { url } = await this.createSignedDownloadUrl(bucket, path)
      const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } })
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    } catch {
      return null
    }
  },

  /** Dung lượng THẬT của object trên Storage (byte), null nếu object chưa tồn tại. */
  async getObjectSize(bucket: FileBucket, path: string): Promise<number | null> {
    const { data, error } = await db().storage.from(bucket).info(path)
    if (error || !data) return null
    return typeof data.size === 'number' ? data.size : null
  },

  async remove(bucket: FileBucket, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await db().storage.from(bucket).remove(paths)
    if (error) throw new Error(error.message)
  },
}
