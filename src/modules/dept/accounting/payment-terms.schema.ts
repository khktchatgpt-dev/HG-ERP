import { z } from 'zod'

/**
 * Điều khoản thanh toán — hai đường ghi, hai mức.
 *
 * Trần 365 ngày: dài hơn một năm gần như chắc chắn là gõ nhầm (3650 thay vì
 * 365), và một hạn sai kiểu đó giấu luôn khoản nợ khỏi mọi bảng tuổi nợ.
 */
const termSchema = z.object({
  basis: z.enum(['net', 'eom']),
  days: z.coerce
    .number()
    .int('Số ngày phải là số nguyên')
    .min(0, 'Số ngày không được âm')
    .max(365, 'Quá 365 ngày — kiểm lại, thường là gõ nhầm'),
})

/**
 * MẶC ĐỊNH CÔNG TY — một dòng, phủ mọi khoản nợ chưa có điều khoản riêng.
 * `null` = bỏ mặc định, quay lại chỉ đọc điều khoản ghi trên từng đơn.
 */
export const companyDefaultTermSchema = z.object({
  term: termSchema.nullable(),
})

/** Ghi đè cho MỘT nhà cung cấp. `null` = xoá, để nó rơi về mặc định công ty. */
export const supplierTermSchema = z.object({
  supplier_id: z.string().uuid(),
  days: z.coerce.number().int().min(0).max(365).nullable(),
})

export type CompanyDefaultTermInput = z.infer<typeof companyDefaultTermSchema>
export type SupplierTermInput = z.infer<typeof supplierTermSchema>
