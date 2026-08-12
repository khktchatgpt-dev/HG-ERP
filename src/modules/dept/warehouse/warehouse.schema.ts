import { z } from 'zod'
import { PO_TEMPLATES } from '@/lib/po-template'

export const materialCreateSchema = z.object({
  // Bỏ trống → server tự cấp `XX-0000` nối tiếp theo nhóm. Gõ tay mã là một hạng
  // lỗi không cần tồn tại; Kho vẫn khai được tay khi cần bám mã cũ.
  code: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(30).default('cái'),
  // Mã vạch sẵn có của NCC (0078) — quét khớp cả code lẫn barcode, không in tem.
  barcode: z.string().trim().max(64).optional().nullable(),
  // Quy cách (0056) — kích thước/thông số, tự điền vào dòng đơn khi chọn vật tư.
  spec: z.string().trim().max(200).optional().nullable(),
  // Giá đv kép (0053): giá theo 'kg'/'m²'… thay vì ĐVT mua; unit2_factor là hệ số quy đổi tham khảo.
  price_unit: z.string().trim().max(30).optional().nullable(),
  unit2_factor: z.coerce.number().positive().optional().nullable(),
  group_name: z.string().trim().max(100).optional().nullable(),
  // Nhóm phụ (0111) — tầng phân loại thứ hai, 106 nhóm của sổ Cung ứng.
  sub_group: z.string().trim().max(100).optional().nullable(),
  min_stock: z.coerce.number().min(0).default(0),
  // Bù tồn (0043, nghiệp vụ ①): trần tồn + ngưỡng/lô đặt lại — Kho quản.
  max_stock: z.coerce.number().min(0).optional().nullable(),
  reorder_point: z.coerce.number().min(0).optional().nullable(),
  reorder_qty: z.coerce.number().min(0).optional().nullable(),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  // Tự-điền lên đơn (0055): VAT mặc định, NCC ưu tiên, giá mua gần nhất (gợi ý).
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  default_supplier_id: z.string().uuid().optional().nullable(),
  last_purchase_price: z.coerce.number().min(0).optional().nullable(),
  // Mẫu đơn đặt hàng mặc định của vật tư (0106) — quyết định bộ cột khi soạn đơn.
  po_template: z.enum(PO_TEMPLATES).optional().nullable(),
  // Nhôm: kg/m và chiều dài cây mặc định — mẫu đơn nhôm tự tính tổng kg từ đây.
  kg_per_m: z.coerce.number().min(0).optional().nullable(),
  kg_per_unit: z.coerce.number().min(0).optional().nullable(),
  default_bar_length_m: z.coerce.number().min(0).optional().nullable(),
  // Đóng gói mua (0124): 1 pack_unit = pack_size ĐVT gốc (vd 1 bì = 500 con) —
  // form đặt gợi ý SL tròn bao. Vật liệu/màu: cột "Vật liệu" của đơn phụ kiện.
  pack_size: z.coerce.number().positive().optional().nullable(),
  pack_unit: z.string().trim().max(30).optional().nullable(),
  material_grade: z.string().trim().max(100).optional().nullable(),
  // Thông số theo nhóm (0137): bao bì (cách mở + SP/thùng) và kim loại (màu/
  // bề mặt) — trước chỉ nhớ được từ lần đặt gần nhất, vật tư mới thì gõ tay.
  open_style: z.string().trim().max(20).optional().nullable(),
  pcs_per_ctn: z.coerce.number().positive().optional().nullable(),
  finish: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  /**
   * Cờ "CHỜ KHO RÀ" (0136) — form khai nhanh trong đơn đặt gửi true: người khai
   * đang vội soạn đơn, Kho rà lại sau (đối chiếu trùng, bổ sung barem/kệ). Form
   * danh mục không gửi → mặc định false. PATCH {needs_review:false} = đã rà.
   */
  needs_review: z.coerce.boolean().optional(),
})

/** Dò tên gần giống lúc khai vật tư (0124) — cùng phạm vi nhóm với chặn cứng. */
export const materialSimilarQuerySchema = z.object({
  name: z.string().trim().min(3).max(200),
  group_name: z.string().trim().max(100).optional(),
})

export const materialUpdateSchema = materialCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const materialListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  group_name: z.string().trim().max(100).optional(),
  active_only: z.coerce.boolean().default(false),
  /** true = chỉ vật tư "chờ Kho rà" (khai nhanh từ form đơn — 0136). */
  needs_review: z.coerce.boolean().optional(),
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

// ── Phiếu kho nhiều dòng (0017 warehouse_docs) ─────────────────────────────

/** Dòng phiếu nhập: theo dòng PO (po_line_id) hoặc mua ngoài (không có). */
export const receiptDocLineSchema = z.object({
  material_id: z.string().uuid(),
  qty: z.coerce.number().positive(), // số ĐẠT vào tồn
  qty_rejected: z.coerce.number().min(0).default(0), // QC loại — KHÔNG vào tồn (BR-10)
  qc_status: z.enum(['pass', 'partial', 'fail']).optional(),
  po_line_id: z.string().uuid().optional().nullable(),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

/** Phiếu nhập kho (PNK — FR-WMS-02/03/04). */
export const receiptDocSchema = z
  .object({
    po_id: z.string().uuid().optional().nullable(), // nhập theo đơn đặt (null = mua ngoài)
    counterparty: z.string().trim().max(200).optional().nullable(), // người giao (mẫu 01-VT)
    note: z.string().trim().max(2000).optional().nullable(),
    // Nhận VƯỢT số còn thiếu của đơn: mặc định chặn (409 OVER_RECEIPT). NCC giao
    // dư là chuyện có thật — người nhận xác nhận thì gửi lại kèm cờ + lý do
    // (ghi vào ghi chú phiếu). Cùng lối với override_reserved của phiếu xuất.
    allow_over: z.coerce.boolean().default(false),
    over_reason: z.string().trim().max(500).optional().nullable(),
    lines: z.array(receiptDocLineSchema).min(1, 'Phiếu phải có ít nhất 1 dòng').max(200),
  })
  .refine((d) => !d.allow_over || !!d.over_reason?.trim(), {
    message: 'Nhận vượt số còn thiếu phải kèm lý do',
    path: ['over_reason'],
  })

export const issueDocLineSchema = z.object({
  material_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

/** Phiếu xuất kho (PXK — FR-WMS-05/06). BR-09: xuất theo LSX phải gắn LSX. */
export const issueDocSchema = z
  .object({
    kind: z.enum(['lsx', 'daily']),
    production_order_id: z.string().uuid().optional().nullable(),
    counterparty: z.string().trim().max(200).optional().nullable(), // người nhận (mẫu 02-VT)
    reason: z.string().trim().max(500).optional().nullable(), // lý do xuất
    note: z.string().trim().max(2000).optional().nullable(),
    // Lấn phần tồn đang GIỮ cho LSX khác: mặc định chặn (409 RESERVED_CONFLICT).
    // Người dùng xác nhận vẫn xuất → gửi lại kèm cờ + lý do (ghi vào ghi chú phiếu).
    override_reserved: z.coerce.boolean().default(false),
    override_reason: z.string().trim().max(500).optional().nullable(),
    lines: z.array(issueDocLineSchema).min(1, 'Phiếu phải có ít nhất 1 dòng').max(200),
  })
  .refine((d) => d.kind !== 'lsx' || !!d.production_order_id, {
    message: 'BR-09: xuất theo LSX phải chọn LSX',
  })
  .refine((d) => !d.override_reserved || !!d.override_reason?.trim(), {
    message: 'Xuất vượt khả dụng phải kèm lý do',
    path: ['override_reason'],
  })

/** Dòng phiếu TRẢ HÀNG NCC (0080): gắn dòng PO đã về, trả ≤ số đã về. */
export const returnDocLineSchema = z.object({
  material_id: z.string().uuid(),
  po_line_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional().nullable(),
})

/** Phiếu trả hàng NCC (⑤): phiếu xuất 02-VT, movement out gắn po_line_id. */
export const returnDocSchema = z.object({
  po_id: z.string().uuid(),
  reason: z.string().trim().min(1, 'Trả hàng phải kèm lý do').max(500),
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(returnDocLineSchema).min(1, 'Phiếu phải có ít nhất 1 dòng').max(200),
})

/** Dòng kiểm kê: số ĐẾM THỰC TẾ — tồn sổ server tự đọc lại lúc ghi (0077). */
export const stocktakeDocLineSchema = z.object({
  material_id: z.string().uuid(),
  counted_qty: z.coerce.number().min(0),
  note: z.string().trim().max(500).optional().nullable(),
})

/** Phiếu kiểm kê (KK — 0077): biên bản mọi dòng đã đếm; dòng lệch sinh movement adjust. */
export const stocktakeDocSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(), // định kỳ / đột xuất…
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(stocktakeDocLineSchema)
    .min(1, 'Phiếu kiểm kê phải có ít nhất 1 dòng')
    .max(1000)
    .refine(
      (lines) => new Set(lines.map((l) => l.material_id)).size === lines.length,
      'Vật tư bị trùng dòng',
    ),
})

export const docListQuerySchema = z.object({
  kind: z.enum(['receipt', 'issue', 'transfer', 'stocktake']).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
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
