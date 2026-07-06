import { z } from 'zod'

export const materialCreateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(30).default('cái'),
  group_name: z.string().trim().max(100).optional().nullable(),
  min_stock: z.coerce.number().min(0).default(0),
  shelf_location: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const materialUpdateSchema = materialCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const materialListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  group_name: z.string().trim().max(100).optional(),
  active_only: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(500),
})
