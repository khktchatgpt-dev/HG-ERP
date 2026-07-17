import type { DocType } from '@/lib/file-limits'

export type ProductFile = {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  doc_type: DocType | null
}

/**
 * Ảnh SP — thuộc về trình xem ảnh, KHÔNG hiện trong Hồ sơ tài liệu.
 *
 * Định nghĩa nằm một chỗ vì hai panel chia nhau đúng tập file này: hồ sơ hiện
 * `!isProductImage`, trình xem hiện `isProductImage`. Lệch nhau một chút là file
 * biến mất khỏi cả hai, hoặc hiện ở cả hai.
 *
 * `doc_type === null` = file cũ tải lên trước khi có phân loại (0059). Ảnh trong
 * nhóm đó gần như chắc chắn là ảnh SP, nên đưa về trình xem thay vì để nằm lẫn ở
 * tab "Khác". Bản vẽ scan (doc_type 'drawing') dù là PNG vẫn ở tab Bản vẽ — phân
 * loại thắng kiểu MIME.
 */
export function isProductImage(f: ProductFile): boolean {
  if (!f.mime_type.startsWith('image/')) return false
  return f.doc_type === 'image' || f.doc_type === null
}
