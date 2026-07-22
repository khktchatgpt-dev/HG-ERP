import { z } from 'zod'

/**
 * Zod cho RBAC. Phase 0 chỉ ĐỌC (ma trận) nên chưa dùng; khai báo sẵn cho
 * Phase 3 (IT tự phục vụ: tạo vai, gán permission↔role, gán role↔user).
 */

export const roleCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'key chỉ gồm chữ thường, số, gạch dưới'),
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
})

export const roleUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable(),
    is_active: z.boolean(),
    sort_order: z.coerce.number().int(),
  })
  .partial()

/** Đặt lại toàn bộ permission cho 1 role. */
export const setRolePermissionsSchema = z.object({
  permission_keys: z.array(z.string().trim().min(1)).max(200),
})

/** Đặt lại toàn bộ role cho 1 user. */
export const setUserRolesSchema = z.object({
  role_ids: z.array(z.string().uuid()).max(50),
})
