import { z } from 'zod'
import {
  DOC_TYPES,
  DOC_TYPE_MAX_BYTES,
  DEFAULT_MAX_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  maxBytesFor,
  type DocType,
} from '@/lib/file-limits'

// Bảng giới hạn + DOC_TYPES sống ở @/lib/file-limits để client dùng chung được
// (Client Component không import được từ src/modules/*). Re-export để các chỗ
// đang `import … from './files.schema'` không phải đổi.
export {
  DOC_TYPES,
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

/**
 * Nhãn tiếng Việt của loại tài liệu (0059) — để tách mục rõ ràng thay vì 1 rổ
 * phẳng. null (không gửi) = chưa phân loại → UI xếp vào "Khác".
 */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  drawing: 'Bản vẽ kỹ thuật',
  bom: 'File BOM / định mức',
  assembly: 'Hướng dẫn lắp ráp',
  image: 'Ảnh sản phẩm',
  cert: 'Chứng chỉ / test report',
  other: 'Khác',
}

export const ALLOWED_MIME = [
  // images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // docs
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // text
  'text/plain',
  'text/csv',
  'application/json',
  // archives
  'application/zip',
] as const

export const initUploadSchema = z
  .object({
    filename: z.string().min(1).max(255),
    mime_type: z.enum(ALLOWED_MIME),
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
  })
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
