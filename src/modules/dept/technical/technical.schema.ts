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
  pack_unit_label: z.string().trim().max(30).optional(), // 'ctn' | 'pallet' — mẫu ghi "20 pcs/pallet"
  nw_kg: z.coerce.number().positive().optional(), // Net weight / carton
  gw_kg: z.coerce.number().positive().optional(), // Gross weight / carton
})

/** Kiểu lắp ráp — hàng nội thất XK: nguyên chiếc hoặc tháo rời (knock-down). */
export const ASSEMBLY_TYPES = ['assembled', 'kd'] as const

/** Thông số sản xuất (in trên LSX — jsonb `tech_spec`). Mặc định của SP. */
export const techSpecSchema = z.object({
  machine: z.string().trim().max(200).optional(), // Máy
  cushion: z.string().trim().max(200).optional(), // Nệm
  paint: z.string().trim().max(200).optional(), // Sơn (mã màu)
  glass: z.string().trim().max(200).optional(), // Kính
  wood: z.string().trim().max(200).optional(), // Gỗ (loại + FSC + mã màu)
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
  notes: z.string().trim().max(2000).optional().nullable(),
  // Thông số kỹ thuật phục vụ LSX / hợp đồng (0026).
  name_foreign: z.string().trim().max(300).optional().nullable(), // tên theo khách (mọi ngôn ngữ)
  shipping_mark: z.string().trim().max(2000).optional().nullable(), // ký mã hiệu in trên thùng
  barcode: z.string().trim().max(50).optional().nullable(),
  showroom_sample: z.boolean().optional(), // mẫu tại showroom
  reference_price: z.coerce.number().min(0).optional().nullable(), // giá tham khảo nội bộ
  tech_spec: techSpecSchema.optional(),
  // Thông tin XK + đặc tính nội thất (0037).
  hs_code: z.string().trim().max(20).optional().nullable(), // mã HS khai hải quan
  origin_country: z.string().trim().max(100).optional().nullable(), // xuất xứ
  material: z.string().trim().max(300).optional().nullable(), // chất liệu chính
  max_load_kg: z.coerce.number().min(0).optional().nullable(), // tải trọng tối đa
  assembly: z.enum(ASSEMBLY_TYPES).optional().nullable(), // nguyên chiếc / KD
  set_contents: z.string().trim().max(500).optional().nullable(), // bộ gồm: "1 bàn + 6 ghế"
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

/**
 * Tạo nhanh sản phẩm từ màn Kinh doanh (báo giá/đơn) — SP mới sale tự điền để
 * quản lý; BOM/thông số để Kỹ thuật bổ sung sau (bom_status mặc định 'none').
 */
export const quickProductCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(30).default('cai'),
  customer_id: z.string().uuid().optional().nullable(),
  customer_item_code: z.string().trim().max(100).optional().nullable(),
  description_en: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  reference_price: z.coerce.number().min(0).optional().nullable(),
  // Quy cách + thông tin XK để in đủ trên báo giá ngay (Kỹ thuật vẫn sửa được sau).
  packing: packingSchema.optional(),
  material: z.string().trim().max(300).optional().nullable(),
  hs_code: z.string().trim().max(20).optional().nullable(),
  origin_country: z.string().trim().max(100).optional().nullable(),
  name_foreign: z.string().trim().max(300).optional().nullable(), // tên theo khách
  shipping_mark: z.string().trim().max(2000).optional().nullable(), // ký mã hiệu (LSX)
})

/** Đặt ảnh đại diện SP (file đã upload vào parent product) — Kinh doanh/Kỹ thuật. */
export const productSetImageSchema = z.object({
  file_id: z.string().uuid(),
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
