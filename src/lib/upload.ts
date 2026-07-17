import { api } from '@/lib/api'
import { formatBytes, maxBytesFor, type DocType } from '@/lib/file-limits'

/** Parent hợp lệ để đính file (khớp files.schema PARENT_KINDS). */
export type UploadParent =
  | { kind: 'task'; id: string }
  | { kind: 'comment'; id: string }
  | { kind: 'customer'; id: string }
  | { kind: 'invoice'; id: string }
  | { kind: 'product'; id: string }
  | { kind: 'quote'; id: string }
  | { kind: 'sales_order'; id: string }
  | { kind: 'production_order'; id: string }
  | { kind: 'purchase_order'; id: string }
  | { kind: 'sample'; id: string }
  | { kind: 'none' }

export { MAX_UPLOAD_BYTES } from '@/lib/file-limits'

/** Loại tài liệu (files.doc_type — 0059). Bỏ trống = chưa phân loại → "Khác". */
export type UploadDocType = DocType

/**
 * Upload 1 file vào 1 parent theo 3 bước (init → PUT signed URL → finalize).
 * Trả về fileId. Dùng cho upload lập trình (ảnh SP, file đơn tạo trước khi có id).
 */
export async function uploadFile(
  file: File,
  parent: UploadParent,
  bucket: 'private' | 'attachments' | 'public' = 'attachments',
  docType?: UploadDocType | null,
): Promise<string> {
  // Chặn ngay ở client để user biết sớm, khỏi tốn công PUT rồi mới bị finalize
  // từ chối. Ràng buộc thật vẫn nằm ở server (filesService.finalize).
  const max = maxBytesFor(docType)
  if (file.size > max) {
    throw new Error(`File ${formatBytes(file.size)} vượt giới hạn ${formatBytes(max)}`)
  }
  const init = await api<{ fileId: string; uploadUrl: string }>('/api/files', {
    method: 'POST',
    body: {
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      bucket,
      doc_type: docType ?? null,
      parent,
    },
  })
  const put = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })
  if (!put.ok) throw new Error(`Upload failed (${put.status})`)
  await api(`/api/files/${init.fileId}/finalize`, { method: 'POST', body: {} })
  return init.fileId
}
