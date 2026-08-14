import { z } from 'zod'

export const settingsUpdateSchema = z
  .object({
    company_name: z.string().trim().min(1).max(200),
    company_tax_code: z.string().trim().max(50).or(z.literal('')),
    company_address: z.string().trim().max(500).or(z.literal('')),
    company_locality: z.string().trim().max(100).or(z.literal('')),
    company_phone: z.string().trim().max(30).or(z.literal('')),
    company_email: z.string().trim().max(120).or(z.literal('')),
    company_fax: z.string().trim().max(50).or(z.literal('')),
    company_bank_account: z.string().trim().max(300).or(z.literal('')),
    company_swift: z.string().trim().max(50).or(z.literal('')),
    company_representative: z.string().trim().max(200).or(z.literal('')),
    company_representative_title: z.string().trim().max(100).or(z.literal('')),
    company_fsc_cert: z.string().trim().max(100).or(z.literal('')),
    fsc_scientific_name: z.string().trim().max(200).or(z.literal('')),
    fsc_country_origin: z.string().trim().max(100).or(z.literal('')),
    fsc_area_origin: z.string().trim().max(100).or(z.literal('')),
    fsc_forest_owner: z.string().trim().max(500).or(z.literal('')),
    fsc_exporter: z.string().trim().max(300).or(z.literal('')),
    fsc_importer: z.string().trim().max(300).or(z.literal('')),
    fsc_seller: z.string().trim().max(300).or(z.literal('')),
    fsc_coordinates: z.string().trim().max(2000).or(z.literal('')),
  })
  .partial()

/**
 * Ngưỡng "giá trị lớn" khi ký, theo từng tiền tệ (§5F).
 *
 * Khoá phải là mã tiền tệ 3 chữ HOA — vừa khớp `sales_orders.currency` /
 * `supply_purchase_orders.currency`, vừa chặn khoá rác kiểu `__proto__` ngay ở
 * biên (tầng đọc `isBigApprovalWith` cũng đã chặn, đây là lớp thứ hai).
 * Bỏ trống cả bảng là hợp lệ: nghĩa là MỌI phiếu đều phải mở ra ký riêng.
 */
export const approvalThresholdsSchema = z.object({
  thresholds: z.record(
    z.string().regex(/^[A-Z]{3}$/, 'Mã tiền tệ phải là 3 chữ in hoa, ví dụ VND / USD'),
    z.coerce.number().nonnegative('Ngưỡng không được âm').finite('Ngưỡng phải là số'),
  ),
})
export type ApprovalThresholdsInput = z.infer<typeof approvalThresholdsSchema>
