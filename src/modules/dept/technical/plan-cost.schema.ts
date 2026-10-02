import { z } from 'zod'

/**
 * Nạp giá thành kế hoạch hàng loạt (0220). Bốn số tuyệt đối theo tiền tệ của
 * bản báo giá; khớp tổng (trực tiếp + chung + lợi nhuận = FOB) kiểm ở service
 * bằng `planCheck` với dung sai theo tiền tệ — schema chỉ chặn thứ chắc chắn sai.
 */
const money = z.coerce.number().max(1_000_000_000)

export const planCostItemSchema = z.object({
  product_id: z.string().uuid(),
  direct: money.min(0),
  overhead: money.min(0),
  profit: money,
  price: money.min(0),
  /** Các dòng trực tiếp chép từ bảng tính — tuỳ chọn, chỉ để soi. */
  breakdown: z
    .array(
      z.object({ label: z.string().trim().min(1).max(80), amount: z.coerce.number() }),
    )
    .max(60)
    .optional()
    .nullable(),
})

export const planCostBulkSchema = z.object({
  items: z
    .array(planCostItemSchema)
    .min(1, 'Chưa có dòng nào cần lưu')
    .max(500)
    .refine(
      (items) => new Set(items.map((i) => i.product_id)).size === items.length,
      'Một sản phẩm xuất hiện hai lần trong cùng lần lưu',
    ),
  currency: z.enum(['USD', 'VND']).default('USD'),
  /** Tỷ giá Sale dùng trong bảng tính (25.000–26.000) — để truy số VND gốc. */
  fx_rate: z.coerce.number().positive().max(1_000_000).optional().nullable(),
  source: z.string().trim().min(1, 'Ghi tên bản báo giá đã lấy số').max(200),
})

export type PlanCostItemInput = z.infer<typeof planCostItemSchema>
export type PlanCostBulkInput = z.infer<typeof planCostBulkSchema>
