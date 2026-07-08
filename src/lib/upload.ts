import { api } from '@/lib/api'

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
  | { kind: 'none' }

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * Upload 1 file vào 1 parent theo 3 bước (init → PUT signed URL → finalize).
 * Trả về fileId. Dùng cho upload lập trình (ảnh SP, file đơn tạo trước khi có id).
 */
export async function uploadFile(
  file: File,
  parent: UploadParent,
  bucket: 'private' | 'attachments' | 'public' = 'attachments',
): Promise<string> {
  const init = await api<{ fileId: string; uploadUrl: string }>('/api/files', {
    method: 'POST',
    body: {
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      bucket,
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
