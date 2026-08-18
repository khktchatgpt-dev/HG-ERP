import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * URL ẢNH ỔN ĐỊNH cho `next/image`.
 *
 * VÌ SAO CÓ FILE NÀY — chuyện tiền: Vercel tính phí tối ưu ảnh theo TỪNG URL
 * NGUỒN DUY NHẤT. Trước đây `src` là URL ký của Supabase, mang `?token=` đổi mỗi
 * lần ký; mà bộ đệm URL ký nằm trong RAM của từng lambda nên trên Vercel gần như
 * mỗi lượt render là ký lại. Kết quả: cùng một tấm ảnh bị tối ưu lại (và tính
 * tiền lại) gần như mỗi lần mở trang — 24 thẻ/trang × mỗi lượt xem. Đường dẫn ở
 * đây cố định vĩnh viễn theo `fileId`, nên mỗi ảnh chỉ tối ưu ĐÚNG MỘT LẦN.
 *
 * VÌ SAO KÝ HMAC CHỨ KHÔNG DÙNG COOKIE: trình tối ưu ảnh của Next gọi URL này từ
 * SERVER (`/_next/image?url=…`), không mang theo cookie phiên của người xem —
 * gác bằng `requireUser()` là ảnh vỡ hết. Chữ ký nằm sẵn trong URL nên xác thực
 * được mà không cần phiên.
 *
 * VỀ MỨC ĐỘ LỘ: đây là URL-năng-lực (ai có link thì xem được), KHÔNG yếu hơn
 * hiện trạng — bản đã tối ưu mà Vercel phát ra (`/_next/image?url=…`) vốn đã nằm
 * trên CDN công khai không cần đăng nhập. Chữ ký chỉ chặn việc dò id để moi file
 * bừa. Chỉ dùng cho ẢNH; tài liệu (BOM, bản vẽ, chứng từ) vẫn đi
 * `/api/files/[id]` có gác phiên như cũ.
 */

/** Cắt ngắn cho URL gọn — 128 bit vẫn quá đủ để không dò được. */
const SIG_LEN = 32

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET missing or too short (need ≥32 chars)')
  }
  return s
}

/**
 * Chữ ký của một file. Tiền tố `img:` để chữ ký này KHÔNG dùng lại được cho mục
 * đích khác nếu sau này có thêm loại URL ký bằng cùng secret.
 */
export function imageSig(fileId: string): string {
  return createHmac('sha256', secret())
    .update(`img:${fileId}`)
    .digest('hex')
    .slice(0, SIG_LEN)
}

/** So sánh chống rò rỉ thời gian; độ dài lệch thì `timingSafeEqual` sẽ ném. */
export function verifyImageSig(fileId: string, sig: string): boolean {
  const want = Buffer.from(imageSig(fileId))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

/**
 * `src` để đưa thẳng vào `next/image`. Đường dẫn TƯƠNG ĐỐI và tất định — đó
 * chính là thứ khiến khoá cache của Vercel đứng yên.
 */
export function fileImageSrc(fileId: string): string {
  return `/api/files/${fileId}/img?s=${imageSig(fileId)}`
}

/** Dựng `src` cho nhiều file một lượt (lưới sản phẩm). Bỏ qua id rỗng. */
export function fileImageSrcMap(
  fileIds: (string | null | undefined)[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of fileIds) if (id && !out[id]) out[id] = fileImageSrc(id)
  return out
}
