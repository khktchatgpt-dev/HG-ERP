import { z } from 'zod'

/**
 * Tỷ giá — 1 đơn vị ngoại tệ = bao nhiêu VND.
 *
 * Trần 1.000.000: không ngoại tệ nào công ty dùng đổi ra hơn một triệu VND;
 * vượt là gõ thừa số 0. Sàn 1: nhỏ hơn 1 là nhập ngược chiều (VND/USD).
 * Lệch 3% so với dòng trước chỉ CẢNH BÁO ở màn (`lib/fx.ts` FX_WARN_PCT),
 * không chặn ở đây — schema chỉ chặn thứ chắc chắn sai.
 */
const rateField = z.coerce
  .number()
  .min(1, 'Tỷ giá phải lớn hơn 1 — nhập theo chiều 1 USD = ? VND')
  .max(1_000_000, 'Tỷ giá quá lớn — thường là gõ thừa số 0')

export const FX_SOURCES = ['vcb', 'tay', 'khac'] as const
export const FX_SOURCE_LABEL: Record<(typeof FX_SOURCES)[number], string> = {
  vcb: 'VCB bán ra',
  tay: 'Nhập tay',
  khac: 'Khác',
}

export const fxRateCreateSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase())
    .refine((s) => s !== 'VND', 'VND quy sang VND luôn là 1 — không khai ở đây'),
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải là yyyy-mm-dd'),
  rate: rateField,
  source: z.enum(FX_SOURCES).default('vcb'),
  note: z.string().trim().max(200).optional().nullable(),
})

/** Sửa dòng CHƯA chứng từ nào dùng. Ngày và ngoại tệ không đổi — đổi là dòng khác. */
export const fxRateUpdateSchema = z.object({
  id: z.string().uuid(),
  rate: rateField,
  source: z.enum(FX_SOURCES),
  note: z.string().trim().max(200).optional().nullable(),
})

/** Gán tỷ giá cho chứng từ thiếu. `dry` = chỉ xem trước, không ghi. */
export const fxAssignSchema = z.object({
  dry: z.boolean().default(true),
})

export type FxRateCreateInput = z.infer<typeof fxRateCreateSchema>
export type FxRateUpdateInput = z.infer<typeof fxRateUpdateSchema>
