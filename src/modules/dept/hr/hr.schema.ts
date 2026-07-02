import { z } from 'zod'

export const LEAVE_TYPES = [
  'annual', 'sick', 'unpaid', 'marriage', 'funeral', 'maternity', 'other',
] as const

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

export const leaveCreateSchema = z.object({
  leave_type: z.enum(LEAVE_TYPES).default('annual'),
  from_date: dateSchema,
  to_date: dateSchema,
  days_count: z.number().min(0.5).max(90),
  reason: z.string().trim().max(2000).optional(),
})

export const leaveDecideSchema = z.object({
  approver_note: z.string().trim().max(1000).optional(),
})

export const leaveListQuerySchema = z.object({
  scope: z.enum(['mine', 'pending', 'all']).default('mine'),
  status: z.enum(LEAVE_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})
