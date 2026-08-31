import { api } from '@/lib/api'
import { formatBytes, isAllowedMime, maxBytesFor, type DocType } from '@/lib/file-limits'
import { canonicalMime, extensionIssue } from '@/lib/file-signature'
import { downscaleImage } from '@/lib/image-downscale'

/**
 * sha256 của file — gửi kèm lúc finalize để (1) dò trùng: 71 nhóm file trùng
 * nhau đang chiếm 323MB kho, (2) biết file có hỏng dọc đường không.
 *
 * Đọc cả file vào bộ nhớ nên chỉ băm file vừa phải; file lớn bỏ qua checksum
 * còn hơn làm treo tab của người dùng.
 */
const CHECKSUM_MAX_BYTES = 20 * 1024 * 1024

export async function sha256Hex(file: File): Promise<string | undefined> {
  if (file.size > CHECKSUM_MAX_BYTES) return undefined
  try {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return undefined // crypto.subtle chỉ có ở ngữ cảnh bảo mật — không chặn upload vì nó
  }
}

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
 * PUT lên Storage kèm % tiến trình.
 *
 * Phải dùng XMLHttpRequest chứ không phải `fetch`: fetch không báo được tiến độ
 * PHÁT đi (chỉ có `ReadableStream` cho chiều nhận). Với file 12MB trên đường
 * truyền công ty, người dùng nhìn nút đứng im cả phút mà không biết còn bao lâu.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Tải lên thất bại (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Mất kết nối khi đang tải file lên'))
    xhr.onabort = () => reject(new Error('Đã huỷ tải lên'))
    xhr.send(file)
  })
}

/**
 * Upload 1 file vào 1 parent theo 3 bước (init → PUT signed URL → finalize),
 * có báo % ở bước PUT (bước chiếm gần hết thời gian).
 */
export async function uploadFileTracked(
  file: File,
  parent: UploadParent,
  bucket: 'private' | 'attachments' | 'public',
  docType: UploadDocType | null,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (docType === 'image') file = await downscaleImage(file)
  const extIssue = extensionIssue(file.name)
  if (extIssue) throw new Error(extIssue)
  // Soát MIME ngay ở client để báo câu dễ hiểu, khỏi tốn một vòng gọi API. Chuẩn
  // hoá theo đuôi trước — .dwg/.psd… trình duyệt khai lung tung (xem canonicalMime).
  if (!isAllowedMime(canonicalMime(file.name, file.type))) {
    throw new Error(
      `Máy bạn khai file này là "${file.type || 'không rõ định dạng'}" — hệ thống không nhận kiểu đó.`,
    )
  }
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
      doc_type: docType,
      parent,
    },
  })
  await putWithProgress(init.uploadUrl, file, onProgress)
  const checksum = await sha256Hex(file)
  await api(`/api/files/${init.fileId}/finalize`, {
    method: 'POST',
    body: checksum ? { checksum } : {},
  })
  return init.fileId
}

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
  // Ảnh chụp tự thu nhỏ về ≤2560px trước — đưa ảnh máy ảnh 13MB vào vẫn lọt
  // trần 5MB thay vì dội lỗi bắt user tự resize. Chỉ ảnh; tài liệu giữ nguyên.
  if (docType === 'image') file = await downscaleImage(file)
  // Chặn ngay ở client để user biết sớm, khỏi tốn công PUT rồi mới bị finalize
  // từ chối. Ràng buộc thật vẫn nằm ở server (filesService.finalize).
  const extIssue = extensionIssue(file.name)
  if (extIssue) throw new Error(extIssue)
  // Soát MIME ngay ở client để báo câu dễ hiểu, khỏi tốn một vòng gọi API. Chuẩn
  // hoá theo đuôi trước — .dwg/.psd… trình duyệt khai lung tung (xem canonicalMime).
  if (!isAllowedMime(canonicalMime(file.name, file.type))) {
    throw new Error(
      `Máy bạn khai file này là "${file.type || 'không rõ định dạng'}" — hệ thống không nhận kiểu đó.`,
    )
  }
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
  const checksum = await sha256Hex(file)
  await api(`/api/files/${init.fileId}/finalize`, {
    method: 'POST',
    body: checksum ? { checksum } : {},
  })
  return init.fileId
}
