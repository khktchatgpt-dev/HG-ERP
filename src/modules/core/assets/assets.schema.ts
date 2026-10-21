import { z } from 'zod'

/** Zod ở RANH GIỚI API của khu Máy móc (0270). Service tin input đã qua đây. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng yyyy-mm-dd')
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
const money = z.number().min(0).max(1e13)
const uuidOrNull = z
  .uuid()
  .optional()
  .nullable()
  .transform((v) => v ?? null)

export const partSchema = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.number().positive().max(1e6),
  price: money,
})

const assetFields = {
  name: z.string().trim().min(2, 'Tên máy ít nhất 2 ký tự').max(200),
  group_id: z.string().trim().min(1).max(10),
  model: optText(120),
  serial: optText(120),
  supplier: optText(200),
  department_id: uuidOrNull,
  resp_employee_id: uuidOrNull,
  use_date: isoDate
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  purchase_date: isoDate
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  cost: money.optional().default(0),
  hours_per_day: z.number().min(0).max(24).optional().default(0),
  qty: z.number().int().min(1).max(100000).optional().default(1),
  unit: z.string().trim().min(1).max(20).optional(),
  note: optText(2000),
}

export const assetCreateSchema = z.object({
  ...assetFields,
  /** Chỉ số mẫu lịch của nhóm được giữ (bỏ trống = giữ hết). */
  template_idx: z.array(z.number().int().min(0).max(50)).optional(),
  /** Dụng cụ mới tạo nằm trong kho; máy mới tạo đang chạy trừ khi chọn khác. */
  status: z.enum(['dang_dung', 'chua_dung']).optional(),
})
export type AssetCreateInput = z.infer<typeof assetCreateSchema>

export const assetUpdateSchema = z.object({
  name: assetFields.name.optional(),
  model: assetFields.model,
  serial: assetFields.serial,
  supplier: assetFields.supplier,
  department_id: z.uuid().optional().nullable(),
  resp_employee_id: z.uuid().optional().nullable(),
  use_date: isoDate.optional().nullable(),
  purchase_date: isoDate.optional().nullable(),
  cost: money.optional(),
  hours_per_day: z.number().min(0).max(24).optional(),
  note: assetFields.note,
  /** Đưa máy chưa dùng vào chạy, hoặc báo mất / thanh lý (kèm `reason`). */
  status: z.enum(['dang_dung', 'chua_dung', 'mat', 'thanh_ly']).optional(),
  reason: optText(500),
})
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>

export const hoursSchema = z.object({ hours: z.number().min(0).max(1e9) })

export const planCreateSchema = z.object({
  task: z.string().trim().min(3, 'Tên công việc ít nhất 3 ký tự').max(200),
  every_n: z.number().int().min(1).max(100000),
  unit: z.enum(['h', 'd', 'm']),
  cost: money.optional().default(0),
  is_inspection: z.boolean().optional().default(false),
})
export type PlanCreateInput = z.infer<typeof planCreateSchema>

export const planUpdateSchema = z.object({
  task: z.string().trim().min(3).max(200).optional(),
  every_n: z.number().int().min(1).max(100000).optional(),
  cost: money.optional(),
  active: z.boolean().optional(),
})

export const planDoneSchema = z.object({
  done_on: isoDate,
  tech_employee_id: uuidOrNull,
  vendor: optText(200),
  hours: z.number().min(0).max(1e9).optional().nullable(),
  parts: z.array(partSchema).max(20).optional().default([]),
  labor: money.optional().default(0),
  downtime_hours: z.number().min(0).max(10000).optional().default(0),
  note: optText(2000),
})
export type PlanDoneInput = z.infer<typeof planDoneSchema>

export const issueCreateSchema = z.object({
  asset_id: z.uuid(),
  priority: z.enum(['dung_may', 'van_chay']),
  description: z.string().trim().min(5, 'Mô tả hiện tượng ít nhất 5 ký tự').max(2000),
  file_ids: z.array(z.uuid()).max(6).optional().default([]),
})
export type IssueCreateInput = z.infer<typeof issueCreateSchema>

export const issueAcceptSchema = z
  .object({
    tech_employee_id: uuidOrNull,
    vendor: optText(200),
    estimate: money
      .optional()
      .nullable()
      .transform((v) => v ?? null),
    note: optText(1000),
  })
  .refine((v) => v.tech_employee_id || v.vendor, {
    path: ['vendor'],
    message: 'Chọn thợ Tổ Cơ điện hoặc ghi đơn vị thuê ngoài',
  })
export type IssueAcceptInput = z.infer<typeof issueAcceptSchema>

export const issueRejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Ghi lý do / hướng xử lý khác (ít nhất 5 ký tự)')
    .max(1000),
})

export const issueDoneSchema = z.object({
  parts: z.array(partSchema).max(20).optional().default([]),
  labor: money.optional().default(0),
  downtime_hours: z.number().min(0).max(10000),
  note: z
    .string()
    .trim()
    .min(5, 'Ghi nguyên nhân, cách khắc phục (ít nhất 5 ký tự)')
    .max(2000),
})
export type IssueDoneInput = z.infer<typeof issueDoneSchema>

export const issueCancelSchema = z.object({
  reason: z.string().trim().min(5, 'Ghi lý do huỷ (ít nhất 5 ký tự)').max(1000),
})

export const toolGiveSchema = z.object({
  employee_id: z.uuid(),
  asset_ids: z.array(z.uuid()).min(1, 'Chọn ít nhất một dụng cụ').max(100),
  moved_on: isoDate,
  note: optText(500),
})
export type ToolGiveInput = z.infer<typeof toolGiveSchema>

export const toolRecallSchema = z.object({
  asset_ids: z.array(z.uuid()).min(1, 'Chọn ít nhất một dụng cụ').max(100),
  condition: z.enum(['tot', 'hong']),
  moved_on: isoDate,
  note: optText(500),
})
export type ToolRecallInput = z.infer<typeof toolRecallSchema>

export const costQuerySchema = z.object({
  ym: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})
