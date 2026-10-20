import { z } from 'zod'

/**
 * Máy trạng thái đơn bán (0223, 07/10/2026 — chốt D4): bỏ `in_production`
 * (chưa bao giờ xảy ra thật), thêm hai trạng thái SUY từ Σ đợt xuất:
 *   confirmed → lsx_pending → lsx_issued → completed → partially_shipped → shipped → delivered
 * `partially_shipped` đi được từ lsx_issued (lệnh gộp xuất từng đợt trước khi
 * cả lệnh xong). Logic suy: `src/lib/order-ship-status.ts`.
 */
export const ORDER_STATUSES = [
  'confirmed',
  'lsx_pending',
  'lsx_issued',
  'completed',
  'partially_shipped',
  'shipped',
  'delivered',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderLineInputSchema = z.object({
  /**
   * id dòng đang có — form sửa gửi kèm để server KHỚP THEO DÒNG (chốt D2,
   * 07/10/2026: một SP được nhiều dòng, mỗi dòng một tuần giao). Thiếu id =
   * dòng mới. Form cũ không gửi id thì repo khớp theo product_id như trước.
   */
  id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  // Ngày giao kế hoạch từng dòng = HẠN CUỐI của tuần giao (0121). Nhãn tuần
  // 'w37.26' trên sổ/hợp đồng suy từ ngày này (src/lib/ship-week.ts).
  ship_date: z.string().date().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

/**
 * Tạo đơn — 2 cách:
 *  - TỪ BÁO GIÁ đã chốt: gửi `quote_id`, dòng SP + điều khoản snapshot từ báo giá.
 *  - TRỰC TIẾP (không báo giá): gửi `customer_id` + `lines` (≥1), tuỳ chọn
 *    currency/price_term/payment_terms. Đơn là bản ghi của sale, mốc phát LSX.
 */
export const orderCreateSchema = z
  .object({
    code: z.string().trim().min(1, 'Nhập mã đơn hàng').max(50), // sale tự đặt mã
    quote_id: z.string().uuid().optional().nullable(),
    // Chỉ dùng khi KHÔNG có quote_id:
    customer_id: z.string().uuid().optional().nullable(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    price_term: z.string().trim().max(100).optional().nullable(),
    payment_terms: z.string().trim().max(500).optional().nullable(),
    // D2: KHÔNG còn chặn trùng SP — ART giao hai tuần là hai dòng cùng mã.
    lines: z.array(orderLineInputSchema).max(200).optional(),
    // Header dùng chung cho cả 2 cách:
    customer_po_no: z.string().trim().max(100).optional().nullable(), // PO# của khách — in trên LSX
    /** Khách không có số PO (tick xác nhận) — không tick thì PO là BẮT BUỘC (07/10/2026). */
    no_customer_po: z.boolean().optional(),
    due_date: z.string().date().optional().nullable(),
    deposit_percent: z.coerce.number().min(0).max(100).optional().nullable(),
    container_summary: z.string().trim().max(100).optional().nullable(), // "1 x 40'HC"
    note: z.string().trim().max(2000).optional().nullable(),
    // Điều khoản xuất khẩu (Sales Contract Art 3/5):
    qty_tolerance_pct: z.coerce.number().min(0).max(100).optional().nullable(),
    partial_shipment: z.boolean().optional().nullable(),
    transhipment: z.boolean().optional().nullable(),
    port_of_loading: z.string().trim().max(200).optional().nullable(),
    port_of_discharge: z.string().trim().max(200).optional().nullable(),
    payment_method: z.string().trim().max(200).optional().nullable(),
    required_docs: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((o) => !!o.quote_id || !!o.customer_id, {
    message: 'Chọn báo giá, hoặc chọn khách hàng để tạo đơn trực tiếp',
    path: ['customer_id'],
  })
  .refine((o) => (o.lines?.length ?? 0) >= 1, {
    // Cả đơn từ báo giá lẫn đơn trực tiếp đều cần dòng SP + SL (báo giá không có SL).
    message: 'Đơn phải có ít nhất 1 dòng sản phẩm',
    path: ['lines'],
  })
  .refine((o) => !!o.customer_po_no?.trim() || o.no_customer_po === true, {
    // 19/53 đơn thật thiếu PO khách (07/10/2026) — PO in lên LSX và hợp đồng.
    message: 'Nhập số PO của khách, hoặc tick "Khách không có số PO"',
    path: ['customer_po_no'],
  })

/** Cập nhật khi khách thay đổi (FR-SAL-05) — mọi thay đổi được ghi lịch sử. */
export const orderUpdateSchema = z.object({
  customer_po_no: z.string().trim().max(100).optional().nullable(),
  no_customer_po: z.boolean().optional(),
  due_date: z.string().date().optional().nullable(),
  deposit_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  price_term: z.string().trim().max(100).optional().nullable(),
  payment_terms: z.string().trim().max(500).optional().nullable(),
  container_summary: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  qty_tolerance_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  partial_shipment: z.boolean().optional().nullable(),
  transhipment: z.boolean().optional().nullable(),
  port_of_loading: z.string().trim().max(200).optional().nullable(),
  port_of_discharge: z.string().trim().max(200).optional().nullable(),
  payment_method: z.string().trim().max(200).optional().nullable(),
  required_docs: z.string().trim().max(2000).optional().nullable(),
  change_note: z.string().trim().max(1000).optional().nullable(), // lý do khách đổi
  lines: z
    .array(orderLineInputSchema)
    .min(1, 'Đơn hàng phải còn ít nhất 1 dòng sản phẩm')
    .max(200)
    .optional(), // không gửi lines = chỉ sửa header
})

/**
 * Điền đơn giá HÀNG LOẠT cho nhiều dòng thuộc nhiều đơn (14/08/2026).
 *
 * Tách khỏi `orderUpdateSchema` vì đây là thao tác khác về bản chất: chỉ đặt một
 * cột `unit_price`, không đụng số lượng / ngày giao / điều khoản, và đi qua nhiều
 * đơn một lần. Dùng `orderUpdateSchema` cho việc này thì phải gửi lại TOÀN BỘ
 * dòng của từng đơn — mở cửa cho việc ghi đè qty bằng dữ liệu cũ trên màn hình.
 */
export const orderBulkPriceSchema = z.object({
  items: z
    .array(
      z.object({
        line_id: z.string().uuid(),
        unit_price: z.coerce.number().min(0, 'Đơn giá không được âm'),
      }),
    )
    .min(1, 'Chưa có dòng nào cần lưu')
    .max(500)
    .refine(
      (items) => new Set(items.map((i) => i.line_id)).size === items.length,
      'Một dòng xuất hiện hai lần trong cùng lần lưu',
    ),
  /** Vì sao điền/sửa giá — vào lịch sử đơn, để 6 tháng sau tra lại còn hiểu. */
  note: z.string().trim().max(1000).optional().nullable(),
})
export type OrderBulkPriceInput = z.infer<typeof orderBulkPriceSchema>

export const orderListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  customer_id: z.string().uuid().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Huỷ đơn phải kèm lý do').max(1000),
})

/** Ghi một đợt THỰC XUẤT cho một dòng đơn (giao hàng từng phần — 0120). */
export const shipmentCreateSchema = z.object({
  order_line_id: z.string().uuid(),
  qty: z.coerce.number().positive('Số lượng xuất phải > 0'),
  shipped_at: z.string().date().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(), // số cont / booking
})

/**
 * Ghi MỘT ĐỢT XUẤT cho nhiều dòng một lượt (một container = nhiều dòng, 07/10/2026).
 * Cùng ngày + cùng ghi chú (số cont / booking) cho cả đợt.
 */
export const shipmentsCreateSchema = z.object({
  shipped_at: z.string().date().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  lines: z
    .array(
      z.object({
        order_line_id: z.string().uuid(),
        qty: z.coerce.number().positive('Số lượng xuất phải > 0'),
      }),
    )
    .min(1, 'Chọn ít nhất một dòng để ghi xuất')
    .max(200)
    .refine(
      (ls) => new Set(ls.map((l) => l.order_line_id)).size === ls.length,
      'Một dòng xuất hiện hai lần trong cùng đợt',
    ),
})
export type ShipmentsCreateInput = z.infer<typeof shipmentsCreateSchema>

export const orderDeliverSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
})
