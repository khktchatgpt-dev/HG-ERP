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
  /**
   * null + line_name = DÒNG TỰ DO (0134): đơn gỗ đặt theo MÃ SẢN PHẨM chứ
   * không theo vật tư kho. Chỉ mẫu wood được dùng (service chặn); dòng tự do
   * không đi vào sổ kho/needs.
   */
  material_id: z.string().uuid().nullable().optional(),
  line_name: z.string().trim().max(300).optional().nullable(),
  line_unit: z.string().trim().max(30).optional().nullable(),
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
  // 0139 — cột riêng thay hai ca mượn cột: gỗ m³/SP, mro bảo hành.
  m3_per_unit: optNum(1e4),
  warranty_text: optText(100),
  // Mẫu carton
  open_style: optText(20),
  pcs_per_ctn: optNum(1e6),
  inner_l_mm: optNum(1e6),
  inner_w_mm: optNum(1e6),
  inner_h_mm: optNum(1e6),
  area_m2: optNum(1e6),
  price_per_m2: optNum(1e12),
  /** Bao bì: phí "bản in + công" cộng vào đơn giá/thùng (0134). */
  print_fee: optNum(1e12),
  /** Cơ sở tính tiền dòng: thùng/SP · m² · m³ (xốp khối) · kg (gia công). */
  carton_basis: z.enum(['ctn', 'm2', 'm3', 'kg']).optional().nullable(),
  // Đóng gói mua chụp từ danh mục lúc lập đơn (0128) — chỉ để in quy đổi
  // "(= 28 bì)", KHÔNG tham gia tính tiền. SL đặt vẫn luôn theo ĐVT gốc.
  pack_size: optNum(1e9),
  pack_unit: optText(50),
  /*
   * 0182 — quy đổi giá tổng quát cho mẫu không có công thức riêng:
   * 1 ĐVT đặt = unit2_per_unit × đơn-vị-giá (nhãn unit2_label). Client chỉ gửi
   * CẶP NGUYÊN LIỆU; qty2/unit2/price_basis vẫn do server dẫn xuất (deriveLine).
   */
  unit2_per_unit: optNum(1e6),
  unit2_label: optText(20),
  /*
   * ĐƠN GIÁ TÍNH THEO ĐVT MUA ('unit') HAY THEO ĐƠN VỊ QUY ĐỔI ('unit2').
   *
   * Đây là LỰA CHỌN của người nhập, không phải số dẫn xuất — nhà cung cấp báo
   * giá theo cái gì thì hệ thống không đoán được. Đơn Visa Steel 04/09/2026 báo
   * 87.700 đ/CÂY trong khi mẫu "sắt/thép theo kg" ép tính theo kg, ra sai 4,47
   * lần. qty2/unit2 vẫn do server dẫn xuất như cũ.
   */
  price_per: z.enum(['unit', 'unit2']).nullish(),
  /*
   * TỔNG GÕ TAY (02/10/2026): thay tổng kg / m³ / m² dẫn xuất bằng số trên tờ
   * NCC. Service vẫn chạy `deriveLine` — hàm đó áp số này, chỉ cho mẫu có cột
   * tổng; mẫu khác bỏ qua. Không phải cột DB: kết quả nằm ở `qty2`.
   */
  qty2_override: optNum(1e9),
  /*
   * CHIA SL CỦA DÒNG cho nhiều lệnh (0185). Rỗng = 100% thuộc LSX chính của
   * đơn — mọi đơn một-lệnh không gửi gì thêm. Service kiểm tổng phần chia phải
   * bằng qty_ordered (xem lib/po-lsx-split), DB không ràng buộc vì người soạn
   * sửa SL đặt trước rồi mới sửa phần chia.
   */
  lsx_split: z
    .array(
      z.object({
        production_order_id: z.string().uuid(),
        qty: z.coerce.number().positive(),
      }),
    )
    .max(10)
    .optional()
    .nullable(),
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
  /** Đơn BỔ SUNG cho phần giao thiếu của đơn này (0213) — chỉ có nghĩa lúc tạo. */
  source_po_id: z.string().uuid().nullable().optional(),
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
  /**
   * KẾ HOẠCH CHIA ĐỢT khai ngay lúc soạn đơn (28/08) — tuỳ chọn. Dòng chưa có
   * id nên đợt trỏ theo `line_index` (thứ tự trên lưới); service ánh xạ sang
   * po_line_id sau khi ghi dòng (xem mapDraftShipments).
   */
  shipments: z
    .array(
      z.object({
        expected_date: z.string().date(),
        note: optText(500),
        lines: z
          .array(
            z.object({
              line_index: z.coerce.number().int().min(0).max(199),
              qty: z.coerce.number().positive(),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .max(20)
    .optional(),
  lines: z
    .array(poLineInputSchema)
    .min(1, 'Đơn đặt phải có ít nhất 1 dòng vật tư')
    .max(200)
    // KHÔNG chặn cùng vật tư nhiều dòng (30/09/2026). Trước đây chặn mọi cặp
    // cùng material_id → đơn nhôm cắt nhiều chiều dài (GIGA anh Truyền) và đơn
    // chia một tem cho nhiều SP không lưu được. Theo thông lệ ERP, dòng định
    // danh bằng số dòng; trùng THẬT (`lib/po-line-dup`) chỉ cảnh báo ở màn soạn
    // + bảng kiểm trước khi gửi duyệt.
    .refine(
      (lines) => lines.every((l) => l.material_id || l.line_name?.trim()),
      'Dòng không gắn vật tư phải có tên hàng',
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
  // 'received' CHỈ cho đơn toàn dòng tự do (gỗ/gia công — 0134): hàng nghiệm thu
  // ngoài sổ kho vật tư nên không có phiếu nhập nào tự chốt đơn; service chặn
  // khi đơn còn dòng vật tư kho.
  to: z.enum(['ordered', 'confirmed', 'in_transit', 'received']),
})

/**
 * MỞ LẠI ĐƠN ĐÃ DUYỆT ĐỂ SỬA (16/09/2026) — LÝ DO BẮT BUỘC, tối thiểu 5 ký tự.
 *
 * Dài hơn mức 1 ký tự của `poCancelSchema` là cố ý: lý do này đi thẳng vào
 * thông báo gửi Giám đốc ("đơn ông vừa duyệt bị mở lại vì …"). Một dấu chấm cho
 * qua cửa thì thông báo ấy không nói được gì, và người duyệt phải đi hỏi lại.
 */
export const poReopenSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Mở lại đơn đã duyệt phải nói rõ vì sao — Giám đốc đọc câu này')
    .max(1000),
})

export const poCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Huỷ đơn phải kèm lý do').max(1000),
})

/**
 * NCC XÁC NHẬN ĐƠN (0152) — NV cung ứng ghi lại cam kết sau cuộc gọi/Zalo.
 *
 * `shipments` RỖNG được phép: NCC chỉ ừ một tiếng chưa chốt lịch, hoặc đơn toàn
 * dòng tự do (gỗ/gia công — nghiệm thu ngoài sổ kho, không cần đợt theo dòng).
 * Có đợt thì service validate bằng `validateShipments` (lib/po-shipments).
 */
export const poShipmentInputSchema = z.object({
  expected_date: z.string().date('Đợt giao phải có ngày'),
  note: optText(500),
  lines: z
    .array(
      z.object({
        po_line_id: z.string().uuid(),
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1, 'Đợt giao phải có ít nhất 1 dòng hàng')
    .max(200),
})

export const poConfirmSchema = z.object({
  confirmed_note: optText(500),
  method: optText(100), // 'NCC giao' | 'Mình lấy' | tự do
  place: optText(200), // mặc định "Kho nguyên vật liệu"
  shipments: z.array(poShipmentInputSchema).max(20).default([]),
})

/**
 * SỬA ĐIỀU KHOẢN & GHI CHÚ sau khi đơn đã rời bàn duyệt (28/08/2026) — chỉ
 * chữ in lên phiếu, KHÔNG có dòng hàng/giá/NCC: mấy thứ đó đổi là phải quay
 * về nháp đi duyệt lại, còn sửa câu thanh toán gõ nhầm thì không thể bắt huỷ
 * đơn NCC đang giao.
 */
export const poTermsPatchSchema = z.object({
  contract_no: optText(100),
  terms_quality: optText(1000),
  terms_delivery_place: optText(500),
  terms_payment: optText(500),
  terms_invoice: optText(500),
  terms_lead_time: optText(500),
  signer_role: optText(100),
  note: optText(2000),
})

/**
 * Thao tác trên MỘT đợt giao: dời ngày / xe tới / huỷ, và (27/09/2026) SỬA đợt
 * (đổi SL từng dòng + ngày) / LẤY TRƯỚC (tách một phần thành đợt mới sớm hơn).
 * Mọi thao tác đổi cam kết đều bắt lý do.
 */
export const poShipmentActionSchema = z
  .object({
    action: z.enum(['reschedule', 'arrived', 'cancel', 'edit', 'split']),
    expected_date: z.string().date().optional(),
    reason: z.string().trim().max(1000).optional(),
    lines: z
      .array(z.object({ po_line_id: z.string().uuid(), qty: z.coerce.number().min(0) }))
      .max(500)
      .optional(),
  })
  .refine(
    (d) => !['reschedule', 'edit', 'split'].includes(d.action) || !!d.expected_date,
    {
      message: 'Phải chọn ngày giao',
    },
  )
  .refine((d) => d.action === 'arrived' || (d.reason && d.reason.length > 0), {
    message: 'Dời / huỷ / sửa / lấy trước đợt giao phải kèm lý do',
  })
  .refine((d) => !['edit', 'split'].includes(d.action) || (d.lines?.length ?? 0) > 0, {
    message: 'Chưa có dòng hàng nào',
  })

/** Bàn giao đơn cho NV cung ứng khác (0128) — trưởng phòng/GĐ/admin. */
export const poReassignSchema = z.object({
  user_id: z.string().uuid(),
})

/**
 * Chốt / mở lại PHẦN THIẾU (0154): `close` trên một dòng (line_id) hoặc mọi
 * dòng còn thiếu (bỏ trống) — bắt lý do; `reopen` từng dòng, không cần lý do
 * (mở lại là quay về hiện trạng thật).
 */
export const poCloseShortSchema = z
  .object({
    action: z.enum(['close', 'reopen']),
    line_id: z.string().uuid().optional().nullable(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.action !== 'close' || (d.reason && d.reason.length > 0), {
    message: 'Chốt phần thiếu phải kèm lý do',
    path: ['reason'],
  })
  .refine((d) => d.action !== 'reopen' || !!d.line_id, {
    message: 'Mở lại phải chỉ rõ dòng',
    path: ['line_id'],
  })

/**
 * Dời hẹn giao của đơn ĐÃ GỬI — chỉ ngày và lý do, không đụng tiền/dòng hàng.
 * Bắt buộc lý do: đây là thay đổi trên đơn đã có chữ ký duyệt, phải trả lời được
 * "vì sao" khi đối chiếu về sau.
 */
/**
 * Lý do dời hẹn KHÔNG bắt buộc (chốt 28/09/2026): máy tự ghi vết "cũ → mới · ai ·
 * lúc nào". Bắt lý do là thứ khiến 0/85 đơn có vết đổi hẹn dù 53/85 đơn đã gửi
 * trống hạn giao.
 */
export const poRescheduleSchema = z.object({
  expected_at: z.string().trim().min(1, 'Chọn ngày giao mới').max(30),
  reason: z.string().trim().max(1000).optional().default(''),
})

/**
 * ĐIỀU CHỈNH ĐƠN ĐÃ GỬI (0210, chốt 25/09/2026) — gửi CẢ bộ dòng của bản mới.
 * Dòng có `id` = sửa dòng đang chạy (giữ nguyên mã dòng để phiếu nhập, đợt
 * giao, hoá đơn NCC vẫn trỏ đúng); không `id` = dòng thêm; dòng cũ vắng mặt =
 * bỏ. Không chặn trùng vật tư ở đây như lúc soạn: đơn nạp từ file có sẵn hai
 * dòng cùng mã (chia hai lệnh) — `planAdjustment` chỉ chặn DÒNG MỚI trùng.
 *
 * `base_seq` = số lần điều chỉnh client đã thấy (0 nếu chưa lần nào) — hàm DB
 * so với sổ để chặn hai người áp dụng chen nhau.
 * `vat_rate` / `discount_amount` vắng mặt = giữ nguyên.
 */
export const poAdjustLineSchema = poLineInputSchema.extend({
  id: z.string().uuid().nullish(),
})
export const poAdjustSchema = z.object({
  base_seq: z.coerce.number().int().min(0),
  reason: z
    .string()
    .trim()
    .min(
      5,
      'Ghi rõ vì sao điều chỉnh (ít nhất 5 ký tự) — lý do vào sổ phát sinh và thông báo',
    )
    .max(1000),
  vat_rate: z.coerce.number().min(0).max(100).nullish(),
  discount_amount: z.coerce.number().min(0).nullish(),
  lines: z
    .array(poAdjustLineSchema)
    .max(200)
    .refine(
      (lines) => lines.every((l) => l.material_id || l.line_name?.trim()),
      'Dòng không gắn vật tư phải có tên hàng',
    ),
})

/** Ghi mốc "đã gửi NCC bản điều chỉnh lần N" (chốt Q4 25/09). */
export const poAdjustmentSentSchema = z.object({
  seq: z.coerce.number().int().min(1),
  note: optText(500),
})
