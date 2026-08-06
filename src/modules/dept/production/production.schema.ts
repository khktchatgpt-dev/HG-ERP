import { z } from 'zod'

// Vòng đời: Sales tạo NHÁP → soạn dòng → gửi GĐ duyệt → SX → hoàn thành.
// 'draft' (0117, chốt 06/08/2026): tạo lệnh không làm phiền GĐ ngay — Sales
// soạn dòng/sửa đầu lệnh xong mới `submit`. 'cancelled' = đơn hàng huỷ giữa
// chừng kéo LSX dừng theo (0036, plan P3).
export const LSX_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
] as const
export type LsxStatus = (typeof LSX_STATUSES)[number]

/** GĐ từ chối LSX — bắt buộc lý do. */
export const lsxRejectSchema = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do từ chối').max(1000),
})

/**
 * Sales gửi duyệt lại LSX bị từ chối — cho sửa kèm header (lý do từ chối
 * thường nằm ở chính các trường này). Field không gửi = giữ nguyên.
 */
export const lsxResubmitSchema = z.object({
  ship_date: z.string().date().optional().nullable(),
  received_date: z.string().date().optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/**
 * SỬA THÔNG TIN ĐẦU LỆNH (0117) — trước đây các trường này chỉ sửa được lúc
 * gửi duyệt lại lệnh BỊ TỪ CHỐI; gõ nhầm số lệnh hay đổi hạn xuất thì không có
 * đường sửa. Field không gửi = giữ nguyên.
 *
 * KHÔNG cho đổi khách hàng ở đây: mọi đơn trong lệnh phải cùng khách (0113,
 * trigger DB chặn) — đổi khách = tạo lệnh khác.
 */
export const lsxHeaderUpdateSchema = z.object({
  code: z.string().trim().min(1, 'Nhập số lệnh').max(50).optional(),
  priority: z.number().int().min(0).max(9).optional(),
  ship_date: z.string().date().optional().nullable(),
  received_date: z.string().date().optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/** Spec sản xuất per dòng LSX (OI-11: Sales nhập khi phát, override tech_spec SP). */
export const lsxLineSpecSchema = z.object({
  order_line_id: z.string().uuid(),
  specs: z
    .object({
      machine: z.string().trim().max(200),
      cushion: z.string().trim().max(200),
      paint: z.string().trim().max(200),
      glass: z.string().trim().max(200),
      wood: z.string().trim().max(200),
    })
    .partial(),
  note: z.string().trim().max(1000).optional().nullable(),
  important_note: z.string().trim().max(1000).optional().nullable(),
})
export const lsxSpecsSaveSchema = z.object({
  lines: z.array(lsxLineSpecSchema).max(500),
})

export const issueLsxSchema = z.object({
  code: z.string().trim().min(1, 'Nhập số LSX').max(50), // người dùng tự đặt số LSX
  // 0113: một lệnh gộp nhiều đơn của CÙNG một khách (service kiểm tra).
  order_ids: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một đơn hàng').max(50),
  ship_date: z.string().date().optional().nullable(),
  received_date: z.string().date().optional().nullable(), // Ngày nhận (in trên LSX)
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/**
 * Bản soạn dòng lệnh (0114): nhóm → dòng. `id` có thì là sửa, không có thì là
 * thêm mới; nhóm/dòng vắng mặt trong payload bị xoá (service chặn nếu đã chạy).
 */
const kvSchema = z.record(z.string(), z.string().max(2000))

export const lsxLineSaveSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  sales_order_line_id: z.string().uuid().nullable().optional(),
  // Mã SP là TEXT tự do: file thật có "Thông báo sau", "26300-309 ( có 1 mẫu bạc )".
  product_code: z.string().trim().max(200).default(''),
  customer_item_code: z.string().trim().max(200).nullable().optional(),
  name_foreign: z.string().trim().max(500).nullable().optional(),
  name_vi: z.string().trim().max(500).nullable().optional(),
  name_customs: z.string().trim().max(500).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().max(50).default(''),
  qty: z.coerce.number().min(0).default(0),
  packing: z.string().trim().max(300).nullable().optional(),
  cbm: z.coerce.number().min(0).nullable().optional(),
  ship_date: z.string().date().nullable().optional(),
  // Nhãn đợt xuất giữ nguyên chữ Sales gõ: "w37.26", "DỰ KIẾN kiểm hàng 5/10".
  ship_label: z.string().trim().max(300).nullable().optional(),
  specs: kvSchema.default({}),
  checks: kvSchema.default({}),
  extras: kvSchema.default({}),
  note: z.string().trim().max(2000).nullable().optional(),
  important_note: z.string().trim().max(2000).nullable().optional(),
  image_file_id: z.string().uuid().nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
})

export const lsxGroupSaveSchema = z.object({
  id: z.string().uuid().optional(),
  sales_order_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(300).nullable().optional(),
  buyer_name: z.string().trim().max(200).nullable().optional(),
  po_no: z.string().trim().max(200).nullable().optional(),
  ship_date: z.string().date().nullable().optional(),
  ship_label: z.string().trim().max(300).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
  lines: z.array(lsxLineSaveSchema).max(2000),
})

export const lsxSheetSaveSchema = z.object({
  groups: z.array(lsxGroupSaveSchema).min(1, 'Lệnh phải có ít nhất một nhóm').max(200),
  revision_note: z.string().trim().max(1000).optional().nullable(),
})

/** Gộp thêm / gỡ bớt đơn của một lệnh đang chạy (0113). */
export const lsxOrdersSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một đơn hàng').max(50),
})

/** Hoàn thành LSX — gate "mọi việc đã xong"; QL được ép qua kèm lý do. */
export const lsxCompleteSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
  override: z.boolean().default(false),
})

export const lsxListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(LSX_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})
