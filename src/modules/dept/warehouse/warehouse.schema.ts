import { z } from 'zod'

export const materialCreateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(30).default('cái'),
  // Mã vạch sẵn có của NCC (0078) — quét khớp cả code lẫn barcode, không in tem.
  barcode: z.string().trim().max(64).optional().nullable(),
  // Quy cách (0056) — kích thước/thông số, tự điền vào dòng đơn khi chọn vật tư.
  spec: z.string().trim().max(200).optional().nullable(),
  // Loại quy đổi A/B/C (0055) — trường lái form đặt hàng (ItemMaster §2).
  conversion_profile: z.enum(['A', 'B', 'C']).default('A'),
  // Giá đv kép (0053): giá theo 'kg'/'m²'… thay vì ĐVT mua; factor là hệ số (B) / định mức kg (C).
  price_unit: z.string().trim().max(30).optional().nullable(),
  unit2_factor: z.coerce.number().positive().optional().nullable(),
  group_name: z.string().trim().max(100).optional().nullable(),
  min_stock: z.coerce.number().min(0).default(0),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  // Tự-điền lên đơn (0055): VAT mặc định, NCC ưu tiên, giá mua gần nhất (gợi ý).
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  default_supplier_id: z.string().uuid().optional().nullable(),
  last_purchase_price: z.coerce.number().min(0).optional().nullable(),
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
export const receiptDocSchema = z.object({
  po_id: z.string().uuid().optional().nullable(), // nhập theo đơn đặt (null = mua ngoài)
  counterparty: z.string().trim().max(200).optional().nullable(), // người giao (mẫu 01-VT)
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(receiptDocLineSchema).min(1, 'Phiếu phải có ít nhất 1 dòng').max(200),
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
    lines: z.array(issueDocLineSchema).min(1, 'Phiếu phải có ít nhất 1 dòng').max(200),
  })
  .refine((d) => d.kind !== 'lsx' || !!d.production_order_id, {
    message: 'BR-09: xuất theo LSX phải chọn LSX',
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
