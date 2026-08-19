import { BOM_LINE_FIELDS, BOM_PRODUCT_FIELDS } from './bom-ai.schema'
import { BadRequest } from '@/server/http'

/**
 * SEAM giữa nghiệp vụ đọc BOM và nhà cung cấp mô hình.
 *
 * Service chỉ biết `BomExtractor`; Anthropic và Gemini là hai bản cài đặt thay
 * nhau bằng biến môi trường. Giữ được seam này vì phần đắt giá — prompt, JSON
 * Schema, kiểm đầu ra, chấm điểm — nằm hết ở tầng chung; adapter chỉ còn đúng
 * việc gọi HTTP. Nhờ vậy chấm điểm hai bên trên cùng bộ file thật là chuyện đổi
 * một biến env, không phải viết lại.
 *
 * Chọn xong một bên thì gỡ adapter kia và dependency của nó.
 */

export type BomExtractInput = {
  /**
   * Lưới ô dạng text dựng từ .xlsx. Có `grid` thì KHÔNG gửi `document` — đọc
   * text vừa rẻ hơn nhiều lần vừa chính xác hơn vision, và chỉ đường này mới
   * lấy được địa chỉ ô cho `source_ref`.
   */
  grid?: string
  /** PDF / ảnh — dùng khi không dựng được lưới. */
  document?: { mimeType: string; dataBase64: string }
  /** Nhóm hạng mục hợp lệ, đọc từ `technical_part_groups` lúc chạy. */
  groups: { code: string; label: string }[]
  /** Mã + tên sản phẩm đang mở, để mô hình biết bối cảnh. */
  productHint?: string
  /**
   * Tên file gốc. Cần khi tạo SP mới: nhãn khách hàng thường CHỈ nằm ở tên file
   * ("BOM_MERXX_Ghế 5 bậc…" → MERXX), không có ô nào trong bảng ghi nó.
   */
  filename?: string
  /**
   * `true` khi TẠO SP MỚI từ file — đọc thêm khối thuộc tính ở đầu file. Đọc
   * định mức cho hồ sơ có sẵn thì để `false`: thuộc tính đã có người khai, ghi
   * đè bằng số máy đọc là làm hỏng dữ liệu đang đúng.
   */
  withProduct?: boolean
}

export type BomExtractOutput = {
  /** JSON thô của mô hình — tầng trên kiểm bằng `bomDraftSchema`. */
  raw: unknown
  provider: BomAiProvider
  model: string
}

export type BomExtractor = (input: BomExtractInput) => Promise<BomExtractOutput>

export type BomAiProvider = 'anthropic' | 'gemini'

/* ────────────────────────────────── Prompt ────────────────────────────────── */

const COLUMN_GUIDE = BOM_LINE_FIELDS.map((f) => `- ${f.name}: ${f.desc}`).join('\n')
const PRODUCT_GUIDE = BOM_PRODUCT_FIELDS.map((f) => `- ${f.name}: ${f.desc}`).join('\n')

/**
 * Hướng dẫn đọc BOM. Viết theo đúng cách bộ biểu mẫu của công ty tổ chức dữ
 * liệu — luật ở đây rút ra từ đợt quét 187 file trong `docs/dinh-muc-nhom-theo-
 * bom-187-file.md`, nên trùng khớp với luật của `bom-import-all.mjs`.
 */
export function buildSystemPrompt(
  groups: { code: string; label: string }[],
  withProduct = false,
): string {
  const productBlock = withProduct
    ? `

# Khối thông tin chung ở ĐẦU file → \`product\`
Trên các bảng định mức có một khối thông tin về chính sản phẩm (TÊN SP, Mã Số HG, MÃ K.HÀNG, KTSP, Nhiên Liệu, Khối lượng, và một dòng đóng gói: Option / KTBB / Cái·40HC / NW / GW). Đọc khối đó vào \`product\`.

Ô nào file bỏ trống thì để null — nhất là "Mã Số HG", rất nhiều file không điền. Bịa ra một mã sai tệ hơn nhiều so với để trống cho người dùng gõ.

${PRODUCT_GUIDE}`
    : ''

  return `Bạn đọc BẢNG ĐỊNH MỨC (BOM) của một xưởng nội thất ngoài trời Việt Nam và trích ra dữ liệu có cấu trúc.${productBlock}

# Cấu trúc một file BOM
File chia thành nhiều KHỐI. Mỗi khối mở đầu bằng một dòng tiêu đề (thường gộp ô, in đậm) như "Quy cách : Nhôm", "QUY CÁCH VẢI TEXTILEN", "NGŨ KIM", "BAO BÌ ĐÓNG GÓI"; bên dưới là các dòng chi tiết, thường có một dòng tiêu đề cột riêng cho khối đó.

Các khối KHÔNG dùng chung bộ cột — đây là bảy dạng bảng đếm được trên 246 file thật:
- KHUNG: Loại · Dày · Rộng · Dài · Phi hao · SL · Tổng chiều dài (m) · Trọng lượng (kg) · Diện tích sơn (M²) · Dày vật liệu (δ)
- GỖ / POLYWOOD / MẶT BÀN: bỏ "Loại", thêm "Mộng"; ra Diện Tích (m2) và K. Lượng (m3)
- NỆM / MÚT / GÒN: như gỗ; mút có thêm "m3/tấm"
- VẢI: LOẠI VẢI · quy cách dài/rộng/dày · M2 · TỔNG VẢI M2 · hao hụt vải …% (và "Mét tới" với textilene)
- NGŨ KIM / BAO BÌ / TEM / DÂY KÉO: KHÔNG có kích thước nào — chỉ TÊN HÀNG HÓA · ĐVT · SL/SP · Vật Liệu
- SƠN & HOÁ CHẤT: STT · Mã hàng · Màu sơn · ĐVT · **Định mức** · NCC (khối hoá chất thì cột lượng tên là "Số kg / ghế")
- MÂY / DÂY ĐAN / DÂY DÙ: STT · Tên SP · Mã số · ĐVT · **Số lượng kg / 1 cái**

Ở hai dạng cuối, cột lượng KHÔNG tên là "Số lượng" nhưng vẫn là \`qty\`.

Mỗi khối trong file thành một phần tử của \`sections\`. Đọc HẾT các khối, kể cả khối chỉ có một dòng.

## NỆM và VẢI là HAI khối riêng, kể cả khi nằm chung một tiêu đề
Rất nhiều file đề "Quy cách Nệm:" hay "Quy cách Nệm + vải:" rồi kê HAI bảng khác nhau bên dưới: một bảng quy cách nệm (Dày/Rộng/Dài/Mộng/m³) và một bảng vải (LOẠI VẢI/M2/TỔNG VẢI M2/hao hụt). Đo trên 246 file: 64% khối mang tiêu đề "nệm" thật ra là bảng VẢI.

Tách thành HAI phần tử \`sections\`: bảng nào có cột "LOẠI VẢI" hoặc "TỔNG VẢI" thì vào nhóm vải, bảng còn lại vào nhóm nệm. Nhìn BỘ CỘT để quyết, đừng nhìn chữ trong tiêu đề.

# Nhóm hạng mục hợp lệ
Gán \`group_code\` cho từng khối dựa vào tiêu đề khối:
${groups.map((g) => `- ${g.code}: ${g.label}`).join('\n')}

Tiêu đề không rơi rõ vào nhóm nào thì chọn nhóm gần nghĩa nhất và hạ \`confidence\` của các dòng trong khối đó.

# Bỏ qua
- Dòng tiêu đề cột, dòng "Tổng", "Tổng cộng", "Cộng".
- Khối "KTBB", "KT SP", "OPTION" — đó là kích thước bao bì / sản phẩm, không phải định mức.
- Mọi cột TIỀN: "Đơn giá", "Thành tiền", "TT", "ĐGIÁ", "NCC", "Tiêu hao VNĐ/kg nhôm", "TỔNG TIỀN VẢI", "NVL phụ …%", "Công may, cắt". Định mức chỉ ghi nhận ĐỊNH MỨC — giá là dữ liệu của bộ phận Cung ứng, đọc vào là hai nơi giữ hai con số khác nhau.

# Đọc số
- Dấu phẩy là dấu THẬP PHÂN (1,4 = 1.4); dấu chấm phân nhóm nghìn (1.200 = 1200).
- Mọi kích thước tính bằng MILIMÉT, giữ nguyên như file ghi, không quy đổi.
- Ô trống để null, đừng đoán thay.

# KHÔNG ĐIỀN THAY — luật quan trọng nhất
Ô nào file BỎ TRỐNG thì trả null. Không suy, không đoán, không lấy giá trị dòng trên, không đặt mặc định, không đếm hộ.

Áp cho MỌI trường, đặc biệt hai chỗ hay bị điền bừa:
- qty (Số lượng): rất nhiều file BOM bỏ trống hẳn cột này. Trống thì để null — KHÔNG điền 1.
- part_no (Stt): cột Stt trống thì để null — KHÔNG tự đánh số 1, 2, 3.

Một bản trích THIẾU ô mà trung thực thì người dùng nhìn là biết phải bổ sung. Một bản trích ĐẦY ĐỦ mà có số bịa thì họ tin và mang đi mua hàng, tính giá thành. Thiếu luôn tốt hơn sai.

# Chép, đừng tính
Ranh giới: được CHÉP ô file đã ghi, KHÔNG được tự nhân chia ra số mới.

- File CÓ cột "Tổng chiều dài (m)" / "Đơn vị (m)" / "Trọng lượng (kg)" / "Diện tích (M²)" / "K. Lượng (m3)" → chép nguyên số vào \`total_length_m\` / \`weight_kg\` / \`paint_area_m2\` / \`volume_m3\`. Đây là số người lập bảng đã chốt — có dòng lấy theo bảng cân của nhà cung cấp, có profile gân không suy từ hình học ra được.
- File KHÔNG có cột đó → để null. TUYỆT ĐỐI không tự lấy dài × rộng × số lượng rồi điền vào. Phần mềm tự tính cho ô còn trống.

# Các trường của một dòng
${COLUMN_GUIDE}

# Độ chắc chắn
\`confidence\` là tự đánh giá thật, không phải phép lịch sự: để 1 khi cột khớp tiêu đề rõ ràng và số đọc sạch; hạ xuống 0.5–0.7 khi phải suy cột theo vị trí, ô gộp gây lệch, hoặc tiêu đề khối mơ hồ; dưới 0.5 khi thực sự đang đoán. Người dùng lọc theo số này để biết chỗ nào cần soi tay, nên đánh giá rộng rãi quá là làm hại họ.`
}

export function buildUserPrompt(input: BomExtractInput): string {
  const hint =
    (input.productHint ? `Sản phẩm đang mở: ${input.productHint}\n` : '') +
    (input.filename ? `Tên file: ${input.filename}\n` : '')
  const head = hint ? `${hint}\n` : ''
  if (input.grid) {
    return `${head}Dưới đây là toàn bộ ô của file BOM (.xlsx). Mỗi dòng bắt đầu bằng SỐ DÒNG THẬT trong Excel, các ô cách nhau bằng " | " theo thứ tự cột A, B, C… Dòng trống đã được lược nên số dòng không liên tục.

Dùng số dòng và thứ tự cột để ghi \`source_ref\` dạng <tên sheet>!<cột><dòng>.

${input.grid}`
  }
  return `${head}Đọc bảng định mức trong tài liệu đính kèm.`
}

/* ───────────────────────────── Chọn nhà cung cấp ──────────────────────────── */

/**
 * Model mặc định — đổi bằng env khi cần thử tầng khác mà không phải sửa code.
 *
 * Bên Gemini cố tình GHIM một model cụ thể thay vì alias `gemini-flash-latest`:
 * đo ngày 17/08/2026 thì alias đó và `gemini-3.7-flash` đều trả 503 UNAVAILABLE
 * liên tục (cả khi bỏ schema — tức là do model chứ không do request), trong khi
 * `gemini-3.5-flash` đáp ổn định và ra đúng JSON theo schema. Alias tiện nhưng
 * hỏng là hỏng cả tính năng mà không ai đổi được gì; ghim model thì lúc cần
 * nhảy tầng vẫn có `BOM_AI_MODEL`.
 *
 * Đo lại khi thấy chậm: `gemini-3-flash-preview` nhanh gấp đôi nhưng là preview,
 * `gemini-3.1-flash-lite` nhanh nhất nhưng tầng lite có thể yếu với BOM lộn xộn.
 */
const DEFAULT_MODEL: Record<BomAiProvider, string> = {
  anthropic: 'claude-opus-5',
  gemini: 'gemini-3.5-flash',
}

export function resolveProvider(): BomAiProvider {
  const raw = (process.env.BOM_AI_PROVIDER ?? '').trim().toLowerCase()
  if (raw === 'anthropic' || raw === 'gemini') return raw
  if (raw) {
    throw BadRequest(`BOM_AI_PROVIDER không hợp lệ: "${raw}" (chỉ anthropic | gemini)`)
  }
  // Không khai báo thì suy từ key nào đang có — đỡ phải đặt hai biến ở máy dev.
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  throw BadRequest(
    'Chưa cấu hình đọc BOM bằng AI — cần ANTHROPIC_API_KEY hoặc GEMINI_API_KEY trong .env.local',
  )
}

export function modelFor(provider: BomAiProvider): string {
  return (process.env.BOM_AI_MODEL ?? '').trim() || DEFAULT_MODEL[provider]
}

/**
 * Nạp adapter theo kiểu động để nhánh không dùng tới không bị kéo vào bundle —
 * và để gỡ một trong hai SDK sau khi chấm điểm xong chỉ là xoá file, không phải
 * gỡ import rải rác.
 */
export async function resolveExtractor(): Promise<{
  extract: BomExtractor
  provider: BomAiProvider
}> {
  const provider = resolveProvider()
  if (provider === 'anthropic') {
    const { extractWithAnthropic } = await import('./bom-ai.anthropic')
    return { extract: extractWithAnthropic, provider }
  }
  const { extractWithGemini } = await import('./bom-ai.gemini')
  return { extract: extractWithGemini, provider }
}
