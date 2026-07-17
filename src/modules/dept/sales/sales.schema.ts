import { z } from 'zod'

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  // Bán B2B xuất khẩu — phục vụ mẫu Sale Contract / auto-fill báo giá.
  tax_code: z.string().trim().max(50).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  contact_person: z.string().trim().max(200).optional().nullable(),
  default_currency: z.string().trim().toUpperCase().length(3).optional().nullable(),
  default_price_term: z.string().trim().max(100).optional().nullable(),
  default_payment_terms: z.string().trim().max(500).optional().nullable(),
  port_of_discharge: z.string().trim().max(200).optional().nullable(),
  fax: z.string().trim().max(50).optional().nullable(),
  representative_title: z.string().trim().max(100).optional().nullable(),
  fsc_cert: z.string().trim().max(100).optional().nullable(),
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
