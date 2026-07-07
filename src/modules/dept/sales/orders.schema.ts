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

/** Tạo đơn TỪ BÁO GIÁ ĐÃ DUYỆT (BR-04) — dòng SP snapshot từ báo giá ở service. */
export const orderCreateSchema = z.object({
  quote_id: z.string().uuid(),
  customer_po_no: z.string().trim().max(100).optional().nullable(), // PO# của khách — in trên LSX
  due_date: z.string().date().optional().nullable(),
  deposit_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(), // "1 x 40'HC"
  note: z.string().trim().max(2000).optional().nullable(),
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
