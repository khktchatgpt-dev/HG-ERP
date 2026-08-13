import { z } from 'zod'
import { FRAME_MATERIAL_CODES, PRODUCT_TYPE_CODES } from '@/lib/product-code'

/**
 * Thông số ĐÓNG GÓI xuất khẩu (jsonb `packing`).
 *
 * KHÔNG còn `l_cm/w_cm/h_cm`: kích thước SẢN PHẨM chỉ sống ở cột
 * `length/width/height_mm` (mm) — một nguồn duy nhất, theo quy ước bảng kê
 * quy cách của công ty `(L/D x W x H) mm` (migration 0129). Ở đây chỉ còn số
 * của THÙNG và tải cont. Báo giá/bản in tự quy mm sang cm khi hiển thị
 * (`@/lib/packing-dims`), không lưu thêm bản cm nào nữa.
 */
export const packingSchema = z.object({
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
  /**
   * Phân loại SP — cột thật, KHÁC hai ký tự nằm trong mã.
   *
   * Bỏ trống thì service tự suy từ mã (`parseProductCode`), nên đường tạo nào
   * cũng có phân loại mà không phải khai lại. Chỉ cần gửi tường minh khi mã
   * KHÔNG theo quy tắc (SP mã cũ nhập tay) — lúc đó suy từ mã ra null.
   */
  product_type: z
    .enum(PRODUCT_TYPE_CODES as unknown as [string, ...string[]])
    .optional()
    .nullable(),
  frame_material: z
    .enum(FRAME_MATERIAL_CODES as unknown as [string, ...string[]])
    .optional()
    .nullable(),
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
  // Đặc tính bật/tắt (0092) — quyết định SP đi qua tổ nào. Trước chỉ import BOM
  // ghi được, hồ sơ hiện ra mà không có lối sửa; nay Kỹ thuật chỉnh tay được.
  is_upholstered: z.boolean().optional(), // có nệm / bọc → qua tổ may
  has_glass: z.boolean().optional(),
  is_set: z.boolean().optional(), // bộ nhiều món → ảnh hưởng đóng gói
  /** Mã cũ (C0201HG-IN) — unique khi khác null, xem index ở 0092. */
  code_legacy: z.string().trim().max(100).optional().nullable(),
  /** Khối lượng tịnh CÂN THẬT — khác `frame_weight_kg` (Σ tính từ định mức). */
  net_weight_kg: z.coerce.number().min(0).optional().nullable(),
  /**
   * Kích thước tổng thể (mm). Trước chỉ import BOM ghi được, giao diện không có
   * lối sửa — nên 5 SP có KTSP nhập nhằng (lẫn cm, hoặc chỉ chiều cao gập/mở)
   * không ai điền tay được. Bộ `*_open_mm` là trạng thái MỞ/kéo giãn (0104).
   */
  length_mm: z.coerce.number().min(0).optional().nullable(),
  width_mm: z.coerce.number().min(0).optional().nullable(),
  height_mm: z.coerce.number().min(0).optional().nullable(),
  length_open_mm: z.coerce.number().min(0).optional().nullable(),
  width_open_mm: z.coerce.number().min(0).optional().nullable(),
  height_open_mm: z.coerce.number().min(0).optional().nullable(),
  // Khối kiểm soát tài liệu ISO (HG-QT-07/M02) — xem `SECTIONS.docControl`.
  bom_rev: z.coerce.number().int().min(0).optional().nullable(),
  // Cột `date` của Postgres — chặn chuỗi rác ngay ở biên, đừng để DB ném 22007.
  bom_effective_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')
    .optional()
    .nullable(),
  bom_prepared_by: z.string().trim().max(200).optional().nullable(),
  bom_approved_by: z.string().trim().max(200).optional().nullable(),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
  bom_status: z.enum(BOM_STATUSES).optional(), // FR-ENG-05: chưa có / đang vẽ / đã vẽ
  image_file_id: z.string().uuid().optional().nullable(), // ảnh đại diện (in BG/LSX)
})

/** Xin mã kế tiếp cho form tạo SP — loại + vật liệu khung theo quy tắc đã chốt. */
/**
 * KIỂM SOÁT BẢN DÙNG của hồ sơ SP (0140 — 13/08/2026): chọn file BOM đang
 * dùng, khoá / mở khoá hồ sơ (nút ở header trang chi tiết).
 */
export const productBomFileSchema = z.object({
  /** null = bỏ chọn file đang dùng. */
  file_id: z.string().uuid().nullable(),
})

export const productLockSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
})

/** Mở khoá BẮT lý do — gỡ bản cả xưởng đang dùng thì phải nói vì sao. */
export const productUnlockSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

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
  /*
   * Hai nhóm dưới thêm 07/08/2026: từ khi màn soạn dòng LSX KHÔNG cho sửa thông
   * tin SP nữa, thứ gì lệnh cần mà lúc tạo SP không khai thì về sau phải quay lại
   * hồ sơ SP mới sửa được. `barcode` + `tech_spec` chính là hai chỗ hay thiếu
   * nhất — xem `lsx-line-fill.ts`, chúng nằm trong danh sách "hồ sơ SP đang thiếu".
   */
  barcode: z.string().trim().max(100).optional().nullable(),
  tech_spec: techSpecSchema.optional(),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ô CHỌN SP ở báo giá/đơn — tìm phía server, trả ≤ `limit` dòng cột hẹp.
 *
 * `ids` (CSV uuid) là chế độ NẠP LẠI: form sửa báo giá chỉ cần đúng những SP đang
 * nằm trên dòng, không cần cả thư viện. Uuid gõ sai bị loại im lặng — đây là
 * tham số của máy sinh ra, không phải người nhập.
 */
export const productPickQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customer_id: z.string().uuid().optional(),
  ids: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((s) => {
      if (!s) return undefined
      const ids = s.split(',').filter((x) => UUID_RE.test(x))
      return ids.length > 0 ? ids.slice(0, 200) : undefined
    }),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

/**
 * Kinh doanh BỔ SUNG thông tin SP còn thiếu ngay trên form báo giá — chỉ các
 * trường IN LÊN BÁO GIÁ + nhận diện hàng. KHÔNG có mã SP / tên / BOM / thông số
 * sản xuất: sửa mấy thứ đó là việc của Kỹ thuật.
 */
export const productFillSpecsSchema = z
  .object({
    packing: packingSchema.optional(),
    description_en: z.string().trim().max(2000).optional().nullable(),
    unit: z.string().trim().min(1).max(30).optional(),
    customer_item_code: z.string().trim().max(100).optional().nullable(),
    material: z.string().trim().max(300).optional().nullable(),
    hs_code: z.string().trim().max(20).optional().nullable(),
    origin_country: z.string().trim().max(100).optional().nullable(),
    name_foreign: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có thông tin nào để lưu')

/** Đặt ảnh đại diện SP (file đã upload vào parent product) — Kinh doanh/Kỹ thuật. */
export const productSetImageSchema = z.object({
  file_id: z.string().uuid(),
})

/** BOM per-SP (FR-ENG-04): PUT ghi đè trọn bộ dòng định mức. */
// `bomLineInputSchema` / `bomSaveSchema` ĐÃ BỎ ở 0096 cùng bảng
// technical_bom_lines. Định mức chỉ còn một loại — xem `productPartInputSchema`
// bên dưới, sửa theo từng dòng chứ không ghi đè trọn bộ.

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
  tenon_mm: z.coerce.number().min(0).optional().nullable(),
  /**
   * Cụm — nhận MỘT trong hai: `cluster_id` khi chọn từ danh sách, hoặc
   * `cluster_name` khi gõ tên mới (service tạo cụm rồi gán). Cả hai để trống =
   * dòng RỜI, trực thuộc sản phẩm.
   */
  cluster_id: z.string().uuid().optional().nullable(),
  cluster_name: z.string().trim().max(120).optional().nullable(),
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
  bend_waste_mm: z.coerce.number().min(0).optional().nullable(),
  kg_per_m: z.coerce.number().min(0).optional().nullable(),
  // Quy đổi sang ĐƠN VỊ MUA (0132) — mỗi nhóm chỉ dùng vài trường của mình:
  // khung cần cây, gỗ cần loại, vải cần khổ + hao hụt, tấm cần quy cách tấm.
  wood_species: z.string().trim().max(60).optional().nullable(),
  bar_length_m: z.coerce.number().positive().optional().nullable(),
  pcs_per_bar: z.coerce.number().positive().optional().nullable(),
  roll_width_m: z.coerce.number().positive().optional().nullable(),
  waste_pct: z.coerce.number().min(0).lt(100).optional().nullable(),
  sheet_w_mm: z.coerce.number().positive().optional().nullable(),
  sheet_l_mm: z.coerce.number().positive().optional().nullable(),
  m3_per_sheet: z.coerce.number().positive().optional().nullable(),
  qty: z.coerce.number().positive(),
  unit: z.string().trim().max(30).optional().nullable(),
  color: z.string().trim().max(100).optional().nullable(),
  // Đại lượng dẫn xuất: app tính từ hình học (src/lib/bom-calc.ts), người dùng
  // ghi đè được — profile gân / hợp kim lạ thì số hình học không đúng.
  weight_kg: z.coerce.number().min(0).optional().nullable(),
  total_length_m: z.coerce.number().min(0).optional().nullable(),
  paint_area_m2: z.coerce.number().min(0).optional().nullable(),
  volume_m3: z.coerce.number().min(0).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
})

/**
 * CỤM (`Parts/ Bộ phận`). `qty_per_product` và lộ trình để trống là bình thường
 * — biểu mẫu BOM không có 2 ô đó, chỉ sổ `Tổng TĐ SX` của xưởng mới cần.
 */
export const productClusterCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty_per_product: z.coerce.number().positive().optional().nullable(),
  first_stage: z.string().trim().max(30).optional().nullable(),
  final_stage: z.string().trim().max(30).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
})

export const productClusterUpdateSchema = productClusterCreateSchema.partial()

/**
 * Gom nhiều dòng vào một cụm. `cluster_id: null` = đưa các dòng về RỜI.
 * `cluster_name` = tạo cụm mới rồi gom vào (thao tác "Gom thành cụm…").
 */
export const productPartsAssignClusterSchema = z
  .object({
    part_ids: z.array(z.string().uuid()).min(1).max(500),
    cluster_id: z.string().uuid().nullable().optional(),
    cluster_name: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => !(v.cluster_id && v.cluster_name), {
    message: 'Chọn cụm có sẵn hoặc đặt tên cụm mới, không dùng cả hai',
  })

export const productPartUpdateSchema = productPartCreateSchema.partial()

export type ProductPartInput = z.infer<typeof productPartCreateSchema>
export type ProductPartPatch = z.infer<typeof productPartUpdateSchema>
export type ProductClusterInput = z.infer<typeof productClusterCreateSchema>
export type ProductClusterPatch = z.infer<typeof productClusterUpdateSchema>

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
  lines: z
    .array(
      z.object({
        part_no: z.coerce.number().int().optional().nullable(),
        part_name: z.string().trim().min(1).max(300),
        /** Cột `Parts/ Bộ phận` dán từ Excel — tên cụm, service tự tạo/khớp. */
        cluster_name: z.string().trim().max(120).optional().nullable(),
        material_kind: z.string().trim().max(10).optional().nullable(),
        profile_shape: z.string().trim().max(20).optional().nullable(),
        profile_code: z.string().trim().max(30).optional().nullable(),
        material_code: z.string().trim().max(80).optional().nullable(),
        material_note: z.string().trim().max(200).optional().nullable(),
        tenon: z.string().trim().max(100).optional().nullable(),
        tenon_mm: z.coerce.number().min(0).optional().nullable(),
        dim_a_mm: z.coerce.number().min(0).optional().nullable(),
        dim_b_mm: z.coerce.number().min(0).optional().nullable(),
        wall_thickness_mm: z.coerce.number().min(0).optional().nullable(),
        cut_length_mm: z.coerce.number().min(0).optional().nullable(),
        bend_waste_mm: z.coerce.number().min(0).optional().nullable(),
        kg_per_m: z.coerce.number().min(0).optional().nullable(),
        wood_species: z.string().trim().max(60).optional().nullable(),
        bar_length_m: z.coerce.number().positive().optional().nullable(),
        pcs_per_bar: z.coerce.number().positive().optional().nullable(),
        roll_width_m: z.coerce.number().positive().optional().nullable(),
        waste_pct: z.coerce.number().min(0).lt(100).optional().nullable(),
        sheet_w_mm: z.coerce.number().positive().optional().nullable(),
        sheet_l_mm: z.coerce.number().positive().optional().nullable(),
        m3_per_sheet: z.coerce.number().positive().optional().nullable(),
        qty: z.coerce.number().positive(),
        unit: z.string().trim().max(30).optional().nullable(),
        color: z.string().trim().max(100).optional().nullable(),
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
