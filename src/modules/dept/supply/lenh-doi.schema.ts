import { z } from 'zod'

/**
 * "Đã soát" — ghi mốc soát mới cho lệnh (0282). `dau` là dấu của tập thay đổi
 * người bấm đang nhìn (`dauThayDoi`); server tính lại và từ chối nếu đã khác.
 */
export const soatSchema = z.object({
  production_order_id: z.string().uuid(),
  dau: z.string().trim().min(1).max(32),
  note: z.string().trim().max(500).nullable().optional(),
})

export type SoatInput = z.infer<typeof soatSchema>
