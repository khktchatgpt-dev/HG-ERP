import { z } from 'zod'

export const INVOICE_DIRECTIONS = ['incoming', 'outgoing'] as const
export const INVOICE_STATUSES = ['pending', 'sent', 'paid', 'overdue', 'cancelled'] as const

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

export const invoiceCreateSchema = z.object({
  invoice_no: z.string().trim().min(1).max(100),
  party_name: z.string().trim().min(1).max(200),
  direction: z.enum(INVOICE_DIRECTIONS),
  amount: z.number().nonnegative(),
  currency: z.string().trim().length(3).toUpperCase().default('VND'),
  issued_date: dateSchema,
  due_date: dateSchema.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const invoiceUpdateSchema = z.object({
  party_name: z.string().trim().min(1).max(200).optional(),
  amount: z.number().nonnegative().optional(),
  due_date: dateSchema.nullable().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const invoiceListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  direction: z.enum(INVOICE_DIRECTIONS).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})
