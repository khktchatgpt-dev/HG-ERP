import { z } from 'zod'

/**
 * BẢNG KÊ VẬT TƯ THEO LSX (BKVT) — bảng làm việc của phòng Cung ứng, đứng giữa
 * "lệnh cần gì" và "đặt của ai" (migration 0108).
 *
 * Trạng thái dòng tách khỏi `supplier_id` vì cột NCC của file thật KHÔNG phải
 * lúc nào cũng là nhà cung cấp:
 *   · `self_make` — HGIA: pát xưởng tự làm rồi xuất đi xi
 *   · `enough`    — ĐỦ: tồn đủ, khỏi mua
 *   · `other`     — TQ / hàng có sẵn / mua ngoài, không lập đơn trong app
 * Dòng như vậy vẫn "đã quyết" nhưng không sinh đơn nào.
 */
export const PLAN_STATUSES = [
  'pending', // chưa quyết
  'assigned', // đã gán NCC, chờ tách đơn
  'self_make',
  'enough',
  'other',
  'ordered', // đã vào đơn (po_line_id)
] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

export const PLAN_SOURCES = ['excel', 'bom', 'manual'] as const

const optText = (max: number) => z.string().trim().max(max).optional().nullable()
const optNum = (max: number) => z.coerce.number().min(0).max(max).optional().nullable()

/**
 * Một dòng bảng kê. `material_name` là BẮT BUỘC còn `material_id` thì không —
 * file thật có tên chưa từng vào danh mục kho ("Pat xoay 3 lỗ vít, 7 màu"). Bắt
 * buộc khoá ngoại là mất dòng, mà mất dòng nghĩa là quên mua.
 */
export const planRowInputSchema = z.object({
  product_code: optText(50),
  product_name: optText(200),
  product_id: z.string().uuid().optional().nullable(),
  material_id: z.string().uuid().optional().nullable(),
  material_name: z.string().trim().min(1, 'Thiếu tên vật tư').max(300),
  unit: optText(20),
  qty_per_product: optNum(1e6), // đm/sp
  product_qty: optNum(1e9), // SL sản phẩm trong LSX
  qty_required: optNum(1e9), // SL đặt hàng — bỏ trống thì tính đm/sp × SL
  waste_pct: optNum(100),
  qty_on_hand: optNum(1e9),
  qty_to_order: optNum(1e9), // bỏ trống thì tính từ hao + tồn
  unit_price: optNum(1e12),
  supplier_id: z.string().uuid().optional().nullable(),
  supplier_label: optText(50), // mã nguyên văn trên file: TTL, HGIA, TQ…
  status: z.enum(PLAN_STATUSES).optional(),
  note: optText(500), // cột VTRL
})
export type PlanRowInput = z.infer<typeof planRowInputSchema>

export const planImportSchema = z.object({
  production_order_id: z.string().uuid(),
  source: z.enum(PLAN_SOURCES).default('excel'),
  /** true = thay toàn bộ dòng cùng nguồn (nạp lại file đã sửa), false = nối thêm. */
  replace: z.coerce.boolean().default(true),
  rows: z.array(planRowInputSchema).min(1).max(2000),
})

/**
 * Gán hàng loạt: chọn nhiều dòng rồi quyết một lần. Gửi `supplier_id` thì trạng
 * thái tự về 'assigned' (service lo), khỏi bắt client gửi hai trường ăn khớp nhau.
 */
export const planAssignSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    supplier_id: z.string().uuid().nullable().optional(),
    status: z.enum(PLAN_STATUSES).optional(),
    material_id: z.string().uuid().nullable().optional(),
    waste_pct: optNum(100),
    qty_to_order: optNum(1e9),
    unit_price: optNum(1e12),
    note: optText(500),
  })
  .refine(
    (v) =>
      v.supplier_id !== undefined ||
      v.status !== undefined ||
      v.material_id !== undefined ||
      v.waste_pct != null ||
      v.qty_to_order != null ||
      v.unit_price != null ||
      v.note != null,
    'Không có gì để cập nhật',
  )

/** Tách đơn: mỗi NCC một đơn, chỉ lấy dòng đã gán và chưa vào đơn nào. */
export const planSplitSchema = z.object({
  production_order_id: z.string().uuid(),
  /** Giới hạn ở vài NCC — bỏ trống là tách hết. */
  supplier_ids: z.array(z.string().uuid()).max(50).optional(),
  expected_at: z.string().date().optional().nullable(),
  currency: z.string().trim().toUpperCase().length(3).default('VND'),
})

export const planListQuerySchema = z.object({
  production_order_id: z.string().uuid(),
})
