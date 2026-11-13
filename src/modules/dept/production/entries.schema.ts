import { z } from 'zod'
import { CREW_MAX_HOURS, CREW_MAX_WORKERS } from '@/lib/gio-cong'

/**
 * Sổ số liệu sản xuất (thống kê xưởng nhập TẬP TRUNG — 0084). POST theo LÔ:
 * 1 lần lưu = nhiều chi tiết cùng công đoạn + ngày + tổ (thói quen lưới Excel).
 *
 * BA Ô, KHÔNG PHẢI HAI (0206, chép mô hình SAP — hệ duy nhất trong bốn hệ lớn
 * tách đủ): `qty` đạt · `defect_qty` phế bỏ hẳn · `rework_qty` hỏng nhưng cứu
 * được. Chỉ ĐẠT chạy tiếp công đoạn sau. Phế ăn mất đầu vào; sửa lại KHÔNG trừ
 * gì cả vì món đó vẫn còn — sửa xong ghi lần thứ hai vào ô đạt.
 *
 * LÝ DO LỖI có hai đường, cố ý: `defect_code` chọn từ danh mục
 * (`production_defect_codes`, lọc theo công đoạn) HOẶC `defect_reason` gõ tự
 * do. Danh mục từng bị bỏ 07/2026; nó quay lại ở dạng TUỲ CHỌN chứ không ép,
 * vì (a) mối lo cũ là danh sách dài nay đã giải bằng lọc theo công đoạn —
 * tổ sơn thấy ~7 mục thay vì 17, và (b) không hệ ERP lớn nào bắt buộc khai lý
 * do ngay ở lần ghi đầu. Chọn mã thì gộp Pareto được; gõ chữ thì vẫn ghi sổ
 * được, không ai bị kẹt.
 */
/**
 * id chi tiết/cụm — nhận CẢ hai loại id ẢO mà service `record` sẽ vật chất hoá
 * thành dòng thật ở lượt ghi đầu tiên:
 *   - `default-asm:<line_id>` — cụm khung mặc nhiên, hàn→sơn (27/08,
 *     lib/default-assembly)
 *   - `finish:<line_id>`      — bộ thành phẩm, lắp ráp→hoàn thiện (18/09,
 *     lib/finish-stages)
 *
 * Chỉ uuid trần thì mọi phiếu ghi theo BỘ bị đá ngay ở biên validate — lỗi chỉ
 * lộ ra lúc có người bấm Ghi sổ, vì tầng tổng hợp vẫn bày dòng ra bình thường.
 */
const componentIdSchema = z
  .string()
  .regex(
    /^(default-asm:|finish:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'id chi tiết không hợp lệ',
  )

export const entryLineSchema = z
  .object({
    component_id: componentIdSchema,
    /** 0 hợp lệ khi dòng CHỈ báo phế (0173) — phát hiện phế lô cũ, không có đạt mới. */
    qty: z.coerce.number().min(0, 'SL không âm'),
    kg: z.coerce.number().min(0).optional().nullable(),
    defect_qty: z.coerce.number().min(0).default(0),
    /** Hỏng nhưng CỨU ĐƯỢC. Không trừ tổng cần — sửa xong ghi lại vào `qty`. */
    rework_qty: z.coerce.number().min(0).default(0),
    /** Mã lý do (production_defect_codes.code) — tuỳ chọn, dùng chung phế/sửa. */
    defect_code: z.string().trim().max(50).optional().nullable(),
    defect_reason: z.string().trim().max(200).optional().nullable(),
    machine_note: z.string().trim().max(200).optional().nullable(),
    /**
     * Ô riêng của công đoạn (0207): {field_key: giá trị}. Khoá do
     * `production_stage_fields` khai — service kiểm khoá lạ và ô bắt buộc,
     * ở đây chỉ chặn kiểu và kích thước để khỏi nuốt một cục jsonb bất kỳ.
     */
    stage_meta: z
      .record(z.string().max(50), z.union([z.string().max(200), z.number()]))
      .refine((m) => Object.keys(m).length <= 20, 'Quá nhiều ô riêng')
      .optional()
      .nullable(),
    /** "Người làm" trực tiếp (0090) — text tự do như sổ giấy. */
    worker_name: z.string().trim().max(100).optional().nullable(),
    /** Hàng trần / hàng đang mây (0090) — cột ghi chú trạng thái của Excel. */
    finish_state: z.enum(['tran', 'dang_may']).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((e, ctx) => {
    const bad = (e.defect_qty ?? 0) > 0 || (e.rework_qty ?? 0) > 0
    // Một lý do cho cả phần không đạt của dòng. Tách hai ô lý do (một cho phế,
    // một cho sửa) làm lưới rộng thêm mà cùng một hiện tượng — "lệch mối hàn"
    // chỉ khác nhau ở chỗ cứu được hay không. Cần tách thật thì ghi hai lượt.
    if (bad && !e.defect_code && !e.defect_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['defect_reason'],
        message: 'Có phế hoặc sửa lại thì phải chọn mã lý do hoặc ghi lý do',
      })
    }
    // 'khac' một mình không nói gì — nó tồn tại để mở đường cho ô chữ.
    if (e.defect_code === 'khac' && !e.defect_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['defect_reason'],
        message: 'Chọn “Nguyên nhân khác” thì phải ghi rõ',
      })
    }
    if (e.qty <= 0 && (e.defect_qty ?? 0) <= 0 && (e.rework_qty ?? 0) <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['qty'],
        message: 'Dòng phải có SL đạt, phế hoặc sửa lại',
      })
    }
  })

/**
 * GIỜ CÔNG ĐẦU PHIẾU (0296): ca · số CN · giờ/người — một lần cho cả phiếu
 * (tổ × ngày × ca × công đoạn), không phải mỗi dòng (lỗi chép lặp của sổ
 * Excel). Số JSON trần, KHÔNG `coerce`: coerce biến null thành 0 rồi đá oan.
 */
export const entryCrewSchema = z.object({
  shift: z.number().int().min(1).max(3).optional().nullable(),
  worker_count: z
    .number()
    .int('Số công nhân phải là số nguyên')
    .min(1, 'Số công nhân ít nhất 1')
    .max(CREW_MAX_WORKERS)
    .optional()
    .nullable(),
  hours_per_worker: z
    .number()
    .gt(0, 'Giờ mỗi người phải lớn hơn 0')
    .max(CREW_MAX_HOURS, `Giờ mỗi người tối đa ${CREW_MAX_HOURS}`)
    .optional()
    .nullable(),
})

export const CREW_REQUIRED_MSG =
  'Ghi sổ chính thức phải có giờ công — ghi số công nhân và giờ mỗi người của tổ'

export const entriesRecordSchema = entryCrewSchema
  .extend({
    stage: z.string().trim().min(1).max(50), // code catalog production_stage
    entry_date: z.string().date(),
    team_department_id: z.string().uuid().optional().nullable(),
    /** true = gửi tổ trưởng luôn; bỏ trống = lưu nháp (xem entry-doc-flow). */
    submit: z.boolean().default(false),
    /** Ghi chú cả phiếu. */
    note: z.string().trim().max(500).optional().nullable(),
    entries: z.array(entryLineSchema).min(1).max(200),
  })
  .superRefine((v, ctx) => {
    // Nháp thì chưa cần (Q1 bản vẽ 11/11); chính thức thì số phải có chủ giờ.
    if (v.submit && (v.worker_count == null || v.hours_per_worker == null)) {
      ctx.addIssue({ code: 'custom', path: ['worker_count'], message: CREW_REQUIRED_MSG })
    }
  })

/** PATCH ghi chính thức phiếu nháp — kèm giờ công khi phiếu nháp chưa có. */
export const entryDocSubmitSchema = entryCrewSchema

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

/** Mở khoá (chỉ admin/manager) — DELETE qua query string; BẮT lý do (0295). */
export const dayUnlockQuerySchema = z.object({
  date: z.string().date(),
  team: z.string().uuid(),
  reason: z.string().trim().min(5, 'Lý do mở khoá ít nhất 5 ký tự').max(300),
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
