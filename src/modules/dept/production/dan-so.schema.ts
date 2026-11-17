import { z } from 'zod'

/**
 * Dán sổ Excel (bản vẽ 17/11/2026) — client đọc vùng dán bằng `lib/dan-so`, gửi
 * các dòng đã đọc lên; server khớp với bảng chi tiết của lệnh rồi mới ghi.
 * Số JSON trần (không coerce): ô trống không được biến thành 0.
 */
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const danSoDongSchema = z.object({
  hang: z.number().int().min(1),
  cum: z.string().trim().max(200),
  ten: z.string().trim().min(1).max(200),
  ma_sp: z.string().trim().max(100).nullable().optional(),
  ct_sp: z.number().positive().max(1000).nullable().optional(),
  dm: z.number().min(0).max(100000).nullable().optional(),
  can: z.number().min(0).nullable().optional(),
  o: z.record(iso, z.number().positive().max(10_000_000)),
  sai: z.array(z.object({ iso, raw: z.string().max(40) })).max(400),
})

export const danSoSchema = z.object({
  lsx_id: z.string().uuid(),
  /** Dòng SP mặc định cho các dòng không có cột Mã SP (lệnh một dòng thì bỏ trống). */
  line_id: z.string().uuid().nullable().optional(),
  stage: z.string().trim().min(1).max(50),
  team_id: z.string().uuid(),
  cot: z.array(iso).min(1).max(400),
  rows: z.array(danSoDongSchema).min(1).max(1500),
})

export type DanSoInput = z.infer<typeof danSoSchema>
export type DanSoDong = z.infer<typeof danSoDongSchema>
