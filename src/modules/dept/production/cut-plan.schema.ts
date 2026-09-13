import { z } from 'zod'

/**
 * QUY CẮT PHÔI — schema ở biên API. Cả đợt cắt (đầu phiếu + dòng) gửi lên để
 * xuất Excel; server TÍNH LẠI sơ đồ từ dòng chứ không nhận kết quả client gửi —
 * một nguồn số, file in ra không thể lệch màn hình.
 */
const numOrBlank = z.union([z.number().min(0).max(1_000_000), z.literal('')])
/** Số lượng là số NGUYÊN — lưới và bộ đọc dán đã làm tròn, đây là hàng rào cuối. */
const intOrBlank = z.union([z.number().int().min(0).max(1_000_000), z.literal('')])

export const cutLineSchema = z.object({
  key: z.number().int(),
  part_name: z.string().max(200).default(''),
  length_mm: numOrBlank,
  qty: intOrBlank,
  spec: z.string().max(200).default(''),
  note: z.string().max(500).default(''),
})

export const cutPlanDocSchema = z.object({
  title: z.string().max(200).default(''),
  item: z.string().max(200).default(''),
  stock_length_mm: z.number().positive().max(100_000),
  /** Cây tiêu chuẩn riêng theo quy cách, khoá là `specKey`. */
  stock_by_spec: z
    .record(z.string().max(200), z.number().positive().max(100_000))
    .default({}),
  lines: z.array(cutLineSchema).max(5000),
})

/** Nạp định mức từ hồ sơ SP: mã SP + số lượng sản phẩm của đợt. */
export const cutPlanFromProductQuerySchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(1_000_000).default(1),
})
export type CutPlanDocInput = z.infer<typeof cutPlanDocSchema>
