import { z } from 'zod'
import { FRAME_MATERIAL_CODES, PRODUCT_TYPE_CODES } from '@/lib/product-code'

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
  // Nhãn khách/nhóm gõ tự do (0091) — Kỹ thuật KHÔNG chọn từ danh mục khách của
  // Kinh doanh nữa. null/rỗng = mẫu chung.
  customer_name: z.string().trim().max(200).optional().nullable(),
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

/** Xin mã kế tiếp cho form tạo SP — loại + vật liệu khung theo quy tắc đã chốt. */
export const productNextCodeQuerySchema = z.object({
  type: z.enum(PRODUCT_TYPE_CODES as unknown as [string, ...string[]]),
  material: z.enum(FRAME_MATERIAL_CODES as unknown as [string, ...string[]]),
})

export const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().optional(),
  /** Nhãn khách gõ tự do; '__common' = chưa gắn nhãn nào. */
  customer_name: z.string().trim().max(200).optional(),
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

/**
 * Một dòng ĐỊNH MỨC của hồ sơ sản phẩm (0092) — tự mô tả vật tư bằng quy cách,
 * KHÔNG khoá ngoại sang kho. `group_code` để FK sang technical_part_groups (0093)
 * kiểm, nên ở đây chỉ cần là chuỗi.
 */
export const productPartCreateSchema = z.object({
  group_code: z.string().trim().min(1).max(40),
  part_name: z.string().trim().min(1).max(300),
  // Thông tin KHỐI định mức (0095) — tiêu đề mang thông số thật (mật độ mút,
  // gỗ + FSC, mã bao bì), `unit_basis` nói định mức tính trên đơn vị nào.
  section_title: z.string().trim().max(300).optional().nullable(),
  unit_basis: z.string().trim().max(40).optional().nullable(),
  material_note: z.string().trim().max(200).optional().nullable(),
  tenon: z.string().trim().max(100).optional().nullable(),
  set_item_label: z.string().trim().max(100).optional().nullable(),
  part_no: z.coerce.number().int().optional().nullable(),
  // Quy cách vật tư — mã chuẩn hoá dạng text để sau này nối sang kho.
  material_code: z.string().trim().max(80).optional().nullable(),
  material_kind: z.string().trim().max(10).optional().nullable(),
  profile_shape: z.string().trim().max(20).optional().nullable(),
  profile_code: z.string().trim().max(30).optional().nullable(),
  dim_a_mm: z.coerce.number().min(0).optional().nullable(),
  dim_b_mm: z.coerce.number().min(0).optional().nullable(),
  wall_thickness_mm: z.coerce.number().min(0).optional().nullable(),
  cut_length_mm: z.coerce.number().min(0).optional().nullable(),
  qty: z.coerce.number().positive(),
  unit: z.string().trim().max(30).optional().nullable(),
  waste_pct: z.coerce.number().min(0).max(100).default(0),
  // Đại lượng dẫn xuất: app tính từ hình học (src/lib/bom-calc.ts), người dùng
  // ghi đè được — profile gân / hợp kim lạ thì số hình học không đúng.
  weight_kg: z.coerce.number().min(0).optional().nullable(),
  total_length_m: z.coerce.number().min(0).optional().nullable(),
  paint_area_m2: z.coerce.number().min(0).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
})

export const productPartUpdateSchema = productPartCreateSchema.partial()

export type ProductPartInput = z.infer<typeof productPartCreateSchema>
export type ProductPartPatch = z.infer<typeof productPartUpdateSchema>

/**
 * Nhập NHIỀU dòng định mức một lượt (lưới nhập / dán từ Excel).
 *
 * Tiêu đề khối, đơn vị tính, nhóm và món trong bộ khai MỘT LẦN cho cả lô —
 * đúng cách biểu mẫu BOM tổ chức, và đỡ phải gõ lại ở từng dòng.
 */
export const productPartsBulkSchema = z.object({
  group_code: z.string().trim().min(1).max(40),
  section_title: z.string().trim().max(300).optional().nullable(),
  unit_basis: z.string().trim().max(40).optional().nullable(),
  set_item_label: z.string().trim().max(100).optional().nullable(),
  lines: z
    .array(
      z.object({
        part_no: z.coerce.number().int().optional().nullable(),
        part_name: z.string().trim().min(1).max(300),
        material_kind: z.string().trim().max(10).optional().nullable(),
        profile_shape: z.string().trim().max(20).optional().nullable(),
        profile_code: z.string().trim().max(30).optional().nullable(),
        material_code: z.string().trim().max(80).optional().nullable(),
        material_note: z.string().trim().max(200).optional().nullable(),
        tenon: z.string().trim().max(100).optional().nullable(),
        dim_a_mm: z.coerce.number().min(0).optional().nullable(),
        dim_b_mm: z.coerce.number().min(0).optional().nullable(),
        wall_thickness_mm: z.coerce.number().min(0).optional().nullable(),
        cut_length_mm: z.coerce.number().min(0).optional().nullable(),
        qty: z.coerce.number().positive(),
        unit: z.string().trim().max(30).optional().nullable(),
        waste_pct: z.coerce.number().min(0).max(100).default(0),
        weight_kg: z.coerce.number().min(0).optional().nullable(),
        note: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(300),
})

/**
 * Chép định mức từ một sản phẩm khác — cách kỹ thuật thực sự dựng định mức mới
 * (ghế biến thể chỉ khác vài dòng so với ghế gốc).
 *
 *   mode 'append'  thêm vào cuối, giữ nguyên định mức đang có
 *   mode 'replace' xoá sạch định mức hiện tại rồi chép sang
 */
export const productPartsCopySchema = z.object({
  source_product_id: z.string().uuid(),
  mode: z.enum(['append', 'replace']).default('append'),
  /** Bỏ trống = chép mọi nhóm. */
  groups: z.array(z.string().trim().min(1).max(40)).optional(),
})

/** Nhân bản mẫu cũ cho khách khác (FR-ENG-02) — copy thuộc tính + BOM. */
export const productCloneSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200).optional(), // mặc định giữ tên gốc
  customer_name: z.string().trim().max(200).optional().nullable(),
  customer_item_code: z.string().trim().max(100).optional().nullable(),
})
