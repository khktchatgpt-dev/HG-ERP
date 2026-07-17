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
   * URL ký sẵn để tải file, kèm thời điểm hết hạn. Cache theo (bucket, path) nên
   * các lần render trong cùng vòng đời token trả về **đúng một URL** — xem
   * `signed-url-cache.ts` để biết vì sao điều đó quan trọng với chi phí egress.
   */
  async createSignedDownloadUrl(
    bucket: FileBucket,
    path: string,
    ttlSeconds = SIGNED_GET_TTL_SECONDS,
  ): Promise<{ url: string; expiresAt: number }> {
    const now = Date.now()
    const key = SignedUrlCache.key(bucket, path)
    const hit = urlCache.get(key, now)
    if (hit) return { url: hit.url, expiresAt: hit.expiresAt }

    const { data, error } = await db()
      .storage.from(bucket)
      .createSignedUrl(path, ttlSeconds)
    if (error || !data) throw new Error(error?.message ?? 'signed url failed')

    const expiresAt = now + ttlSeconds * 1000
    urlCache.set(key, data.signedUrl, expiresAt, now)
    return { url: data.signedUrl, expiresAt }
  },

  /** Bỏ URL đã cache — gọi khi object bị xoá/ghi đè để không trả URL chết. */
  invalidateSignedUrl(bucket: FileBucket, path: string): void {
    urlCache.delete(SignedUrlCache.key(bucket, path))
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
