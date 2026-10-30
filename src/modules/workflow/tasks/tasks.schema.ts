import { z } from 'zod'

const uuidSchema = z.string().uuid('Invalid id')

export const TASK_STATUSES = [
  'todo',
  'in_progress',
  'submitted',
  'done',
  'rejected',
  'cancelled',
  'on_hold',
] as const
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export const TASK_KINDS = ['assigned', 'self'] as const

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20).optional()

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  assignee_id: uuidSchema,
  department_id: uuidSchema.optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  // NEW — planning fields
  planned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional()
    .nullable(),
  category: z.string().trim().max(50).optional().nullable(),
  tags: tagsSchema,
  estimate_hours: z.number().min(0).max(9999.99).optional().nullable(),
  parent_id: uuidSchema.optional().nullable(),
  period_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'YYYY-MM')
    .optional()
    .nullable(),
})

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  assignee_id: uuidSchema.optional(),
  department_id: uuidSchema.nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  planned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  category: z.string().trim().max(50).nullable().optional(),
  tags: tagsSchema,
  estimate_hours: z.number().min(0).max(9999.99).nullable().optional(),
  actual_hours: z.number().min(0).max(9999.99).nullable().optional(),
  progress_percent: z.number().int().min(0).max(100).optional(),
  period_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
})

export const taskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled', 'on_hold']),
})

export const taskProgressSchema = z.object({
  progress_percent: z.number().int().min(0).max(100),
})

export const weeklyReportQuerySchema = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  department_id: z.string().uuid().optional(),
})

/** Báo hoàn thành — bắt một câu kết quả (Q4, 30/10/2026). */
export const taskSubmitSchema = z.object({
  // `error` ở z.string: THIẾU HẲN trường cũng ra câu tiếng Việt, không phải "Invalid input…".
  result: z
    .string({ error: 'Ghi một câu kết quả để người giao biết đã làm gì' })
    .trim()
    .min(1, 'Ghi một câu kết quả để người giao biết đã làm gì')
    .max(2000, 'Quá dài'),
})

/** Duyệt Đạt — lời nhắn tuỳ chọn. */
export const taskApproveSchema = z.object({
  note: z.string().trim().max(2000, 'Quá dài').optional().nullable(),
})

export const taskRejectSchema = z.object({
  reason: z
    .string({ error: 'Ghi lý do trả lại để người nhận biết phải làm thêm gì' })
    .trim()
    .min(1, 'Ghi lý do trả lại để người nhận biết phải làm thêm gì')
    .max(2000, 'Quá dài'),
})

export const taskListQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  kind: z.enum(TASK_KINDS).optional(),
  scope: z.enum(['mine', 'assigned_by_me', 'department', 'all']).default('mine'),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
})

export const planQuerySchema = z.object({
  range: z.enum(['today', 'week', 'overdue', 'upcoming', 'all']).default('week'),
})

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  kind: z.enum(['comment', 'progress_report']).default('comment'),
})
