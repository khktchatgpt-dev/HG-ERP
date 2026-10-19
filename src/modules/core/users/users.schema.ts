import { z } from 'zod'
import { emailSchema, passwordSchema } from '@/modules/core/auth/auth.schema'

const uuidSchema = z.string().uuid('Invalid id')
export const USER_ROLES = ['admin', 'manager', 'employee'] as const

export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).default('employee'),
  department_id: uuidSchema.optional().nullable(),
  title: z.string().trim().max(100).optional().nullable(),
  account_kind: z.enum(['person', 'shared']).optional(),
  shared_holder: z.string().trim().max(100).optional().nullable(),
})

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).nullable(),
    role: z.enum(USER_ROLES),
    department_id: uuidSchema.nullable(),
    title: z.string().trim().max(100).nullable(),
    is_active: z.boolean(),
  })
  .partial()

const boolFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional()

export const userListQuerySchema = z.object({
  department_id: uuidSchema.optional(),
  role: z.enum(USER_ROLES).optional(),
  q: z.string().trim().max(200).optional(),
  includeInactive: boolFromString,
  includeDeleted: boolFromString,
})

export const userResetPasswordSchema = z.object({
  new_password: passwordSchema,
  reason: z.string().trim().max(200).optional(),
})

export const userDeleteSchema = z.object({
  reason: z.string().trim().max(200).optional(),
})

const bulkRowSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).default('employee'),
  department_id: uuidSchema.optional().nullable(),
  title: z.string().trim().max(100).optional().nullable(),
})

export const userBulkImportSchema = z.object({
  users: z.array(bulkRowSchema).min(1).max(500),
})

export const userAuditListSchema = z.object({
  target_user_id: uuidSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

// ─── Nhân viên ↔ tài khoản (0247) ────────────────────────────────────────────

/** Cấp tài khoản cá nhân từ dòng nhân viên — họ tên lấy từ hồ sơ nhân viên. */
export const userFromEmployeeSchema = z.object({
  employee_id: uuidSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(USER_ROLES).default('employee'),
  department_id: uuidSchema.nullable(),
  title: z.string().trim().max(100).optional().nullable(),
})

/** Gắn / gỡ nhân viên, hoặc đánh dấu dùng chung + người đang cầm. */
export const userLinkSchema = z.union([
  z.object({ employee_id: uuidSchema.nullable() }),
  z.object({
    shared: z.literal(true),
    holder: z.string().trim().max(100).nullable(),
  }),
])

export const userLinkBulkSchema = z.object({
  pairs: z
    .array(z.object({ user_id: uuidSchema, employee_id: uuidSchema }))
    .min(1)
    .max(200),
})
