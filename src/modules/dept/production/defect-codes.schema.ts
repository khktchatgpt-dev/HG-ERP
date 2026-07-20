import { z } from 'zod'

/** Danh mục nguyên nhân lỗi SX (0067) — admin quản lý; code BẤT BIẾN sau tạo. */
export const defectCodeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Code chỉ gồm chữ thường/số/gạch (a-z 0-9 _ -)'),
  label: z.string().trim().min(1).max(100),
  /** Code catalog production_stage; null = áp dụng mọi công đoạn. */
  stage_code: z.string().trim().min(1).max(50).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
})

export const defectCodeUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    stage_code: z.string().trim().min(1).max(50).nullable(),
    sort_order: z.coerce.number().int().min(0).max(9999),
    is_active: z.boolean(),
  })
  .partial()
