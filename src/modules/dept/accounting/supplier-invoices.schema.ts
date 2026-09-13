import { z } from 'zod'

/**
 * HOÁ ĐƠN NCC (0188) — chứng từ pháp lý sinh ra khoản phải trả.
 *
 * Khác `accounting.schema.ts` (sổ đăng ký hoá đơn, `party_name` chữ tự do):
 * bảng này nối `supplier_id` và nối tới TỪNG DÒNG đơn mua, nên đối chiếu ba
 * chiều được. Hai cái sống song song có chủ ý — sổ cũ giữ dữ liệu đã có.
 */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')

export const SUPPLIER_INVOICE_STATUSES = ['draft', 'posted', 'cancelled'] as const
export type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number]

export const supplierInvoiceLineSchema = z.object({
  /**
   * Trống = dòng KHÔNG thuộc đơn mua nào (phí vận chuyển, chênh lệch làm tròn).
   * Có thật trên hoá đơn nên phải nhận được, nhưng không vào đối chiếu ba chiều.
   */
  po_line_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(1, 'Dòng hoá đơn phải có tên hàng').max(300),
  qty: z.coerce.number().positive('Số lượng phải > 0'),
  unit: z.string().trim().max(30).optional().nullable(),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
})

export const supplierInvoiceCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  invoice_no: z.string().trim().min(1, 'Phải có số hoá đơn').max(100),
  invoice_date: dateSchema,
  due_date: dateSchema.optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().default('VND'),
  /**
   * Ba số ghi theo ĐÚNG TỜ HOÁ ĐƠN, KHÔNG suy từ dòng. NCC làm tròn kiểu của
   * họ và số phải trả là số trên giấy; lệch giữa tổng dòng và tổng tờ được BÀY
   * RA ở màn đối chiếu chứ không âm thầm sửa lại cho khớp.
   */
  subtotal: z.coerce.number().min(0).default(0),
  vat_amount: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(supplierInvoiceLineSchema).min(1, 'Hoá đơn phải có ít nhất 1 dòng').max(200), // prettier-ignore
})

export const supplierInvoiceUpdateSchema = supplierInvoiceCreateSchema.partial().extend({
  lines: z.array(supplierInvoiceLineSchema).min(1).max(200).optional(),
})

export const supplierInvoiceListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  supplier_id: z.string().uuid().optional(),
  status: z.enum(SUPPLIER_INVOICE_STATUSES).optional(),
  /** Chỉ hoá đơn đã vào sổ mà quá hạn — suy theo ngày, không phải trạng thái lưu. */
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
})

export const supplierInvoicePostSchema = z.object({
  /** 'post' = vào sổ (tính công nợ) · 'unpost' = mở lại để sửa. */
  action: z.enum(['post', 'unpost']),
})
