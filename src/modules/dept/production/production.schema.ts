import { z } from 'zod'

export const LSX_STATUSES = ['issued', 'in_progress', 'completed'] as const
export type LsxStatus = (typeof LSX_STATUSES)[number]

/** Giai đoạn SX = code catalog_items type 'production_stage' (phoi/han/son/mai/hoan_thien). */
export const issueLsxSchema = z.object({
  order_id: z.string().uuid(),
  ship_date: z.string().date().optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/** Cập nhật giai đoạn (FR-PROD-01) — 'done' ở giai đoạn cuối do nút Hoàn thành riêng. */
export const stageUpdateSchema = z.object({
  stage: z.string().trim().min(1).max(50),
  action: z.enum(['start', 'done']).default('done'),
  note: z.string().trim().max(1000).optional().nullable(),
})

export const lsxListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(LSX_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})
