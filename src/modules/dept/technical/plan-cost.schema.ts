import { z } from 'zod'

/**
 * Nạp giá thành kế hoạch hàng loạt (0220). Bốn số tuyệt đối theo tiền tệ của
 * bản báo giá; khớp tổng (trực tiếp + chung + lợi nhuận = FOB) kiểm ở service
 * bằng `planCheck` với dung sai theo tiền tệ — schema chỉ chặn thứ chắc chắn sai.
 */
const money = z.coerce.number().max(1_000_000_000)

/**
 * Một dòng có HAI dạng (02/10/2026, sau khi rà Drive của Sale):
 * - ĐỦ BỐN SỐ: trực tiếp · chung · lợi nhuận · FOB — bản báo giá HG tự lập.
 * - CHỈ FOB: ba số kia null — khách chỉ có bảng giá đã chốt (đơn MERXX, bảng
 *   giá ROSCO), không có bảng tính. Vẫn đáng lưu: doanh thu "theo KH" của lệnh
 *   cần FOB, còn giá thành KH thì chờ. Không cho dở dang (có 1–2 trong 3 số).
 */
export const planCostItemSchema = z
  .object({
    product_id: z.string().uuid(),
    direct: money.min(0).optional().nullable(),
    overhead: money.min(0).optional().nullable(),
    profit: money.optional().nullable(),
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
  .refine(
    (it) => {
      const n = [it.direct, it.overhead, it.profit].filter((v) => v != null).length
      return n === 0 || n === 3
    },
    {
      message:
        'Ghi đủ ba số trực tiếp · chung · lợi nhuận, hoặc bỏ trống cả ba (chỉ FOB)',
    },
  )

/** Dòng đủ bốn số — để kiểm tổng. */
export const hasFullPlan = <
  T extends { direct?: number | null; overhead?: number | null; profit?: number | null },
>(
  it: T,
): it is T & { direct: number; overhead: number; profit: number } =>
  it.direct != null && it.overhead != null && it.profit != null

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
