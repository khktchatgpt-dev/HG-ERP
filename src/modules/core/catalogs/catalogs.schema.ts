import { z } from 'zod'

/** Loại danh mục dùng chung (FR-ADM-04) — khớp check constraint catalog_items. */
export const CATALOG_TYPES = [
  'unit',
  'material_group',
  'product_category',
  'production_stage',
  'contract_type',
] as const
export type CatalogType = (typeof CATALOG_TYPES)[number]

export const CATALOG_TYPE_LABEL: Record<CatalogType, string> = {
  unit: 'Đơn vị tính',
  material_group: 'Nhóm vật tư',
  product_category: 'Danh mục sản phẩm',
  production_stage: 'Giai đoạn sản xuất',
  contract_type: 'Loại hợp đồng',
}

export const catalogCreateSchema = z.object({
  type: z.enum(CATALOG_TYPES),
  // Code là khoá tham chiếu từ dữ liệu nghiệp vụ — bất biến sau khi dùng,
  // chỉ cho ascii/kebab để an toàn khi in/so sánh.
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Code chỉ gồm chữ thường/số/gạch (vd: hoan_thien)'),
  label: z.string().trim().min(1).max(100),
  sort_order: z.coerce.number().int().min(0).default(0),
})

/** KHÔNG cho sửa type/code (dữ liệu cũ tham chiếu bằng code) — chỉ label/sort/active. */
export const catalogUpdateSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})
