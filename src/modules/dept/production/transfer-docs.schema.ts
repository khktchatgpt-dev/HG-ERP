import { z } from 'zod'

/**
 * PHIẾU GIAO TỔ (PGT, 0289) — B4 của docs/san-xuat-cau-hinh-thiet-ke.md.
 * Hai nhịp: tổ giao lập → tổ nhận xác nhận. Huỷ khi chưa nhận; đã nhận thì
 * chỉ đảo bằng phiếu ngược. Số lượng dương; chênh khi nhận bắt lý do (kiểm ở
 * service vì ở đây chưa biết số giao).
 */

const stageCode = z.string().trim().min(1).max(50)

export const transferDocCreateSchema = z
  .object({
    production_order_id: z.string().uuid(),
    from_stage: stageCode,
    from_team_id: z.string().uuid(),
    to_stage: stageCode,
    to_team_id: z.string().uuid(),
    entry_date: z.string().date(),
    note: z.string().trim().max(500).optional().nullable(),
    lines: z
      .array(
        z.object({
          component_id: z.string().uuid(),
          qty: z.coerce.number().positive('SL giao phải > 0'),
        }),
      )
      .min(1, 'Phiếu phải có ít nhất một dòng')
      .max(200),
  })
  .superRefine((d, ctx) => {
    if (d.from_stage === d.to_stage) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_stage'],
        message: 'Công đoạn nhận phải khác công đoạn giao',
      })
    }
    const seen = new Set<string>()
    for (const l of d.lines) {
      if (seen.has(l.component_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines'],
          message: 'Một dòng ghi hai lần trong cùng phiếu — gộp số lại',
        })
        break
      }
      seen.add(l.component_id)
    }
  })
export type TransferDocCreateInput = z.infer<typeof transferDocCreateSchema>

/** Ba hành động trên một phiếu — một route, phân biệt bằng `action`. */
export const transferDocActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('nhan'),
    /** Bỏ trống = NHẬN ĐỦ (received = qty mọi dòng). */
    lines: z
      .array(
        z.object({
          transfer_id: z.string().uuid(),
          received_qty: z.coerce.number().min(0, 'SL nhận không âm'),
          diff_reason: z.string().trim().max(200).optional().nullable(),
        }),
      )
      .max(200)
      .optional(),
  }),
  z.object({
    action: z.literal('huy'),
    reason: z.string().trim().min(1, 'Huỷ phải ghi lý do').max(200),
  }),
  z.object({
    action: z.literal('dao'),
    reason: z.string().trim().min(1, 'Đảo phải ghi lý do').max(200),
    /** Bỏ trống = đảo TRỌN số đã nhận của mọi dòng. */
    lines: z
      .array(
        z.object({
          transfer_id: z.string().uuid(),
          qty: z.coerce.number().positive('SL đảo phải > 0'),
        }),
      )
      .max(200)
      .optional(),
  }),
])
export type TransferDocActionInput = z.infer<typeof transferDocActionSchema>

export const transferSourceQuerySchema = z.object({
  lsx: z.string().uuid(),
  stage: stageCode,
})
export const transferInboxQuerySchema = z.object({
  lsx: z.string().uuid().optional(),
})
