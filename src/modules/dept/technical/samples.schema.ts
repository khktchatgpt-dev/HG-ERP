import { z } from 'zod'

/**
 * Mẫu showroom (0061). `status` = mẫu đang ở đâu, `condition` = mẫu còn lành hay
 * không — TÁCH RIÊNG có chủ đích: mẫu đang cho mượn vẫn có thể bị xước, gộp làm
 * một là mất thông tin ngay khi mẫu vừa hỏng vừa đi mượn.
 */
export const SAMPLE_STATUSES = [
  'in_showroom',
  'on_loan',
  'maintenance',
  'lost',
  'disposed',
] as const
export type SampleStatus = (typeof SAMPLE_STATUSES)[number]

export const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = {
  in_showroom: 'Ở showroom',
  on_loan: 'Đang cho mượn',
  maintenance: 'Đang sửa',
  lost: 'Mất',
  disposed: 'Đã thanh lý',
}

export const SAMPLE_CONDITIONS = ['new', 'good', 'scratched', 'damaged'] as const
export type SampleCondition = (typeof SAMPLE_CONDITIONS)[number]

export const SAMPLE_CONDITION_LABEL: Record<SampleCondition, string> = {
  new: 'Mới',
  good: 'Tốt',
  scratched: 'Xước nhẹ',
  damaged: 'Hỏng',
}

export const BORROWER_KINDS = ['user', 'customer', 'other'] as const
export type BorrowerKind = (typeof BORROWER_KINDS)[number]

export const BORROWER_KIND_LABEL: Record<BorrowerKind, string> = {
  user: 'Nhân viên',
  customer: 'Khách hàng',
  other: 'Đối tác ngoài',
}

/** Số ảnh tối đa mỗi mẫu ("4 góc"). Ép ở service, không ở DB — đổi số khỏi migration. */
export const MAX_SAMPLE_PHOTOS = 4

const nullableText = z.string().trim().max(500).optional().nullable()

export const sampleCreateSchema = z.object({
  product_id: z.uuid(),
  condition: z.enum(SAMPLE_CONDITIONS).default('good'),
  location: nullableText,
  acquired_at: z.iso.date().optional().nullable(),
  note: nullableText,
  /** Tạo nhiều hiện vật cùng lúc cho 1 SP (3 ghế giống nhau = 3 mẫu, 3 mã). */
  quantity: z.number().int().min(1).max(20).default(1),
})
export type SampleCreateInput = z.infer<typeof sampleCreateSchema>

export const sampleUpdateSchema = z.object({
  location: nullableText,
  acquired_at: z.iso.date().optional().nullable(),
  note: nullableText,
})
export type SampleUpdateInput = z.infer<typeof sampleUpdateSchema>

export const sampleConditionSchema = z.object({
  condition: z.enum(SAMPLE_CONDITIONS),
  note: nullableText,
})

export const sampleStatusSchema = z.object({
  status: z.enum(['in_showroom', 'maintenance', 'lost', 'disposed']),
  note: nullableText,
})

export const sampleListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(SAMPLE_STATUSES).optional(),
  product_id: z.uuid().optional(),
  /** Chỉ mẫu quá hạn trả — lọc hay dùng nhất khi đi đòi mẫu về. */
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(24),
})
export type SampleListQuery = z.infer<typeof sampleListQuerySchema>

export const loanCreateSchema = z
  .object({
    borrower_kind: z.enum(BORROWER_KINDS),
    borrower_user_id: z.uuid().optional().nullable(),
    borrower_customer_id: z.uuid().optional().nullable(),
    /** Bắt buộc với 'other'; với user/customer thì service tự điền tên từ hồ sơ. */
    borrower_name: z.string().trim().min(1).max(200).optional().nullable(),
    borrower_contact: nullableText,
    purpose: nullableText,
    due_at: z.iso.date().optional().nullable(),
    note: nullableText,
  })
  .superRefine((v, ctx) => {
    // Khớp đúng check `loan_borrower_shape` ở DB (0061). Kiểm ở đây để báo lỗi
    // tiếng Việt tử tế thay vì để Postgres ném constraint violation.
    if (v.borrower_kind === 'user' && !v.borrower_user_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['borrower_user_id'],
        message: 'Chọn nhân viên mượn',
      })
    }
    if (v.borrower_kind === 'customer' && !v.borrower_customer_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['borrower_customer_id'],
        message: 'Chọn khách hàng mượn',
      })
    }
    if (v.borrower_kind === 'other' && !v.borrower_name) {
      ctx.addIssue({
        code: 'custom',
        path: ['borrower_name'],
        message: 'Nhập tên người mượn',
      })
    }
  })
export type LoanCreateInput = z.infer<typeof loanCreateSchema>

export const loanReturnSchema = z.object({
  returned_condition: z.enum(SAMPLE_CONDITIONS),
  note: nullableText,
})
export type LoanReturnInput = z.infer<typeof loanReturnSchema>

export const loanListQuerySchema = z.object({
  sample_id: z.uuid().optional(),
  open_only: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
})
