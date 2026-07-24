import { z } from 'zod'

/**
 * Sổ số liệu sản xuất (thống kê xưởng nhập TẬP TRUNG — 0084). POST theo LÔ:
 * 1 lần lưu = nhiều chi tiết cùng công đoạn + ngày + tổ (thói quen lưới Excel).
 * Phế phẩm = số + lý do text tự do (bỏ danh mục mã lỗi — user chốt 07/2026).
 */
export const entryLineSchema = z
  .object({
    component_id: z.string().uuid(),
    qty: z.coerce.number().positive('SL phải > 0'),
    kg: z.coerce.number().min(0).optional().nullable(),
    defect_qty: z.coerce.number().min(0).default(0),
    defect_reason: z.string().trim().max(200).optional().nullable(),
    machine_note: z.string().trim().max(200).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((e, ctx) => {
    if ((e.defect_qty ?? 0) > 0 && !e.defect_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['defect_reason'],
        message: 'Phế > 0 phải ghi lý do',
      })
    }
  })

export const entriesRecordSchema = z.object({
  stage: z.string().trim().min(1).max(50), // code catalog production_stage
  entry_date: z.string().date(),
  team_department_id: z.string().uuid().optional().nullable(),
  entries: z.array(entryLineSchema).min(1).max(200),
})

// ── Sổ toàn xưởng + chốt sổ ngày ─────────────────────────────────────────────

export const logbookQuerySchema = z.object({
  date: z.string().date(),
})

/** Chốt sổ ngày — team bỏ trống = tổ của người chốt (NV xưởng bị ép tổ mình). */
export const dayLockSchema = z.object({
  entry_date: z.string().date(),
  team_department_id: z.string().uuid().optional().nullable(),
})

/** Mở khoá (chỉ admin/manager) — DELETE qua query string. */
export const dayUnlockQuerySchema = z.object({
  date: z.string().date(),
  team: z.string().uuid(),
})

// ── Gia công ngoài ───────────────────────────────────────────────────────────

export const outsourceEntrySchema = z.object({
  component_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  direction: z.enum(['send', 'receive']),
  entry_date: z.string().date(),
  qty: z.coerce.number().positive('SL phải > 0'),
  kg: z.coerce.number().min(0).optional().nullable(),
  defect_qty: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(500).optional().nullable(),
})
