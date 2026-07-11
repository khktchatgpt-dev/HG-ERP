import { z } from 'zod'

/**
 * Nhập sản lượng hằng ngày theo công đoạn/tổ (SX-P3 — FR-PR-02/03/07).
 * POST theo LÔ: 1 lần lưu = nhiều chi tiết cùng công đoạn + ngày + tổ
 * (đúng thói quen nhập lưới Excel của tổ trưởng).
 */
export const outputEntrySchema = z.object({
  component_id: z.string().uuid(),
  qty: z.coerce.number().positive('SL phải > 0'),
  kg: z.coerce.number().min(0).optional().nullable(),
  defect_qty: z.coerce.number().min(0).default(0),
  machine_note: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const outputRecordSchema = z.object({
  stage: z.string().trim().min(1).max(50), // code catalog production_stage
  entry_date: z.string().date(),
  team_department_id: z.string().uuid().optional().nullable(),
  entries: z.array(outputEntrySchema).min(1).max(200),
})
