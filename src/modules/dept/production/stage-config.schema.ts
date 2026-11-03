import { z } from 'zod'
import { CORE_MODES, COUNT_LEVELS } from '@/lib/stage-config'

/**
 * CẤU HÌNH CÔNG ĐOẠN (B1, 0287) — zod cho màn `/production/cau-hinh/cong-doan`.
 *
 * Một PATCH mang các PHẦN tuỳ chọn của một công đoạn; phần nào gửi thì thay
 * trọn phần đó (ô riêng / mã lỗi gửi là DANH SÁCH ĐẦY ĐỦ của công đoạn: thiếu
 * mục nào thì mục đó ngừng dùng — không xoá, sổ cũ còn tham chiếu khoá/mã).
 */

const codeRegex = /^[a-z0-9_]+$/
const codeField = (msg: string) => z.string().trim().min(1).max(50).regex(codeRegex, msg)

const coreMode = z.enum(CORE_MODES)

export const stageMetaSchema = z.object({
  count_level: z.enum(COUNT_LEVELS),
  core: z.object({
    defect: coreMode,
    rework: coreMode,
    kg: coreMode,
    worker: coreMode,
  }),
  /** Mã công đoạn cấp đầu vào; null = đầu chuỗi / để máy suy. */
  input_from: z.string().trim().max(50).nullable(),
})
export type StageMetaInput = z.infer<typeof stageMetaSchema>

export const stageFieldInputSchema = z
  .object({
    field_key: codeField('Khoá ô chỉ gồm chữ thường, số, gạch dưới (vd: may_han)'),
    label: z.string().trim().min(1, 'Nhập tên ô').max(100),
    kind: z.enum(['text', 'number', 'select']),
    options: z.array(z.string().trim().min(1).max(100)).max(30).nullable().optional(),
    required: z.boolean().default(false),
    min_value: z.coerce.number().nullable().optional(),
    max_value: z.coerce.number().nullable().optional(),
    sort_order: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((f, ctx) => {
    if (f.kind === 'select' && !(f.options && f.options.length > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `Ô "${f.label}" kiểu chọn phải có ít nhất một lựa chọn`,
      })
    }
    if (
      f.kind === 'number' &&
      f.min_value != null &&
      f.max_value != null &&
      f.min_value > f.max_value
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_value'],
        message: `Ô "${f.label}": tối thiểu lớn hơn tối đa`,
      })
    }
  })
export type StageFieldInput = z.infer<typeof stageFieldInputSchema>

export const defectCodeInputSchema = z.object({
  code: codeField('Mã lỗi chỉ gồm chữ thường, số, gạch dưới (vd: han_nut)'),
  label: z.string().trim().min(1, 'Nhập tên lỗi').max(120),
  sort_order: z.coerce.number().int().min(0).default(0),
})
export type DefectCodeInput = z.infer<typeof defectCodeInputSchema>

export const stageConfigPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    meta: stageMetaSchema.optional(),
    /** id các tổ (departments, workspace production) phụ trách công đoạn này. */
    team_ids: z.array(z.string().uuid()).max(30).optional(),
    fields: z.array(stageFieldInputSchema).max(20).optional(),
    defect_codes: z.array(defectCodeInputSchema).max(60).optional(),
    is_active: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    const keys = (p.fields ?? []).map((f) => f.field_key)
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Khoá ô bị trùng' })
    const codes = (p.defect_codes ?? []).map((d) => d.code)
    if (new Set(codes).size !== codes.length)
      ctx.addIssue({ code: 'custom', path: ['defect_codes'], message: 'Mã lỗi bị trùng' })
  })
export type StageConfigPatch = z.infer<typeof stageConfigPatchSchema>

export const stageCreateSchema = z.object({
  code: codeField('Mã công đoạn chỉ gồm chữ thường, số, gạch dưới (vd: qc)'),
  label: z.string().trim().min(1, 'Nhập tên công đoạn').max(100),
  meta: stageMetaSchema.optional(),
})
export type StageCreateInput = z.infer<typeof stageCreateSchema>
