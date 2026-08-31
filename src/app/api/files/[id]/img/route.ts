import { handle, BadRequest, NotFound } from '@/server/http'
import { filesRepo } from '@/modules/core/files/files.repo'
import { storage } from '@/modules/core/files/storage'
import { verifyImageSig } from '@/server/file-image'

type Params = { params: Promise<{ id: string }> }

/** Ảnh RASTER trình duyệt vẽ được — khớp nhóm ảnh trong `ALLOWED_MIME`. */
const RASTER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/**
 * ẢNH qua ĐƯỜNG DẪN CỐ ĐỊNH — nguồn cho `next/image`.
 *
 * Xem `@/server/file-image` để biết vì sao không gác bằng phiên đăng nhập mà
 * bằng chữ ký trong URL (tóm tắt: trình tối ưu ảnh gọi từ server, không có
 * cookie) và vì sao việc đó không nới lỏng bảo mật.
 *
 * ĐỌC BYTE QUA ĐÂY chứ không redirect sang URL ký của Storage: chuyển hướng ra
 * host ngoài thì trình tối ưu lại phải khớp `remotePatterns`, và URL đích vẫn
 * mang token đổi liên tục — đúng thứ đang gây tốn tiền. Chi phí truyền byte
 * không đáng lo vì sau bản vá này mỗi ảnh chỉ đi qua đây một lần rồi nằm trong
 * cache của trình tối ưu.
 */
export const GET = handle(async (req: Request, { params }: Params) => {
  const { id } = await params
  const sig = new URL(req.url).searchParams.get('s') ?? ''
  if (!verifyImageSig(id, sig)) throw NotFound('File not found')

  const file = await filesRepo.getById(id)
  if (!file || file.deleted_at) throw NotFound('File not found')
  /*
   * Chỉ phục vụ ảnh: đường này không gác phiên nên không được thành lối tải
   * trộm tài liệu (BOM, bản vẽ, chứng từ).
   *
   * DANH SÁCH ĐÍCH DANH chứ không `startsWith('image/')` (siết 31/08/2026):
   * `image/` có cả những thứ KHÔNG phải ảnh xem được — `image/vnd.dwg`,
   * `image/vnd.dxf`, `image/vnd.adobe.photoshop` là tên MIME chính thức của bản
   * vẽ CAD và file Photoshop. Lỡ gán một trong số đó cho tài liệu là bản vẽ
   * thành thứ ai cầm link cũng tải được. `EXT_CANONICAL_MIME` đã cố tình tránh
   * tiền tố `image/`, nhưng chặn ở đúng chỗ phục vụ thì không phụ thuộc vào
   * việc người sau có nhớ quy ước đó không.
   */
  if (!RASTER_MIME.has(file.mime_type)) throw BadRequest('Không phải ảnh')

  const { url } = await storage.createSignedDownloadUrl(file.bucket, file.path)
  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) throw NotFound('Không đọc được ảnh')

  return new Response(upstream.body, {
    headers: {
      'content-type': file.mime_type,
      // Ảnh là BẤT BIẾN: đổi ảnh = file mới = id mới, nội dung sau id này không
      // bao giờ đổi. Nhờ vậy trình tối ưu giữ bản đã resize được lâu nhất có thể.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
})
