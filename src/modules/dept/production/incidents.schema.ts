import { z } from 'zod'

/** Tổ báo sự cố (hỏng máy, thiếu vật tư, lỗi hàng loạt) — tách vai 07/2026. */
export const incidentCreateSchema = z.object({
  production_order_id: z.uuid().nullable().optional(),
  stage: z.string().trim().min(1).max(50).nullable().optional(),
  message: z.string().trim().min(1).max(2000),
})
export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>

export const incidentListQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
})
