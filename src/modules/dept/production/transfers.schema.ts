import { z } from 'zod'

/**
 * Sổ BÀN GIAO NỘI BỘ (0090) — cột "SL giao 1..4" của sheet tổ trong Excel:
 * giao phôi/WIP vào tổ để làm 1 công đoạn (issue) / tổ trả lại lỗi-thừa
 * (return, bắt buộc lý do — Excel ghi "đã trả lại 2 bộ phôi lỗi (móp)").
 */
export const transferRecordSchema = z
  .object({
    component_id: z.string().uuid(),
    stage: z.string().trim().min(1).max(50), // code catalog production_stage
    team_department_id: z.string().uuid(),
    direction: z.enum(['issue', 'return']),
    entry_date: z.string().date(),
    qty: z.coerce.number().positive('SL phải > 0'),
    reason: z.string().trim().max(200).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((t, ctx) => {
    if (t.direction === 'return' && !t.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Trả lại phải ghi lý do (lỗi/thừa…)',
      })
    }
  })

export type TransferRecordInput = z.infer<typeof transferRecordSchema>
