import { z } from 'zod'
import { canonicalMime, extensionIssue } from '@/lib/file-signature'
import {
  ALLOWED_MIME,
  isAllowedMime,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  DOC_TYPE_MAX_BYTES,
  DEFAULT_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  maxBytesFor,
  type DocType,
} from '@/lib/file-limits'

// Bảng giới hạn + DOC_TYPES + nhãn sống ở @/lib/file-limits để client dùng chung
// được (Client Component không import được từ src/modules/*). Re-export để các
// chỗ đang `import … from './files.schema'` không phải đổi.
export {
  ALLOWED_MIME,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  DOC_TYPE_MAX_BYTES,
  DEFAULT_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  maxBytesFor,
}
export type { DocType }

export const FILE_BUCKETS = ['private', 'attachments', 'public'] as const
export type FileBucket = (typeof FILE_BUCKETS)[number]

export const PARENT_KINDS = [
  'task',
  'comment',
  'customer',
  'invoice',
  'product',
  'quote',
  'sales_order',
  'production_order',
  'purchase_order', // hồ sơ mua hàng gắn PO (FR-SUP-07)
  'sample', // ảnh 4 góc của từng mẫu showroom (0061)
  'none',
] as const
export type FileParentKind = (typeof PARENT_KINDS)[number]

export const initUploadSchema = z
  .object({
    filename: z.string().min(1).max(255),
    /*
     * KHÔNG còn `z.enum(ALLOWED_MIME)` ở đây (31/08/2026).
     *
     * Trình duyệt đoán MIME từ registry của MÁY NGƯỜI DÙNG, nên `.dwg` ra
     * `''` / `application/acad` / `image/vnd.dwg` tuỳ máy — enum chặn sạch cả
     * ba, và ngăn "Bản vẽ" của hồ sơ SP vì thế có đúng 0 file suốt từ 0059.
     * Giờ MIME được chuẩn hoá theo ĐUÔI trước (`canonicalMime`) rồi mới soát ở
     * `superRefine`, và câu từ chối là câu người đọc được thay vì một mảng enum.
     */
    mime_type: z.string().max(255),
    size_bytes: z.number().int().positive(),
    bucket: z.enum(FILE_BUCKETS),
    doc_type: z.enum(DOC_TYPES).optional().nullable(), // phân loại tài liệu (0059)
    parent: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('task'), id: z.uuid() }),
      z.object({ kind: z.literal('comment'), id: z.uuid() }),
      z.object({ kind: z.literal('customer'), id: z.uuid() }),
      z.object({ kind: z.literal('invoice'), id: z.uuid() }),
      z.object({ kind: z.literal('product'), id: z.uuid() }),
      z.object({ kind: z.literal('quote'), id: z.uuid() }),
      z.object({ kind: z.literal('sales_order'), id: z.uuid() }),
      z.object({ kind: z.literal('production_order'), id: z.uuid() }),
      z.object({ kind: z.literal('purchase_order'), id: z.uuid() }),
      z.object({ kind: z.literal('sample'), id: z.uuid() }),
      z.object({ kind: z.literal('none') }),
    ]),
  })
  .superRefine((input, ctx) => {
    const max = maxBytesFor(input.doc_type)
    if (input.size_bytes > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['size_bytes'],
        message: `${describeDocType(input.doc_type)} tối đa ${formatBytes(max)}`,
      })
    }
    // Soát ĐUÔI file, không chỉ MIME: MIME là thứ trình duyệt đoán, còn đuôi là
    // thứ người dùng nhìn thấy và cũng là thứ Windows dùng để chọn phần mềm mở.
    // Chặn .xlsm/.exe ngay tại biên API — xem lib/file-signature.
    const extIssue = extensionIssue(input.filename)
    if (extIssue) {
      ctx.addIssue({ code: 'custom', path: ['filename'], message: extIssue })
      return // đuôi đã hỏng thì đừng bắt lỗi MIME nữa, một câu là đủ
    }
    if (!isAllowedMime(canonicalMime(input.filename, input.mime_type))) {
      ctx.addIssue({
        code: 'custom',
        path: ['mime_type'],
        message: `Máy bạn khai file này là "${input.mime_type || 'không rõ định dạng'}" — hệ thống không nhận kiểu đó. Kiểm lại xem file có đúng đuôi không.`,
      })
    }
  })
  // Chốt MIME theo ĐUÔI trước khi xuống service/DB: cột `files.mime_type` còn
  // được dùng làm `content-type` lúc phục vụ file, lưu chuỗi rỗng là trình
  // duyệt không biết mở bằng gì.
  .transform((input) => ({
    ...input,
    mime_type: canonicalMime(input.filename, input.mime_type),
  }))
export type InitUploadInput = z.infer<typeof initUploadSchema>

function describeDocType(docType: DocType | null | undefined): string {
  return docType ? DOC_TYPE_LABEL[docType] : 'File chưa phân loại'
}

export const finalizeUploadSchema = z.object({
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'sha256 hex')
    .optional(),
})
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>
