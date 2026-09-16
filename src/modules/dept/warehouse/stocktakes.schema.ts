import { z } from 'zod'

/**
 * ĐỢT KIỂM KÊ (0199) — hàng rào ở biên API.
 *
 * Phạm vi là union có phân biệt (`kind`) chứ không phải ba trường tuỳ chọn:
 * ba trường rời nhau thì gửi được một đợt vừa theo khu vừa theo nhóm, và
 * service phải đoán ý. Union bắt người gọi chọn đúng một.
 *
 * KHÔNG CÓ NHÁNH 'all'. Đó là điểm của cả mục này — Đợt 1 đã chặn đường đếm
 * cả 13.229 mã, và schema là nơi làm cho việc chặn đó không có cửa lách.
 */
export const stocktakeScopeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bin'),
    bin_ids: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một khu để đếm'),
  }),
  z.object({
    kind: z.literal('group'),
    groups: z.array(z.string().trim().min(1)).min(1, 'Chọn ít nhất một nhóm vật tư'),
  }),
  z.object({
    kind: z.literal('list'),
    material_ids: z
      .array(z.string().uuid())
      .min(1, 'Danh sách phải có ít nhất một mã')
      .max(5000, 'Danh sách quá dài — chia thành nhiều đợt'),
  }),
])

export const stocktakeOpenSchema = z.object({
  scope: stocktakeScopeSchema,
  /** Mặc định MÙ (chủ dự án chốt 15/09/2026); người mở đợt bỏ được. */
  blind_count: z.coerce.boolean().default(true),
  assigned_to: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const stocktakeCountsSchema = z.object({
  counts: z
    .array(
      z.object({
        line_id: z.string().uuid(),
        /*
         * Số đếm KHÔNG ÂM và bắt buộc có. Muốn xoá số đã gõ thì đó là một
         * việc khác (chưa mở) — gửi null ở đây sẽ lẫn với "chưa đếm", đúng
         * thứ cột nullable sinh ra để phân biệt.
         */
        counted_qty: z.coerce.number().min(0, 'Số đếm không âm được'),
        note: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1, 'Không có dòng nào để lưu')
    .max(1000, 'Quá nhiều dòng một lượt — lưới lưu theo lô'),
})

export const stocktakeDecideSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision !== 'reject' || !!d.reason?.trim(), {
    message: 'Từ chối phải kèm lý do — người đếm cần biết đếm lại chỗ nào',
    path: ['reason'],
  })

export const stocktakeCancelSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
})

export const stocktakeListQuerySchema = z.object({
  status: z.enum(['open', 'counting', 'review', 'approved', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
})
