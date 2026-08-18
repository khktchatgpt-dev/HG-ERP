import { z } from 'zod'
import { MATERIAL_KIND_OPTIONS, SHAPE_OPTIONS } from '@/lib/bom-calc'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { productCreateSchema } from './technical.schema'

/**
 * ĐỌC FILE BOM BẰNG MÔ HÌNH — khai báo hợp đồng dữ liệu, dùng chung cho cả hai
 * nhà cung cấp.
 *
 * Ba lớp, cố ý tách:
 *
 *   1. `buildExtractJsonSchema()` — JSON Schema "gầy" GỬI CHO MÔ HÌNH. Cố tình
 *      KHÔNG sinh từ `productPartsBulkSchema` bằng `z.toJSONSchema`: cả structured
 *      outputs của Anthropic lẫn `responseJsonSchema` của Gemini đều KHÔNG nhận
 *      `minimum` / `maxLength` / `exclusiveMinimum`, mà schema zod kia đầy
 *      `.min(0)`, `.max(300)`, `.positive()`. Đưa thẳng vào là 400.
 *
 *   2. `bomDraftSchema` — zod kiểm ĐẦU RA của mô hình ở server. Structured
 *      outputs ràng buộc được hình dạng chứ không ràng buộc được miền giá trị,
 *      nên số âm / confidence 7.5 / tên rỗng vẫn lọt. Lớp này chặn.
 *
 *   3. `productPartsBulkSchema` (file technical.schema.ts) — cửa ghi thật, giữ
 *      nguyên. Bản nháp phải đi qua tay người rồi mới tới đó.
 *
 * Mô hình CHỈ TRÍCH, KHÔNG TÍNH. Mọi đại lượng dẫn xuất (khối lượng, tổng dài,
 * diện tích sơn, m³) do `bom-calc.ts` tính lại từ hình học — không nhận số học
 * của mô hình cho những thứ đi thẳng vào giá thành.
 */

const SHAPE_CODES = SHAPE_OPTIONS.map((s) => s.code)
const MATERIAL_CODES = MATERIAL_KIND_OPTIONS.map((m) => m.code)
const FRAME_CODES = FRAME_MATERIALS.map((m) => m.code)
const TYPE_CODES = PRODUCT_TYPES.map((t) => t.code)

/* ─────────────────────────── 1. Schema gửi mô hình ────────────────────────── */

type FieldSpec = {
  name: string
  type: 'string' | 'number' | 'integer'
  /** Bắt buộc có giá trị (không cho null). Chỉ tên chi tiết và số lượng. */
  required?: true
  enum?: string[]
  desc: string
}

/**
 * Các trường trích được từ MỘT DÒNG định mức. Đây là nguồn duy nhất — cả JSON
 * Schema gửi đi lẫn phần mô tả cột trong prompt đều dựng từ đây, nên không thể
 * lệch nhau.
 *
 * Cột TÍNH SẴN trong file (Tổng chiều dài, Diện tích, Đơn giá, Thành tiền) cố
 * tình vắng mặt: app tính lại, đọc vào chỉ tổ mâu thuẫn số liệu.
 */
export const BOM_LINE_FIELDS: FieldSpec[] = [
  { name: 'part_no', type: 'integer', desc: 'Cột Stt / TT. Không có thì null.' },
  {
    name: 'part_name',
    type: 'string',
    required: true,
    desc: 'Tên chi tiết / tên hàng / tên vật tư. Chép nguyên văn, giữ dấu tiếng Việt.',
  },
  {
    name: 'cluster_name',
    type: 'string',
    desc: 'Cột "Parts / Bộ phận" — tên CỤM (vd "Cụm khung", "Cụm mê"). Biểu mẫu cũ không có cột này thì null.',
  },
  {
    name: 'profile_shape',
    type: 'string',
    enum: SHAPE_CODES,
    desc: 'HÌNH DẠNG tiết diện, CHỈ khi cột "Loại" ghi đúng tên hình: Hộp→HOP, Tròn→TRON, Tròn đặc→TRONDAC, Vuông→VUONG, La→LA, Ovan→OVAN, Tấm/Tole→TAM, Lưới→LUOI. Cột "Loại" ghi MÃ KHUÔN (TD-B768, td-hg04, HG04, DT-BD-02…) thì để null và bỏ mã đó vào profile_code — KHÔNG đoán hình dạng từ mã.',
  },
  {
    name: 'profile_code',
    type: 'string',
    desc: 'MÃ KHUÔN / mã profile chép NGUYÊN VĂN từ cột "Loại" khi ô đó là mã chứ không phải tên hình dạng (vd "TD-B768", "td-hg04", "DT-BD-02"). Giữ đúng hoa/thường như file ghi. Ô ghi tên hình dạng thì để null.',
  },
  {
    name: 'material_kind',
    type: 'string',
    enum: MATERIAL_CODES,
    desc: 'Hệ vật liệu suy từ TIÊU ĐỀ KHỐI hoặc cột vật liệu: nhôm→AL, sắt/thép→IR, inox→IN, gỗ→WD, mây/nhựa đan→RA, kính→GL. Không chắc thì null.',
  },
  {
    name: 'dim_a_mm',
    type: 'number',
    desc: 'Cột "Dày" (kích thước A của tiết diện), mm.',
  },
  {
    name: 'dim_b_mm',
    type: 'number',
    desc: 'Cột "Rộng" (kích thước B của tiết diện), mm.',
  },
  {
    name: 'wall_thickness_mm',
    type: 'number',
    desc: 'Cột "Dày vật liệu" / "δ" / "D" — bề dày thành ống, mm. KHÁC với cột "Dày" ở trên.',
  },
  {
    name: 'cut_length_mm',
    type: 'number',
    desc: 'Cột "Dài" — chiều dài cắt của một chi tiết, mm.',
  },
  { name: 'bend_waste_mm', type: 'number', desc: 'Cột "Phí hao" / "Hao chi tiết", mm.' },
  { name: 'tenon_mm', type: 'number', desc: 'Cột "Mộng", mm.' },
  {
    name: 'qty',
    type: 'number',
    desc: 'Cột "Số lượng" / "SL" trên một sản phẩm. Ô TRỐNG thì để null — TUYỆT ĐỐI không điền 1 hay đếm hộ. Rất nhiều file BOM bỏ trống cột này; người dùng sẽ tự điền.',
  },
  { name: 'unit', type: 'string', desc: 'Cột "ĐVT" (cây, m, kg, bộ, cái…).' },
  {
    name: 'material_note',
    type: 'string',
    desc: 'Cột "Vật liệu" / "Chất liệu" ghi bằng chữ (vd "Nhựa", "7 màu"). Chép nguyên văn.',
  },
  {
    name: 'weight_kg',
    type: 'number',
    desc: 'CHỈ điền khi file ghi sẵn khối lượng theo bảng cân NCC. TUYỆT ĐỐI không tự tính.',
  },
  { name: 'note', type: 'string', desc: 'Cột "Ghi chú".' },
  {
    name: 'confidence',
    type: 'number',
    required: true,
    desc: 'Độ chắc chắn của riêng dòng này, 0..1. Dùng 1 khi mọi cột khớp tiêu đề rõ ràng; hạ xuống khi phải đoán cột, ô bị gộp, chữ mờ hoặc số khó đọc.',
  },
  {
    name: 'source_ref',
    type: 'string',
    desc: 'Địa chỉ ô chứa TÊN CHI TIẾT trong file gốc, dạng <tên sheet>!<cột><dòng> (vd BOM_MER01!C14). Nguồn là PDF/ảnh thì ghi số trang (vd "trang 2").',
  },
]

/**
 * KHỐI ĐẦU FILE — thuộc tính sản phẩm.
 *
 * Biểu mẫu BOM mở đầu bằng một khối thông tin chung (TÊN SP, Mã Số HG, MÃ
 * K.HÀNG, KTSP, Nhiên Liệu, Khối lượng, KTBB, Cái/40HC, NW, GW) — đủ để dựng
 * hồ sơ sản phẩm mà không phải gõ lại. Chỉ dùng khi TẠO SP MỚI từ file; đọc
 * định mức cho hồ sơ có sẵn thì bỏ qua khối này.
 */
export const BOM_PRODUCT_FIELDS: FieldSpec[] = [
  {
    name: 'name',
    type: 'string',
    desc: 'Ô "TÊN SP". Chép nguyên văn, giữ dấu tiếng Việt.',
  },
  {
    name: 'code',
    type: 'string',
    desc: 'Ô "Mã Số HG" (dạng CH0201HG-IN). Ô trống là bình thường — để null, đừng bịa.',
  },
  {
    name: 'customer_item_code',
    type: 'string',
    desc: 'Ô "MÃ K.HÀNG" — mã bên khách đặt (vd 26620-309).',
  },
  {
    name: 'customer_name',
    type: 'string',
    desc: 'Tên/nhãn KHÁCH HÀNG. Thường nằm trong TÊN FILE ngay sau "BOM_" (vd "BOM_MERXX_Ghế…" → MERXX), đôi khi có ô riêng trong file. Không thấy thì null.',
  },
  {
    name: 'unit',
    type: 'string',
    desc: 'Đơn vị tính của sản phẩm: "cai", "bo", "cap"… Không ghi thì null (mặc định là cái).',
  },
  {
    name: 'product_type',
    type: 'string',
    enum: TYPE_CODES,
    desc: `Loại SP suy từ TÊN: ${PRODUCT_TYPES.map((t) => `${t.label}→${t.code}`).join(', ')}.`,
  },
  {
    name: 'frame_material',
    type: 'string',
    enum: FRAME_CODES,
    desc: `Vật liệu KHUNG, thường ở ô "Nhiên Liệu": ${FRAME_MATERIALS.map((m) => `${m.label}→${m.code}`).join(', ')}.`,
  },
  // KHÔNG đọc ô "Khối lượng": trong biểu mẫu nó là tổng CÂN TỪ BẢNG ĐỊNH MỨC —
  // app tự tính lại từ chính các dòng định mức (`calcPartDerived`), đọc số của
  // file vào là có hai nguồn cho cùng một con số (user chốt 18/08/2026).
  {
    name: 'length_mm',
    type: 'number',
    desc: 'KTSP — chiều SÂU/DÀI (D trong WxDxH), mm. Ô ghi "590x720/1060x1100/840" thì lấy số TRƯỚC dấu "/": W=590, D=720, H=1100 (số sau "/" là trạng thái mở, bỏ qua).',
  },
  { name: 'width_mm', type: 'number', desc: 'KTSP — chiều RỘNG (W), mm.' },
  { name: 'height_mm', type: 'number', desc: 'KTSP — chiều CAO (H), mm.' },
  {
    name: 'carton_l_mm',
    type: 'number',
    desc: 'KTBB — chiều dài thùng carton, MM như file ghi (vd 990). App tự đổi sang cm.',
  },
  { name: 'carton_w_mm', type: 'number', desc: 'KTBB — chiều rộng thùng, mm.' },
  { name: 'carton_h_mm', type: 'number', desc: 'KTBB — chiều cao thùng, mm.' },
  {
    name: 'qty_per_carton',
    type: 'integer',
    desc: 'Ô "Option" dạng "1cái / thùng" → 1. Số sản phẩm trong một thùng.',
  },
  {
    name: 'loading_40hc',
    type: 'integer',
    desc: 'Ô "Cái / 40HC" — xếp được bao nhiêu cái một cont 40HC.',
  },
  { name: 'nw_kg', type: 'number', desc: 'Ô "NW" — khối lượng tịnh mỗi thùng (kg).' },
  { name: 'gw_kg', type: 'number', desc: 'Ô "GW" — khối lượng cả bì mỗi thùng (kg).' },
  // KHÔNG đọc khối kiểm soát ISO (Tạo Bảng kê / Xác nhận / Lần ban hành / Hiệu
  // lực): user chốt 18/08/2026 — hồ sơ tạo từ app ghi nhận NGƯỜI TẠO theo phiên
  // đăng nhập + ngày tạo của hệ thống, không chép chữ ký giấy từ file.

  // Thông số HỖ TRỢ IN TRÊN LSX (`tech_spec`) — BOM thường nói qua các tiêu đề
  // khối / cột vật liệu; không thấy thì để null, LSX in ô trống.
  {
    name: 'spec_paint',
    type: 'string',
    desc: 'SƠN — màu / mã màu sơn nếu file ghi (tiêu đề khối "Nhôm + Sơn …", ghi chú "sơn bạc"…). Không thấy thì null.',
  },
  {
    name: 'spec_wood',
    type: 'string',
    desc: 'GỖ — loại gỗ + FSC + màu nếu có khối gỗ (vd tiêu đề "Quy cách Gỗ: Keo FSC 100%" → "Keo FSC 100%"). Không có khối gỗ thì null.',
  },
  {
    name: 'spec_glass',
    type: 'string',
    desc: 'KÍNH — loại + độ dày + màu nếu có khối kính (vd "Kính cường lực xám 8mm"). Không có thì null.',
  },
  {
    name: 'spec_cushion',
    type: 'string',
    desc: 'NỆM — mật độ mút / vải bọc nếu có khối nệm (vd tiêu đề "Quy cách nệm: D23 bọc vải"). Không có thì null.',
  },
  {
    name: 'confidence',
    type: 'number',
    required: true,
    desc: 'Độ chắc chắn của cả khối thuộc tính này, 0..1.',
  },
]

/** `{type:'x'}` hoặc `anyOf[x, null]` — cả hai nhà cung cấp đều nhận `anyOf`. */
function fieldSchema(f: FieldSpec): Record<string, unknown> {
  const base: Record<string, unknown> = { type: f.type }
  if (f.enum) base.enum = f.enum
  return f.required
    ? { ...base, description: f.desc }
    : { anyOf: [base, { type: 'null' }], description: f.desc }
}

/**
 * JSON Schema cho `output_config.format` (Anthropic) và `responseJsonSchema`
 * (Gemini). Danh sách nhóm truyền vào lúc chạy vì `technical_part_groups` là DỮ
 * LIỆU trong DB (0093) — thêm nhóm không phải sửa code.
 *
 * MỌI trường đều nằm trong `required` và nullable bằng `anyOf`: structured
 * outputs muốn khoá chặt hình dạng, "vắng mặt" và "không có giá trị" phải là
 * hai chuyện khác nhau.
 */
export function buildExtractJsonSchema(
  groupCodes: string[],
  /** `true` khi đang TẠO SP MỚI — thêm khối thuộc tính ở đầu file vào kết quả. */
  withProduct = false,
): Record<string, unknown> {
  const lineProps: Record<string, unknown> = {}
  for (const f of BOM_LINE_FIELDS) lineProps[f.name] = fieldSchema(f)

  const productProps: Record<string, unknown> = {}
  for (const f of BOM_PRODUCT_FIELDS) productProps[f.name] = fieldSchema(f)

  return {
    type: 'object',
    additionalProperties: false,
    required: withProduct ? ['product', 'sections'] : ['sections'],
    properties: {
      ...(withProduct
        ? {
            product: {
              type: 'object',
              additionalProperties: false,
              required: BOM_PRODUCT_FIELDS.map((f) => f.name),
              description:
                'Thuộc tính sản phẩm đọc từ khối thông tin chung ở ĐẦU file (trên các bảng định mức).',
              properties: productProps,
            },
          }
        : {}),
      sections: {
        type: 'array',
        description:
          'Mỗi KHỐI định mức trong file là một phần tử — một tiêu đề khối kèm các dòng dưới nó. Một file thường có nhiều khối thuộc nhiều nhóm khác nhau.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['group_code', 'section_title', 'unit_basis', 'lines'],
          properties: {
            group_code: {
              type: 'string',
              enum: groupCodes,
              description: 'Nhóm hạng mục của khối. Bắt buộc chọn trong danh sách.',
            },
            section_title: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description:
                'Tiêu đề khối chép NGUYÊN VĂN từ file (vd "Quy cách : Nhôm", "Quy cách nệm: D23 bọc vải"). Tiêu đề mang thông số nên không được rút gọn.',
            },
            unit_basis: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description:
                'Định mức của khối tính trên đơn vị nào nếu file ghi rõ (vd "1 ghế"). Không ghi gì thì null = tính trên 1 sản phẩm.',
            },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: BOM_LINE_FIELDS.map((f) => f.name),
                properties: lineProps,
              },
            },
          },
        },
      },
    },
  }
}

/* ──────────────────────── 2. Kiểm đầu ra của mô hình ──────────────────────── */

/**
 * Nhận THÔ rồi tự chuẩn hoá thay vì `z.number()` / `z.string()`.
 *
 * Hai lý do: (1) zod v4 loại NaN/Infinity ngay ở `z.number()`, tức là một ô rác
 * sẽ đánh hỏng CẢ DÒNG thay vì chỉ trống một ô; (2) mô hình thỉnh thoảng trả số
 * dưới dạng chuỗi ("1.4"). Ở đây thà cứu được dòng còn giữ nguyên các ô đọc
 * đúng, hơn là vứt cả dòng vì một ô.
 */
const asNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Số đo không bao giờ âm — số âm là đọc nhầm, bỏ về null. */
const posNum = z.unknown().transform((v) => {
  const n = asNumber(v)
  return n == null || n < 0 ? null : n
})

const text = (max: number) =>
  z.unknown().transform((v) => {
    if (v == null || typeof v === 'object') return null
    const s = String(v).trim()
    return s ? s.slice(0, max) : null
  })

const code = (allowed: string[]) =>
  z
    .unknown()
    .transform((v) =>
      typeof v === 'string' && allowed.includes(v.trim()) ? v.trim() : null,
    )

export const bomDraftLineSchema = z.object({
  part_no: z.unknown().transform((v) => {
    const n = asNumber(v)
    return n != null && Number.isInteger(n) ? n : null
  }),
  part_name: z.string().trim().min(1).max(300),
  cluster_name: text(120),
  profile_shape: code(SHAPE_CODES),
  profile_code: text(30),
  material_kind: code(MATERIAL_CODES),
  dim_a_mm: posNum,
  dim_b_mm: posNum,
  wall_thickness_mm: posNum,
  cut_length_mm: posNum,
  bend_waste_mm: posNum,
  tenon_mm: posNum,
  /**
   * CHO PHÉP NULL — nhiều file BOM bỏ trống hẳn cột Số lượng (đo trên file
   * "Ghế XC Tilos": trống cả 11 dòng). Trước đây trường này bắt buộc nên mô
   * hình buộc phải bịa; giờ để trống và người dùng điền ở màn duyệt.
   *
   * Số ≤ 0 cũng về null: "0 cái" không phải một định mức.
   */
  qty: z.unknown().transform((v) => {
    const n = asNumber(v)
    return n != null && n > 0 ? n : null
  }),
  unit: text(30),
  material_note: text(200),
  weight_kg: posNum,
  note: text(500),
  /**
   * Ngoài miền 0..1 thì kẹp về biên; đọc không ra số thì coi như 0 — mặc định
   * về phía "cần người soi", không về phía "yên tâm".
   */
  confidence: z.unknown().transform((v) => {
    const n = asNumber(v)
    return n == null ? 0 : Math.min(1, Math.max(0, n))
  }),
  source_ref: text(60),
})

export const bomDraftSectionSchema = z.object({
  group_code: z.string().trim().min(1).max(40),
  section_title: text(300),
  unit_basis: text(40),
  lines: z.array(bomDraftLineSchema),
})

/**
 * Thuộc tính SP đọc từ đầu file. MỌI trường đều có thể null — biểu mẫu bỏ trống
 * rất nhiều ô (đặc biệt "Mã Số HG"), và bịa ra một mã sai còn tệ hơn để trống
 * cho người dùng điền.
 */
export const bomDraftProductSchema = z.object({
  name: text(200),
  code: text(100),
  customer_item_code: text(100),
  customer_name: text(200),
  unit: text(30),
  product_type: code(TYPE_CODES),
  frame_material: code(FRAME_CODES),
  spec_paint: text(200),
  spec_wood: text(200),
  spec_glass: text(200),
  spec_cushion: text(200),
  length_mm: posNum,
  width_mm: posNum,
  height_mm: posNum,
  carton_l_mm: posNum,
  carton_w_mm: posNum,
  carton_h_mm: posNum,
  qty_per_carton: posNum,
  loading_40hc: posNum,
  nw_kg: posNum,
  gw_kg: posNum,
  confidence: z.unknown().transform((v) => {
    const n = asNumber(v)
    return n == null ? 0 : Math.min(1, Math.max(0, n))
  }),
})

export type BomDraftProduct = z.infer<typeof bomDraftProductSchema>

export const bomDraftSchema = z.object({
  sections: z.array(bomDraftSectionSchema),
})

/** Bản nháp khi TẠO SP MỚI — có thêm khối thuộc tính. */
export const bomDraftWithProductSchema = bomDraftSchema.extend({
  product: bomDraftProductSchema,
})

export type BomDraftLine = z.infer<typeof bomDraftLineSchema>
export type BomDraftSection = z.infer<typeof bomDraftSectionSchema>

/* ─────────────────────────── 3. Đầu vào của route ─────────────────────────── */

/** 8 MB nhị phân ≈ 11 MB base64. File BOM thật lớn nhất trong kho là 1,8 MB. */
export const BOM_AI_MAX_BYTES = 8 * 1024 * 1024

export const BOM_AI_MIMES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const

/**
 * Nguồn file: đã đính trong hồ sơ, hoặc vừa chọn trên máy.
 *
 * Ưu tiên `file_id` — file đã qua kiểm an toàn upload (0151), đã có vết ai tải
 * lên lúc nào, và không phải đẩy vài MB qua mạng lần nữa. Nhánh `upload` để
 * đọc nhanh file chưa muốn lưu vào hồ sơ.
 */
export const bomAiExtractSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('file'), file_id: z.string().uuid() }),
    z.object({
      kind: z.literal('upload'),
      filename: z.string().trim().min(1).max(255),
      mime: z.enum([
        BOM_AI_MIMES.xlsx,
        BOM_AI_MIMES.pdf,
        BOM_AI_MIMES.png,
        BOM_AI_MIMES.jpeg,
        BOM_AI_MIMES.webp,
      ]),
      data_base64: z
        .string()
        .min(1)
        .max(Math.ceil((BOM_AI_MAX_BYTES * 4) / 3) + 1024),
    }),
  ]),
})

export type BomAiExtractInput = z.infer<typeof bomAiExtractSchema>

/**
 * GHI bản nháp đã được người dùng duyệt.
 *
 * Một lượt gọi cho CẢ bản nháp chứ không phải mỗi khối một lượt: chế độ
 * `replace` phải xoá xong toàn bộ các nhóm liên quan RỒI mới ghi. Chia nhỏ ra
 * thì khối thứ hai cùng nhóm sẽ xoá mất khối thứ nhất vừa ghi, và nửa chừng
 * lỗi mạng là hồ sơ nằm ở trạng thái dở dang.
 */
export const bomAiApplySchema = z.object({
  /** `append` thêm chồng lên; `replace` xoá các nhóm có trong bản nháp rồi ghi. */
  mode: z.enum(['append', 'replace']),
  sections: z
    .array(
      z.object({
        group_code: z.string().trim().min(1).max(40),
        section_title: z.string().trim().max(300).optional().nullable(),
        unit_basis: z.string().trim().max(40).optional().nullable(),
        lines: z.array(z.record(z.string(), z.unknown())).min(1).max(300),
      }),
    )
    .min(1)
    .max(30),
})

export type BomAiApplyInput = z.infer<typeof bomAiApplySchema>

/** Đọc file để TẠO SP MỚI — chỉ nhận file tải lên (chưa có SP để đính file). */
export const bomAiNewExtractSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.enum([
    BOM_AI_MIMES.xlsx,
    BOM_AI_MIMES.pdf,
    BOM_AI_MIMES.png,
    BOM_AI_MIMES.jpeg,
    BOM_AI_MIMES.webp,
  ]),
  data_base64: z
    .string()
    .min(1)
    .max(Math.ceil((BOM_AI_MAX_BYTES * 4) / 3) + 1024),
})

export type BomAiNewExtractInput = z.infer<typeof bomAiNewExtractSchema>

/**
 * Tạo SP mới + ghi định mức trong một lượt.
 *
 * `product` đi thẳng vào `productCreateSchema` — KHÔNG định nghĩa lại các ràng
 * buộc của hồ sơ SP ở đây, để một chỗ duy nhất quyết định thế nào là hồ sơ hợp
 * lệ, dù tạo bằng form hay bằng file BOM.
 */
export const bomAiCreateSchema = z.object({
  product: productCreateSchema,
  sections: bomAiApplySchema.shape.sections.min(0),
  /**
   * File BOM gốc gửi LẠI để đính vào hồ sơ + bóc ảnh SP nhúng trong đó.
   *
   * Gửi lại chứ không giữ ở server giữa hai nhịp: giữ thì phải đẻ ra file mồ côi
   * trên Storage cho mọi lần người dùng đọc xong rồi bỏ ngang. Client vốn đã cầm
   * sẵn file trong bộ nhớ, gửi thêm một lần lúc bấm Tạo là rẻ nhất.
   */
  source_file: z
    .object({
      filename: z.string().trim().min(1).max(255),
      mime: z.enum([
        BOM_AI_MIMES.xlsx,
        BOM_AI_MIMES.pdf,
        BOM_AI_MIMES.png,
        BOM_AI_MIMES.jpeg,
        BOM_AI_MIMES.webp,
      ]),
      data_base64: z
        .string()
        .min(1)
        .max(Math.ceil((BOM_AI_MAX_BYTES * 4) / 3) + 1024),
      /** Đính chính file BOM vào tab Tài liệu của hồ sơ. */
      save_file: z.boolean(),
      /** Bóc ảnh nhúng trong file làm ảnh đại diện SP. */
      save_image: z.boolean(),
    })
    .optional(),
})

export type BomAiCreateInput = z.infer<typeof bomAiCreateSchema>
