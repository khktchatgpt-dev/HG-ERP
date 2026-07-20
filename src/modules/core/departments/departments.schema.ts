import { z } from 'zod'

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
})

export const departmentUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable(),
    head_user_id: z.string().uuid().nullable(),
    /** Công đoạn SX tổ phụ trách (code catalog production_stage) — 0064. */
    stage_code: z.string().trim().min(1).max(50).nullable(),
  })
  .partial()
