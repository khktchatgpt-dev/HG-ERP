import { z } from 'zod'

export const SUPPLIER_STATUSES = ['active', 'suspended', 'terminated'] as const
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]

const optText = (max: number) => z.string().trim().max(max).optional().nullable()

/** Vendor Master (M1) — hồ sơ NCC chuẩn ERP sản xuất. Chỉ `name` bắt buộc. */
export const supplierCreateSchema = z.object({
  // 1. Cơ bản
  code: optText(50),
  name: z.string().trim().min(1).max(200),
  short_name: optText(100),
  type: optText(50), // Nguyên vật liệu / Bao bì / Máy móc / Dịch vụ / Logistics / Khác
  status: z.enum(SUPPLIER_STATUSES).default('active'),
  // 2. Pháp lý
  company_name: optText(200),
  tax_no: optText(30),
  business_license: optText(100),
  founded_on: z.string().date().optional().nullable(),
  legal_rep: optText(150),
  country: optText(100),
  registered_address: optText(500),
  // 3. Liên hệ
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  phone: optText(30),
  address: optText(500), // địa chỉ giao dịch chính (tương thích cũ)
  trading_address: optText(500),
  warehouse_address: optText(500),
  website: optText(200),
  // 4. Thanh toán
  payment_terms: optText(100), // COD / NET30 / NET45 / NET60
  currency: z.string().trim().toUpperCase().length(3).optional().nullable(),
  bank_name: optText(200),
  bank_account: optText(50),
  swift_code: optText(30),
  invoice_terms: optText(200),
  // 5. Mua hàng
  moq: optText(200),
  lead_time_days: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  incoterms: optText(30),
  delivery_method: optText(100),
  return_policy: optText(1000),
  warranty_policy: optText(1000),
  // Phân loại
  region: optText(100),
  import_export: z.enum(['domestic', 'import']).optional().nullable(),
  priority: optText(30), // primary / backup…
  rating: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  // Đánh giá (M5 — chấm tay)
  quality_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  service_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  price_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  complaint_count: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  // Admin
  buyer_id: z.string().uuid().optional().nullable(),
  can_order: z.boolean().optional(),
  lock_reason: optText(500),
  note: optText(2000),
})

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  // Tương thích cũ: is_active vẫn nhận (service đồng bộ với status).
  is_active: z.boolean().optional(),
})

/** Đặt lại nhóm hàng NCC cung cấp (M4). */
export const supplierGroupsSchema = z.object({
  group_ids: z.array(z.string().uuid()).max(50),
})

export const supplierListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  active_only: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(200),
})
