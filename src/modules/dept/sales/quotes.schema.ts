import { z } from 'zod'

// Vòng đời báo giá (0149 — exec v3): duyệt GĐ là TUỲ CHỌN, Sale tự quyết báo
// giá nào cần trình.
//   draft ─"Chốt & gửi khách"────────────────────────► sent
//   draft ─"Trình GĐ"─► pending_approval ─► approved ─► sent
//                                  └──────► rejected ─(sửa, trình lại)─► pending_approval
// draft/rejected: sửa được · pending_approval trở đi: bất biến · sent: tạo được đơn.
// 0225 (07/10/2026): thêm KẾT CỤC + BẢN SỬA ĐỔI —
//   sent ─"Tạo đơn"─► won · sent ─"Thua"─► lost · sent/approved ─"Bản sửa đổi"─► superseded
//   draft/rejected/sent ─"Huỷ"─► cancelled. won/lost/superseded/cancelled: bất biến.
export const QUOTE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'sent',
  'superseded',
  'won',
  'lost',
  'cancelled',
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/** GĐ duyệt / từ chối báo giá — từ chối bắt buộc lý do (giống PO/LSX). */
export const quoteDecideSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision === 'approve' || !!d.reason?.trim(), {
    message: 'Nhập lý do từ chối',
    path: ['reason'],
  })

// Báo giá KHÔNG có số lượng — chỉ quy cách SP (từ Kỹ thuật) + đơn giá + CK.
// Số lượng thuộc về Đơn hàng, nhập ở bước tạo đơn.
export const quoteLineInputSchema = z.object({
  product_id: z.string().uuid(),
  /** SL dự kiến / MOQ (tuỳ chọn, 0225) — để in và nạp sẵn sang đơn; không bắt buộc. */
  qty: z.coerce.number().positive().optional().nullable(),
  unit_price: z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).optional().nullable(),
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

/** Đánh dấu THUA — lý do bắt buộc (học được vì sao mất đơn). */
export const quoteLostSchema = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do thua').max(1000),
})

/** Nhân bản sang khách khác (hoặc cùng khách, mùa sau) — thành nháp mới bản 1. */
export const quoteCopySchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
})

export const quoteListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customer_id: z.string().uuid().optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})
