import { z } from 'zod'

export const productCreateSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional().nullable(),
  drawing_url: z.string().trim().url().optional().or(z.literal('')),
  bom_url: z.string().trim().url().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().optional(),
  active_only: z.coerce.boolean().default(true),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})
