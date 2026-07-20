import { z } from 'zod'

/**
 * Nhập sản lượng hằng ngày theo công đoạn/tổ (SX-P3 — FR-PR-02/03/07).
 * POST theo LÔ: 1 lần lưu = nhiều chi tiết cùng công đoạn + ngày + tổ
 * (đúng thói quen nhập lưới Excel của tổ trưởng).
 */
export const outputEntrySchema = z
  .object({
    component_id: z.string().uuid(),
    qty: z.coerce.number().positive('SL phải > 0'),
    kg: z.coerce.number().min(0).optional().nullable(),
    defect_qty: z.coerce.number().min(0).default(0),
    /** Code danh mục production_defect_codes (0067) — bắt buộc khi phế > 0. */
    defect_reason: z.string().trim().max(100).optional().nullable(),
    machine_note: z.string().trim().max(200).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((e, ctx) => {
    if ((e.defect_qty ?? 0) > 0 && !e.defect_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['defect_reason'],
        message: 'Phế > 0 phải chọn nguyên nhân lỗi',
      })
    }
  })

export const outputRecordSchema = z.object({
  stage: z.string().trim().min(1).max(50), // code catalog production_stage
  entry_date: z.string().date(),
  team_department_id: z.string().uuid().optional().nullable(),
  entries: z.array(outputEntrySchema).min(1).max(200),
})

// ── Sổ toàn xưởng + chốt sổ (07/2026) ─────────────────────────────────────

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
