import { z } from 'zod'

/**
 * Sổ số liệu sản xuất (thống kê xưởng nhập TẬP TRUNG — 0084). POST theo LÔ:
 * 1 lần lưu = nhiều chi tiết cùng công đoạn + ngày + tổ (thói quen lưới Excel).
 * Phế phẩm = số + lý do text tự do (bỏ danh mục mã lỗi — user chốt 07/2026).
 */
/**
 * id chi tiết/cụm — nhận CẢ id ảo cụm mặc nhiên `default-asm:<line_id>`
 * (lib/default-assembly, 27/08): service record sẽ vật chất hoá thành dòng
 * thật ở lượt ghi đầu tiên. Chỉ uuid trần thì phiếu ghi theo BỘ bị đá ngay
 * ở biên validate.
 */
const componentIdSchema = z
  .string()
  .regex(
    /^(default-asm:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'id chi tiết không hợp lệ',
  )

export const entryLineSchema = z
  .object({
    component_id: componentIdSchema,
    /** 0 hợp lệ khi dòng CHỈ báo phế (0173) — phát hiện phế lô cũ, không có đạt mới. */
    qty: z.coerce.number().min(0, 'SL không âm'),
    kg: z.coerce.number().min(0).optional().nullable(),
    defect_qty: z.coerce.number().min(0).default(0),
    defect_reason: z.string().trim().max(200).optional().nullable(),
    machine_note: z.string().trim().max(200).optional().nullable(),
    /** "Người làm" trực tiếp (0090) — text tự do như sổ giấy. */
    worker_name: z.string().trim().max(100).optional().nullable(),
    /** Hàng trần / hàng đang mây (0090) — cột ghi chú trạng thái của Excel. */
    finish_state: z.enum(['tran', 'dang_may']).optional().nullable(),
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
    if (e.qty <= 0 && (e.defect_qty ?? 0) <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['qty'],
        message: 'Dòng phải có SL đạt hoặc phế',
      })
    }
  })

export const entriesRecordSchema = z.object({
  stage: z.string().trim().min(1).max(50), // code catalog production_stage
  entry_date: z.string().date(),
  team_department_id: z.string().uuid().optional().nullable(),
  /** true = gửi tổ trưởng luôn; bỏ trống = lưu nháp (xem entry-doc-flow). */
  submit: z.boolean().default(false),
  /** Ghi chú cả phiếu. */
  note: z.string().trim().max(500).optional().nullable(),
  entries: z.array(entryLineSchema).min(1).max(200),
})

// ── Sổ toàn xưởng + chốt sổ ngày ─────────────────────────────────────────────

export const logbookQuerySchema = z.object({
  date: z.string().date(),
})

/** Bảng nhập theo công đoạn — lsx bỏ trống = mọi lệnh (màn tổng quan cần đếm). */
export const boardQuerySchema = z.object({
  date: z.string().date(),
  lsx: z.string().uuid().optional(),
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
  /** Công đoạn được gia công (0171) — NHẬN VỀ có stage mới cộng vào sổ tổng. */
  stage: z.string().trim().min(1).max(50).optional().nullable(),
  direction: z.enum(['send', 'receive']),
  entry_date: z.string().date(),
  qty: z.coerce.number().positive('SL phải > 0'),
  kg: z.coerce.number().min(0).optional().nullable(),
  defect_qty: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(500).optional().nullable(),
})
