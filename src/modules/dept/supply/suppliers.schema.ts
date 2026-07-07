import { z } from 'zod'

export const supplierCreateSchema = z.object({
  code: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  tax_no: z.string().trim().max(30).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const supplierListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  active_only: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(200),
})
