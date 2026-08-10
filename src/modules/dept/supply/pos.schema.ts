import { z } from 'zod'
import { PO_TEMPLATES } from '@/lib/po-template'

export const PO_STATUSES = [
  // NHÁP (0116): tạo đơn = lưu nháp, sửa/xoá tự do; bấm "Gửi GĐ duyệt" mới sang
  // pending_approval và notify người duyệt.
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
  'cancelled',
] as const
export type PoStatus = (typeof PO_STATUSES)[number]

const optText = (max: number) => z.string().trim().max(max).optional().nullable()
const optNum = (max: number) => z.coerce.number().min(0).max(max).optional().nullable()

/**
 * Dòng PO. Bộ ô nhập là HỢP của 5 mẫu đơn (`@/lib/po-template`) — mẫu nào dùng ô
 * nấy, ô của mẫu khác để trống. Không tách 5 schema riêng vì cả 5 ghi vào cùng
 * một bảng và phần lớn cột dùng chung.
 *
 * ⭐ qty2/unit2/price_basis KHÔNG nhận từ client nữa: service tự dẫn xuất bằng
 * `deriveLine(template, line)`. Client gửi thẳng thông số quy đổi (kg/m, dài cây,
 * kg/đơn-vị, m²) — server tính lại nên không có đường nào để một dòng lọt vào DB
 * với tổng kg không khớp thông số của chính nó.
 */
export const poLineInputSchema = z.object({
  material_id: z.string().uuid(),
  /** SL đặt cuối cùng, luôn theo ĐVT mua (cây / con / tấm / thùng) — trục tồn kho. */
  qty_ordered: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0).optional().nullable(),
  spec: optText(100), // quy cách: 25x50x1li…
  note: optText(500), // truy vết: "50 bàn santorin (4c/sp)" / vị trí chi tiết
  // Dùng chung nhiều mẫu
  material_grade: optText(100), // vật liệu: "Nhựa đen", "Sắt xi trắng", "inox 201"
  // Không còn `product_code`: ô "Mã SP" đã bỏ khỏi form soạn đơn và phiếu in
  // (yêu cầu phòng Cung ứng). Cột DB giữ nguyên cho dữ liệu cũ — lúc bỏ thì
  // 11/11 dòng đang để trống nên không mất gì.
  dm_per_sp: optNum(1e6), // định mức / sản phẩm
  qty_demand: optNum(1e9), // SL đơn hàng (nhu cầu gộp)
  qty_on_hand: optNum(1e9), // tồn kho lúc lập đơn
  // Không còn `waste_pct`: hao hụt đã bỏ khỏi cả ô nhập lẫn SL gợi ý (yêu cầu
  // phòng Cung ứng — 3% áp cứng cho mọi mặt hàng là số vô nghĩa). Cột DB giữ
  // nguyên cho đơn cũ.
  // Mẫu aluminium
  die_code: optText(100),
  weight_per_m: optNum(1e4),
  bar_length_m: optNum(1e4),
  // Không còn `bar_surplus` ("cây dư"): bỏ khỏi form nhập và phiếu in theo yêu
  // cầu phòng Cung ứng. Cột DB giữ nguyên cho đơn cũ.
  // Mẫu metal_kg
  dimension_text: optText(200),
  finish: optText(100),
  weight_per_unit: optNum(1e6),
  // Mẫu carton
  open_style: optText(20),
  pcs_per_ctn: optNum(1e6),
  inner_l_mm: optNum(1e6),
  inner_w_mm: optNum(1e6),
  inner_h_mm: optNum(1e6),
  area_m2: optNum(1e6),
  price_per_m2: optNum(1e12),
  carton_basis: z.enum(['ctn', 'm2']).optional().nullable(),
  // Đóng gói mua chụp từ danh mục lúc lập đơn (0128) — chỉ để in quy đổi
  // "(= 28 bì)", KHÔNG tham gia tính tiền. SL đặt vẫn luôn theo ĐVT gốc.
  pack_size: optNum(1e9),
  pack_unit: optText(50),
})

export const poCreateSchema = z.object({
  // Gắn LSX = PO theo lệnh sản xuất; null/bỏ trống = PO ngoài LSX (tiêu hao/dùng
  // chung — 0076 nới BR-06 phần LSX, phần 1-NCC giữ nguyên).
  production_order_id: z.string().uuid().nullable().optional(),
  /**
   * LSX PHỤ gộp thêm vào đơn (0125) — đơn thật ghi "LSX 01+2+3/26-27". Chỉ có
   * nghĩa khi có LSX chính; service chặn khi đơn ngoài LSX mà lại gửi LSX phụ.
   */
  extra_lsx_ids: z.array(z.string().uuid()).max(10).optional(),
  supplier_id: z.string().uuid(), // BR-06: đúng 1 NCC
  /** Mẫu đơn theo loại hàng — quyết định cột nhập, công thức tiền và mẫu phiếu in. */
  template: z.enum(PO_TEMPLATES).default('simple'),
  currency: z.string().trim().toUpperCase().length(3).default('VND'),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  price_includes_vat: z.coerce.boolean().default(true),
  discount_amount: z.coerce.number().min(0).optional().nullable(),
  contract_no: optText(100), // "Theo HD số:"
  expected_at: z.string().date().optional().nullable(), // thời gian giao hàng
  terms: optText(1000), // bảo hành, điều kiện (cột cũ, giữ cho đơn đã tạo)
  // 5 điều khoản in thành 5 dòng riêng trên phiếu
  terms_quality: optText(1000),
  terms_delivery_place: optText(500),
  terms_payment: optText(500),
  terms_invoice: optText(500),
  terms_lead_time: optText(500),
  signer_role: optText(100), // "TRƯỞNG PHÒNG CUNG ỨNG" / "TRƯỞNG PHÒNG KẾ HOẠCH"
  note: optText(2000),
  lines: z
    .array(poLineInputSchema)
    .min(1, 'Đơn đặt phải có ít nhất 1 dòng vật tư')
    .max(200)
    .refine(
      (lines) => new Set(lines.map((l) => l.material_id)).size === lines.length,
      'Vật tư bị trùng dòng',
    ),
})

/**
 * Chỉ PO NHÁP được sửa (service chặn — 0128: đơn chờ duyệt phải rút về nháp).
 *
 * `template` BỎ default: khi tạo, không khai thì là 'simple'; khi sửa, không khai
 * phải là "giữ nguyên mẫu cũ" (service đọc `input.template ?? before.template`).
 * Để nguyên `.default('simple')` thì mọi client cũ không gửi `template` sẽ ngầm
 * hạ mẫu của đơn về 'simple' — đơn nhôm mất kg/m và thành tiền tụt từ
 * (tổng kg × giá/kg) xuống (số cây × giá/kg).
 */
export const poUpdateSchema = poCreateSchema.extend({
  template: z.enum(PO_TEMPLATES).optional(),
})

export const poListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(PO_STATUSES).optional(),
  supplier_id: z.string().uuid().optional(),
  production_order_id: z.string().uuid().optional(),
  /** Lọc loại đơn: 'lsx' = theo lệnh SX, 'standalone' = ngoài LSX (0076). */
  scope: z.enum(['lsx', 'standalone']).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})

/** GĐ duyệt / từ chối (BR-05, FR-ADM-03). Từ chối → VỀ NHÁP + lý do (0128). */
export const poDecideSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision !== 'reject' || (d.reason && d.reason.length > 0), {
    message: 'Từ chối phải kèm lý do',
  })

/** Tiến trạng thái sau duyệt: gửi NCC (BR-05) → NCC xác nhận → đang giao. */
export const poAdvanceSchema = z.object({
  to: z.enum(['ordered', 'confirmed', 'in_transit']),
})

export const poCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Huỷ đơn phải kèm lý do').max(1000),
})

/** Bàn giao đơn cho NV cung ứng khác (0128) — trưởng phòng/GĐ/admin. */
export const poReassignSchema = z.object({
  user_id: z.string().uuid(),
})

/**
 * Dời hẹn giao của đơn ĐÃ GỬI — chỉ ngày và lý do, không đụng tiền/dòng hàng.
 * Bắt buộc lý do: đây là thay đổi trên đơn đã có chữ ký duyệt, phải trả lời được
 * "vì sao" khi đối chiếu về sau.
 */
export const poRescheduleSchema = z.object({
  expected_at: z.string().trim().min(1, 'Chọn ngày giao mới').max(30),
  reason: z.string().trim().min(1, 'Dời hẹn giao phải kèm lý do').max(1000),
})
