import { z } from 'zod'

/**
 * Kế hoạch sản xuất per LSX (vai Trưởng phòng Kế hoạch — 0084): lộ trình công
 * đoạn theo thứ tự + giao tổ + hạn per công đoạn, ghi đè trọn bộ theo DÒNG SP.
 */
export const planStageSchema = z.object({
  stage: z.string().trim().min(1).max(50), // code catalog production_stage
  team_department_id: z.string().uuid().optional().nullable(),
  planned_start: z.string().date().optional().nullable(),
  planned_end: z.string().date().optional().nullable(),
})

export const linePlanSchema = z.object({
  order_line_id: z.string().uuid(),
  stages: z.array(planStageSchema).max(30),
  /** Lưu lộ trình này làm mặc định cho SP (technical_products.stage_route). */
  save_as_default: z.boolean().default(false),
})

export const planSaveSchema = z.object({
  lines: z.array(linePlanSchema).min(1).max(100),
})

/** Ưu tiên lệnh (số lớn = làm trước) — Kế hoạch xếp hàng đợi xưởng. */
export const prioritySchema = z.object({
  priority: z.coerce.number().int().min(0).max(999),
})

/** Sửa 1 job: giao tổ / hạn / ghi chú (Kế hoạch hoặc quản đốc). */
export const jobPatchSchema = z.object({
  team_department_id: z.string().uuid().optional().nullable(),
  planned_start: z.string().date().optional().nullable(),
  planned_end: z.string().date().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
})
