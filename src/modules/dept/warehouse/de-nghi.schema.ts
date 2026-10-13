import { z } from 'zod'

/**
 * ĐỀ NGHỊ MUA VẬT TƯ (0236) — tờ "Giấy đề nghị mua vật tư" của Kho, số hoá.
 * Vòng đời ở bản vẽ DN-0: draft → pending → approved → ordering → done; từ chối
 * về draft; huỷ = cancelled. Đ1 dùng draft / pending / cancelled.
 */
export const DE_NGHI_STATUSES = [
  'draft',
  'pending',
  'approved',
  'ordering',
  'done',
  'cancelled',
] as const
export type DeNghiStatus = (typeof DE_NGHI_STATUSES)[number]

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

export const deNghiLineSchema = z.object({
  /** Null = chưa có mã trong danh mục — gõ tên tự do (Q3). */
  material_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Dòng thiếu tên vật tư').max(300),
  unit: z.string().trim().min(1, 'Dòng thiếu đơn vị tính').max(40),
  qty: z.coerce.number().positive('Số lượng phải lớn hơn 0'),
  /** Dự kiến, VND, chưa VAT (Q4) — không bắt buộc. */
  unit_price: z.coerce.number().min(0).nullable().optional(),
  /** % VAT của dòng (Đ7): 0 = không VAT. Một phiếu có thể lẫn dòng có / không VAT. */
  vat_rate: z.coerce.number().min(0).max(100).default(0),
  /** Tổ / bộ phận dùng (Q5) — gõ tự do kèm gợi ý. */
  purpose: text(200),
  note: text(500),
})

export const deNghiSaveSchema = z.object({
  department: z.string().trim().min(2).max(120).default('Kho vật tư'),
  /** YYYY-MM-DD. */
  need_by: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: text(2000),
  production_order_id: z.string().uuid().nullable().optional(),
  /** Phí vận chuyển dự kiến cả phiếu, VND (Đ7). */
  shipping_fee: z.coerce.number().min(0).max(10_000_000_000).default(0),
  lines: z.array(deNghiLineSchema).max(200, 'Tối đa 200 dòng một phiếu'),
})

export const deNghiCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Ghi lý do huỷ (ít nhất 3 ký tự)').max(1000),
})

export type DeNghiLineInput = z.infer<typeof deNghiLineSchema>
export type DeNghiSaveInput = z.infer<typeof deNghiSaveSchema>

/** Lãnh đạo quyết (Đ2): duyệt (sửa số từng dòng được) hoặc từ chối có lý do. */
export const deNghiDecideSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional().nullable(),
    /** Số DUYỆT từng dòng — chỉ gửi dòng muốn đổi; thiếu = duyệt đúng số đề nghị. */
    lines: z
      .array(z.object({ id: z.string().uuid(), approved_qty: z.coerce.number().min(0) }))
      .max(200)
      .optional(),
  })
  .refine((v) => v.decision === 'approve' || (v.reason ?? '').trim().length >= 3, {
    message: 'Từ chối phải ghi lý do (ít nhất 3 ký tự) — Kho sửa theo lý do đó',
    path: ['reason'],
  })

export type DeNghiDecideInput = z.infer<typeof deNghiDecideSchema>

/**
 * KHO NHẬP HÀNG ĐÃ MUA (0238 · Đ3, bản vẽ DN-3). Luật chặn (thiếu mã, thiếu
 * giá, vượt > 10% không lý do) ở `lib/de-nghi-nhap` — service gọi lại đúng hàm
 * màn dùng, zod ở đây chỉ canh hình dạng.
 */
export const deNghiNhapSchema = z.object({
  /** Nơi mua — tên tiệm / NCC gõ tự do (Q10). */
  noi_mua: z.string().trim().min(1, 'Chưa ghi nơi mua').max(200),
  /** Số hoá đơn / biên nhận (Q13) — không bắt buộc. */
  supplier_doc_no: text(60),
  doc_date: z.string().date().optional().nullable(),
  /** Lý do nhập lùi quá 7 ngày (luật chung của phiếu nhập). */
  backdate_reason: text(300),
  note: text(2000),
  lines: z
    .array(
      z.object({
        line_id: z.string().uuid(),
        /** Bắt buộc với dòng có số nhận; dòng "chưa có mã" gắn ở đây. */
        material_id: z.string().uuid().nullable().optional(),
        qty: z.coerce.number().min(0),
        unit_price: z.coerce.number().min(0).nullable().optional(),
        note: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(200),
})
export type DeNghiNhapInput = z.infer<typeof deNghiNhapSchema>

/** Chốt xong khi còn dòng thiếu mà không mua nữa (Q14). */
export const deNghiChotSchema = z.object({
  reason: z.string().trim().min(3, 'Ghi lý do chốt (ít nhất 3 ký tự)').max(1000),
})
