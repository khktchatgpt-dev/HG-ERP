import { z } from 'zod'

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
  'none',
] as const
export type FileParentKind = (typeof PARENT_KINDS)[number]

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

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

export const initUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.enum(ALLOWED_MIME),
  size_bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  bucket: z.enum(FILE_BUCKETS),
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
    z.object({ kind: z.literal('none') }),
  ]),
})
export type InitUploadInput = z.infer<typeof initUploadSchema>

export const finalizeUploadSchema = z.object({
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'sha256 hex')
    .optional(),
})
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>
