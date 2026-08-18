import { handle, BadRequest, NotFound } from '@/server/http'
import { filesRepo } from '@/modules/core/files/files.repo'
import { storage } from '@/modules/core/files/storage'
import { verifyImageSig } from '@/server/file-image'

type Params = { params: Promise<{ id: string }> }

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
  // Chỉ phục vụ ảnh: đường này không gác phiên nên không được thành lối tải
  // trộm tài liệu (BOM, bản vẽ, chứng từ).
  if (!file.mime_type.startsWith('image/')) throw BadRequest('Không phải ảnh')

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
