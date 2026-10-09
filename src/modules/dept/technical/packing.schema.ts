import { z } from 'zod'

/**
 * PHƯƠNG ÁN ĐÓNG GÓI (bảng `technical_packing_options` + kiện `technical_packages`,
 * 0092) — API thêm/sửa/xoá dựng 08/10/2026 cho màn `/thu-vien/[id]` (trước đó
 * phương án chỉ đến từ file BOM).
 *
 * Kích thước kiện ghi MM (như DB); màn hình quy ra cm khi bày. Số 0 = "chưa đo",
 * ghi null cho khỏi thành số thật.
 */
const mmOrNull = z
  .union([z.number(), z.string()])
  .transform((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))))
  .pipe(z.number().min(0).nullable())
  .transform((v) => (v === 0 ? null : v))

export const packageInputSchema = z.object({
  package_label: z.string().trim().min(1, 'Tên kiện').max(100),
  qty: z.coerce.number().positive().max(999).default(1),
  carton_l_mm: mmOrNull.optional().default(null),
  carton_w_mm: mmOrNull.optional().default(null),
  carton_h_mm: mmOrNull.optional().default(null),
  net_weight_kg: mmOrNull.optional().default(null),
  gross_weight_kg: mmOrNull.optional().default(null),
})
export type PackageInput = z.infer<typeof packageInputSchema>

export const packingOptionInputSchema = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  /** Số cái mỗi bộ thùng (1 SP = n thùng thì cartons_per_set = n). */
  cartons_per_set: z.coerce.number().int().positive().max(999).optional().nullable(),
  loading_40hc: z.coerce.number().int().min(0).max(99999).optional().nullable(),
  is_default: z.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  /** Thay TRỌN danh sách kiện của phương án (gửi [] = xoá hết kiện). */
  packages: z.array(packageInputSchema).max(20).optional(),
})
export type PackingOptionInput = z.infer<typeof packingOptionInputSchema>

export const packingOptionUpdateSchema = packingOptionInputSchema.partial()
export type PackingOptionUpdate = z.infer<typeof packingOptionUpdateSchema>
