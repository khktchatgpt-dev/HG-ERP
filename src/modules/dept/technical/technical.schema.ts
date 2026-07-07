import { z } from 'zod'

/** Thông số đóng gói xuất khẩu (in trên báo giá — jsonb `packing`). */
export const packingSchema = z.object({
  l_cm: z.coerce.number().positive().optional(),
  w_cm: z.coerce.number().positive().optional(),
  h_cm: z.coerce.number().positive().optional(),
  carton_l_cm: z.coerce.number().positive().optional(),
  carton_w_cm: z.coerce.number().positive().optional(),
  carton_h_cm: z.coerce.number().positive().optional(),
  qty_per_carton: z.coerce.number().int().positive().optional(),
  loading_40hc: z.coerce.number().int().positive().optional(),
})

export const BOM_STATUSES = ['none', 'drawing', 'done'] as const
export type BomStatus = (typeof BOM_STATUSES)[number]

export const productCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(), // null = mẫu chung
  customer_item_code: z.string().trim().max(100).optional().nullable(),
  description_en: z.string().trim().max(2000).optional().nullable(),
  unit: z.string().trim().min(1).max(30).default('cai'),
  packing: packingSchema.optional(),
  drawing_url: z.string().trim().url().optional().or(z.literal('')),
  bom_url: z.string().trim().url().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
  bom_status: z.enum(BOM_STATUSES).optional(), // FR-ENG-05: chưa có / đang vẽ / đã vẽ
  image_file_id: z.string().uuid().optional().nullable(), // ảnh đại diện (in BG/LSX)
})

export const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().optional(),
  customer_id: z.string().uuid().optional(),
  bom_status: z.enum(BOM_STATUSES).optional(),
  active_only: z.coerce.boolean().default(true),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(20),
})

/** BOM per-SP (FR-ENG-04): PUT ghi đè trọn bộ dòng định mức. */
export const bomLineInputSchema = z.object({
  material_id: z.string().uuid(),
  qty_per_unit: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const bomSaveSchema = z.object({
  lines: z
    .array(bomLineInputSchema)
    .max(500)
    .refine(
      (lines) => new Set(lines.map((l) => l.material_id)).size === lines.length,
      'Vật tư bị trùng dòng trong BOM',
    ),
})

/** Nhân bản mẫu cũ cho khách khác (FR-ENG-02) — copy thuộc tính + BOM. */
export const productCloneSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200).optional(), // mặc định giữ tên gốc
  customer_id: z.string().uuid().optional().nullable(),
  customer_item_code: z.string().trim().max(100).optional().nullable(),
})
