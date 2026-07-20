import { z } from 'zod'

// Vòng đời có bước duyệt: Sales phát → GĐ duyệt → SX → hoàn thành.
// 'cancelled' = đơn hàng huỷ giữa chừng kéo LSX dừng theo (0036, plan P3).
export const LSX_STATUSES = [
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
] as const
export type LsxStatus = (typeof LSX_STATUSES)[number]

/** GĐ từ chối LSX — bắt buộc lý do. */
export const lsxRejectSchema = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do từ chối').max(1000),
})

/**
 * Sales gửi duyệt lại LSX bị từ chối — cho sửa kèm header (lý do từ chối
 * thường nằm ở chính các trường này). Field không gửi = giữ nguyên.
 */
export const lsxResubmitSchema = z.object({
  ship_date: z.string().date().optional().nullable(),
  received_date: z.string().date().optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/** Spec sản xuất per dòng LSX (OI-11: Sales nhập khi phát, override tech_spec SP). */
export const lsxLineSpecSchema = z.object({
  order_line_id: z.string().uuid(),
  specs: z
    .object({
      machine: z.string().trim().max(200),
      cushion: z.string().trim().max(200),
      paint: z.string().trim().max(200),
      glass: z.string().trim().max(200),
      wood: z.string().trim().max(200),
    })
    .partial(),
  note: z.string().trim().max(1000).optional().nullable(),
  important_note: z.string().trim().max(1000).optional().nullable(),
})
export const lsxSpecsSaveSchema = z.object({
  lines: z.array(lsxLineSpecSchema).max(500),
})

/** Giai đoạn SX = code catalog_items type 'production_stage' (phoi/han/son/mai/hoan_thien). */
export const issueLsxSchema = z.object({
  code: z.string().trim().min(1, 'Nhập số LSX').max(50), // người dùng tự đặt số LSX
  order_id: z.string().uuid(),
  ship_date: z.string().date().optional().nullable(),
  received_date: z.string().date().optional().nullable(), // Ngày nhận (in trên LSX)
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

/** Cập nhật giai đoạn (FR-PROD-01) — 'done' ở giai đoạn cuối do nút Hoàn thành riêng. */
export const stageUpdateSchema = z.object({
  stage: z.string().trim().min(1).max(50),
  action: z.enum(['start', 'done']).default('done'),
  note: z.string().trim().max(1000).optional().nullable(),
})

/** Kanban tổ (tách vai 07/2026): tổ đánh dấu thẻ LSX × công đoạn. */
export const teamStageSchema = z.object({
  lsx_id: z.string().uuid(),
  stage: z.string().trim().min(1).max(50),
  action: z.enum(['start', 'done']),
  note: z.string().trim().max(1000).optional().nullable(),
})

export const teamBoardQuerySchema = z.object({
  stage: z.string().trim().min(1).max(50).optional(),
})

export const lsxListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(LSX_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})
