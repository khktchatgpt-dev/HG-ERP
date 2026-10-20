import { z } from 'zod'

/**
 * HẠNG MỤC NGOÀI SẢN XUẤT (0230) — "Xây dựng văn phòng", "Dự trữ kho"…
 * Đơn mua ngoài lệnh thuộc về một hạng mục. Không có vòng duyệt: chỉ mở / đóng.
 */
export const PROJECT_STATUSES = ['open', 'closed'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

const text = (max: number) => z.string().trim().max(max).optional().nullable()

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Tên hạng mục ít nhất 2 ký tự').max(200),
  /** Loại việc — gõ tự do kèm gợi ý (lib/po-muc-dich). */
  kind: z.string().trim().min(2, 'Chọn hoặc gõ loại hạng mục').max(120),
  /** Dự toán — chỉ để theo dõi "đã tiêu / dự toán", không chặn đơn nào. */
  budget: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().trim().toUpperCase().length(3).default('VND'),
  note: text(2000),
})

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  kind: z.string().trim().min(2).max(120).optional(),
  budget: z.coerce.number().min(0).optional().nullable(),
  note: text(2000),
  owner_id: z.string().uuid().optional(),
  /** Đóng = không chọn được cho đơn mới; đơn cũ giữ nguyên. Mở lại được. */
  status: z.enum(PROJECT_STATUSES).optional(),
})

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
