import { z } from 'zod'

export const ORDER_STATUSES = [
  'confirmed',
  'lsx_issued',
  'in_production',
  'completed',
  'delivered',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderLineInputSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  note: z.string().trim().max(500).optional().nullable(),
})

/**
 * Tạo đơn — 2 cách:
 *  - TỪ BÁO GIÁ đã chốt: gửi `quote_id`, dòng SP + điều khoản snapshot từ báo giá.
 *  - TRỰC TIẾP (không báo giá): gửi `customer_id` + `lines` (≥1), tuỳ chọn
 *    currency/price_term/payment_terms. Đơn là bản ghi của sale, mốc phát LSX.
 */
export const orderCreateSchema = z
  .object({
    quote_id: z.string().uuid().optional().nullable(),
    // Chỉ dùng khi KHÔNG có quote_id:
    customer_id: z.string().uuid().optional().nullable(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    price_term: z.string().trim().max(100).optional().nullable(),
    payment_terms: z.string().trim().max(500).optional().nullable(),
    lines: z
      .array(orderLineInputSchema)
      .max(200)
      .refine(
        (lines) => new Set(lines.map((l) => l.product_id)).size === lines.length,
        'Sản phẩm bị trùng dòng',
      )
      .optional(),
    // Header dùng chung cho cả 2 cách:
    customer_po_no: z.string().trim().max(100).optional().nullable(), // PO# của khách — in trên LSX
    due_date: z.string().date().optional().nullable(),
    deposit_percent: z.coerce.number().min(0).max(100).optional().nullable(),
    container_summary: z.string().trim().max(100).optional().nullable(), // "1 x 40'HC"
    note: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((o) => !!o.quote_id || !!o.customer_id, {
    message: 'Chọn báo giá, hoặc chọn khách hàng để tạo đơn trực tiếp',
    path: ['customer_id'],
  })
  .refine((o) => !!o.quote_id || (o.lines?.length ?? 0) >= 1, {
    message: 'Đơn không từ báo giá phải có ít nhất 1 dòng sản phẩm',
    path: ['lines'],
  })

/** Cập nhật khi khách thay đổi (FR-SAL-05) — mọi thay đổi được ghi lịch sử. */
export const orderUpdateSchema = z.object({
  customer_po_no: z.string().trim().max(100).optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  deposit_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  price_term: z.string().trim().max(100).optional().nullable(),
  payment_terms: z.string().trim().max(500).optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  change_note: z.string().trim().max(1000).optional().nullable(), // lý do khách đổi
  lines: z
    .array(orderLineInputSchema)
    .min(1, 'Đơn hàng phải còn ít nhất 1 dòng sản phẩm')
    .max(200)
    .refine(
      (lines) => new Set(lines.map((l) => l.product_id)).size === lines.length,
      'Sản phẩm bị trùng dòng',
    )
    .optional(), // không gửi lines = chỉ sửa header
})

export const orderListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customer_id: z.string().uuid().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Huỷ đơn phải kèm lý do').max(1000),
})
