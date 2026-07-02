import { z } from 'zod'

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
})

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  owner_id: z.string().uuid().optional(),
  active_only: z.coerce.boolean().default(true),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})
