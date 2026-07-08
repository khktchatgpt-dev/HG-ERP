import { z } from 'zod'

// Báo giá là hồ sơ riêng của Sales — KHÔNG qua Giám đốc duyệt.
// draft: đang soạn (sửa/xoá được) · sent: đã chốt & gửi khách (bất biến, tạo được đơn).
export const QUOTE_STATUSES = ['draft', 'sent'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const quoteLineInputSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  note: z.string().trim().max(500).optional().nullable(),
})

const quoteBaseSchema = z.object({
  customer_id: z.string().uuid(),
  currency: z.string().trim().toUpperCase().length(3).default('USD'), // bán B2B xuất khẩu — mẫu in FOB Quy Nhon USD
  valid_from: z.string().date().optional().nullable(),
  valid_to: z.string().date().optional().nullable(),
  price_term: z.string().trim().max(100).optional().nullable(), // 'FOB Quy Nhon'
  payment_terms: z.string().trim().max(500).optional().nullable(), // 'L/C at sight'
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(quoteLineInputSchema)
    .max(200)
    .default([])
    .refine(
      (lines) => new Set(lines.map((l) => l.product_id)).size === lines.length,
      'Sản phẩm bị trùng dòng trong báo giá',
    ),
})

export const quoteCreateSchema = quoteBaseSchema.refine(
  (q) => !q.valid_from || !q.valid_to || q.valid_from <= q.valid_to,
  'Hiệu lực: từ ngày phải ≤ đến ngày',
)

/** Chỉ báo giá `draft` được sửa (service chặn) — payload giống create. */
export const quoteUpdateSchema = quoteCreateSchema

export const quoteListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customer_id: z.string().uuid().optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})
