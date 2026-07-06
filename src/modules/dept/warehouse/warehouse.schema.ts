import { z } from 'zod'

export const materialCreateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(30).default('cái'),
  group_name: z.string().trim().max(100).optional().nullable(),
  min_stock: z.coerce.number().min(0).default(0),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const materialUpdateSchema = materialCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const materialListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  group_name: z.string().trim().max(100).optional(),
  active_only: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(500),
})

// ── Nhập / Xuất / Tồn ──────────────────────────────────────────────────────

/** Phiếu nhập (FR-WMS-02/04): theo đơn đặt (po) hoặc mua ngoài (external). */
export const receiptSchema = z.object({
  material_id: z.string().uuid(),
  qty: z.coerce.number().positive(), // số ĐẠT nhập kho
  qty_rejected: z.coerce.number().min(0).default(0), // QC không đạt (không vào tồn)
  qc_status: z.enum(['pass', 'partial', 'fail']).optional(),
  ref_type: z.enum(['po', 'external']).default('external'),
  ref_no: z.string().trim().max(60).optional().nullable(),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/** Phiếu xuất (FR-WMS-05/06): theo LSX (lsx) hoặc thường ngày (daily). */
export const issueSchema = z.object({
  material_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  ref_type: z.enum(['lsx', 'daily']).default('daily'),
  ref_no: z.string().trim().max(60).optional().nullable(),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const stockListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  group_name: z.string().trim().max(100).optional(),
  low_only: z.coerce.boolean().default(false), // chỉ vật tư tồn dưới mức tối thiểu
})

export const movementListQuerySchema = z.object({
  material_id: z.string().uuid().optional(),
  direction: z.enum(['in', 'out']).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
})
