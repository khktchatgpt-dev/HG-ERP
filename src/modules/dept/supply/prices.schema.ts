import { z } from 'zod'

/** Thêm giá chào: 1 NCC × 1 vật tư × ngày hiệu lực (unique — trùng thì báo). */
export const priceCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  material_id: z.string().uuid(),
  price: z.coerce.number().min(0, 'Giá không âm'),
  currency: z
    .string()
    .trim()
    .length(3, 'Mã tiền tệ 3 ký tự (VND, USD…)')
    .toUpperCase()
    .default('VND'),
  valid_from: z.string().date().optional(), // bỏ trống = hôm nay (DB default)
  note: z.string().trim().max(500).optional().nullable(),
})

/**
 * Nhập BÁO GIÁ hàng loạt: 1 NCC + 1 ngày hiệu lực + nhiều dòng (vật tư, giá).
 * Trùng (NCC, vật tư, ngày) → cập nhật đè (upsert) thay vì lỗi — nhập lại báo
 * giá cùng ngày là sửa giá.
 */
export const priceBulkCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  currency: z.string().trim().length(3).toUpperCase().default('VND'),
  valid_from: z.string().date().optional(), // bỏ trống = hôm nay
  lines: z
    .array(
      z.object({
        material_id: z.string().uuid(),
        price: z.coerce.number().min(0, 'Giá không âm'),
        note: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1, 'Báo giá phải có ít nhất 1 dòng')
    .max(500)
    .refine(
      (lines) => new Set(lines.map((l) => l.material_id)).size === lines.length,
      'Vật tư bị trùng dòng',
    ),
})

export const pricePatchSchema = z.object({
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  valid_from: z.string().date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

/** Bắt buộc lọc theo NCC hoặc vật tư — không cho kéo cả bảng vô định hướng. */
export const priceListQuerySchema = z
  .object({
    supplier_id: z.string().uuid().optional(),
    material_id: z.string().uuid().optional(),
  })
  .refine((q) => q.supplier_id || q.material_id, {
    message: 'Cần supplier_id hoặc material_id',
  })

/** So giá cho form PO: material_ids = csv uuid. */
export const priceCompareQuerySchema = z.object({
  material_ids: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((x) => x.trim()))
    .pipe(z.array(z.string().uuid()).min(1).max(100)),
})
