/**
 * MẪU CHỨNG TỪ — quy tắc ĐÁNH SỐ và khuôn MẪU IN của từng loại phiếu.
 *
 * Trước 0164 hai thứ này nằm cứng ở hai nơi khác nhau:
 *   · Đánh số: hàm SQL `next_doc_code()` ghép chết `KIND-YYYY-NNNN`.
 *   · Mẫu in: tiêu đề, quốc hiệu, mẫu số TT200 và tên các cột chữ ký gõ thẳng
 *     trong JSX của 6 trang in.
 * Kế toán đổi tiền tố đầu năm, hoặc công ty đổi người ký, đều phải sửa code rồi
 * deploy — việc lẽ ra là một ô nhập.
 *
 * File này là NGUỒN mặc định (thuần, không I/O) để:
 *   1. hệ vẫn chạy đúng như cũ khi bảng `doc_templates` chưa được tạo/áp;
 *   2. màn cấu hình có sẵn giá trị gốc để so và để "khôi phục mặc định";
 *   3. xem trước mã kế tiếp ngay lúc gõ, không phải lưu rồi lập thử một phiếu.
 *
 * LSX CỐ Ý ĐỨNG NGOÀI phần đánh số: số lệnh đếm theo TỪNG KHÁCH trong năm
 * (`01/26 - Rosco`, xem `lsx-code.ts`) — không nhét vừa khuôn "một bộ đếm cho
 * cả công ty". Nó vẫn có mẫu IN ở đây.
 */

export const DOC_KINDS = [
  'BG',
  'DH',
  'PO',
  'LSX',
  'PNK',
  'PXK',
  'KK',
  'DCK',
  'MS',
  'PM',
] as const
export type DocKind = (typeof DOC_KINDS)[number]

/** Mốc reset bộ đếm. */
export const RESET_SCOPES = ['year', 'month', 'never'] as const
export type ResetScope = (typeof RESET_SCOPES)[number]

export type SignatureCol = {
  /** Tên cột ký in đậm. */
  role: string
  /** Dòng nhỏ trong ngoặc bên dưới, vd "Ký, ghi rõ họ tên". */
  hint?: string
  /**
   * Ô TÊN NGƯỜI in sẵn dưới nét ký, lấy từ chính chứng từ:
   * `creator` người lập · `approver` người duyệt · `counterparty` người giao/nhận.
   *
   * Không cho sửa trên màn cấu hình — nó là chỗ MÓC dữ liệu, không phải chữ.
   * Cột do admin tự thêm không có slot ⇒ in ra nét ký trống, đúng như mong đợi.
   */
  slot?: 'creator' | 'approver' | 'counterparty'
}

export type DocTemplate = {
  kind: DocKind
  label: string
  /* ── Đánh số ──────────────────────────────────────────────────────────── */
  /** `null` = loại này KHÔNG dùng bộ đếm chung (hiện chỉ LSX). */
  prefix: string | null
  /** Khuôn ghép mã — xem `formatDocCode` để biết các ô thay thế. */
  pattern: string
  /** Số chữ số của phần số thứ tự (đệm 0 bên trái). */
  seq_pad: number
  reset_scope: ResetScope
  /* ── Mẫu in ───────────────────────────────────────────────────────────── */
  title_vi: string
  title_en: string | null
  /** In "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM…" ở góc phải. */
  national_heading: boolean
  /** Mẫu số theo TT200 cho phiếu kho — đứng thay chỗ quốc hiệu. */
  form_no: string | null
  signatures: SignatureCol[]
  /**
   * CHƯA DÙNG. Cột để sẵn cho "điều khoản điền sẵn", nhưng hai loại phiếu có
   * điều khoản đều đã lấy mặc định ở tầng SÁT HƠN: đơn mua theo MẪU ĐƠN của
   * từng loại vật tư (`po-template.ts`, 13 mẫu × 5 dòng), báo giá theo TỪNG
   * KHÁCH (`sales_customers.default_payment_terms`). Đổ thêm một mặc định
   * chung ở đây là đẻ nguồn thứ hai đá nhau với nguồn đang chạy.
   */
  default_terms: string
  /**
   * Có TRANG IN hay không — sự thật của CODE, không nằm trong DB. Loại nào chưa
   * có trang in (mẫu showroom, phiếu mượn mẫu) thì màn cấu hình chỉ bày phần
   * đánh số, không bày ô tiêu đề/chữ ký cho người ta sửa thứ không in ra đâu.
   */
  printable: boolean
}

const KY = 'Ký, ghi rõ họ tên'
const KY_DONG_DAU = 'Ký, ghi rõ họ tên, đóng dấu'

/**
 * MẶC ĐỊNH = ĐÚNG hành vi trước 0164. Đổi số ở đây là đổi phiếu của công ty —
 * sửa thì phải đối chiếu lại với tờ giấy đang ký.
 */
export const DEFAULT_DOC_TEMPLATES: Record<DocKind, DocTemplate> = {
  BG: {
    kind: 'BG',
    label: 'Báo giá',
    prefix: 'BG',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'BÁO GIÁ',
    title_en: 'QUOTATION',
    // Phiếu gửi khách nước ngoài — in quốc hiệu Việt Nam lên tờ quotation gửi
    // MERXX HANDELS GMBH là sai đối tượng đọc.
    national_heading: false,
    form_no: null,
    signatures: [
      { role: 'KHÁCH HÀNG / CUSTOMER', hint: KY_DONG_DAU },
      { role: 'NGƯỜI LẬP / PREPARED BY', hint: KY },
      { role: 'GIÁM ĐỐC / DIRECTOR', hint: KY_DONG_DAU },
    ],
    default_terms: '',
    printable: true,
  },
  DH: {
    kind: 'DH',
    label: 'Đơn hàng bán / hợp đồng',
    prefix: 'DH',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'SALES CONTRACT',
    title_en: null,
    national_heading: false,
    form_no: null,
    // Hợp đồng bán in theo khuôn riêng (Article 1-9), không có khối ký dùng
    // chung — màn cấu hình vì thế chỉ bày phần tiêu đề.
    signatures: [],
    default_terms: '',
    printable: true,
  },
  PO: {
    kind: 'PO',
    label: 'Đơn đặt hàng (mua vật tư)',
    prefix: 'PO',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'ĐƠN ĐẶT HÀNG',
    title_en: 'PURCHASE ORDER',
    national_heading: true,
    form_no: null,
    // Cột giữa lấy chức danh người ký của chính đơn (`signer_role`); cột cuối
    // lấy TÊN CÔNG TY — chỗ Giám đốc ký và đóng dấu.
    signatures: [
      { role: 'XÁC NHẬN CỦA NHÀ CUNG CẤP', hint: KY_DONG_DAU },
      // Cột "Người lập": chức danh do chính đơn khai, TÊN thì móc từ người
      // soạn đơn — phiếu gửi NCC phải nói rõ ai bên mình đứng ra đặt.
      { role: '{signer_role}', hint: KY, slot: 'creator' },
      { role: '{company}', hint: 'Ký tên, đóng dấu' },
    ],
    default_terms: '',
    printable: true,
  },
  LSX: {
    kind: 'LSX',
    label: 'Lệnh sản xuất',
    // Số lệnh đếm theo TỪNG KHÁCH trong năm (`01/26 - Rosco`) — không dùng bộ
    // đếm chung, nên không có tiền tố. Xem `lsx-code.ts`.
    prefix: null,
    pattern: '{seq}/{yy} - {customer}',
    seq_pad: 2,
    reset_scope: 'year',
    title_vi: 'LỆNH SẢN XUẤT',
    // Để TRỐNG: chỗ dòng phụ dưới tiêu đề LSX dành cho dòng "CHỈNH SỬA LẦN N",
    // và bản in hiện hành không có dòng tiếng Anh nào.
    title_en: null,
    national_heading: true,
    form_no: null,
    signatures: [
      { role: 'Người lập' },
      { role: 'Trưởng phòng kế hoạch' },
      { role: 'Giám Đốc' },
    ],
    default_terms: '',
    printable: true,
  },
  PNK: {
    kind: 'PNK',
    label: 'Phiếu nhập kho',
    prefix: 'PNK',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'PHIẾU NHẬP KHO',
    title_en: null,
    national_heading: false,
    form_no: '01-VT',
    signatures: [
      { role: 'Người lập phiếu', hint: KY, slot: 'creator' },
      { role: 'Người giao hàng', hint: KY, slot: 'counterparty' },
      { role: 'Thủ kho', hint: KY },
      { role: 'Kế toán trưởng', hint: KY },
    ],
    default_terms: '',
    printable: true,
  },
  PXK: {
    kind: 'PXK',
    label: 'Phiếu xuất kho',
    prefix: 'PXK',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'PHIẾU XUẤT KHO',
    title_en: null,
    national_heading: false,
    form_no: '02-VT',
    signatures: [
      { role: 'Người lập phiếu', hint: KY, slot: 'creator' },
      { role: 'Người nhận hàng', hint: KY, slot: 'counterparty' },
      { role: 'Thủ kho', hint: KY },
      { role: 'Kế toán trưởng', hint: KY },
    ],
    default_terms: '',
    printable: true,
  },
  KK: {
    kind: 'KK',
    label: 'Biên bản kiểm kê',
    prefix: 'KK',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'BIÊN BẢN KIỂM KÊ VẬT TƯ',
    title_en: null,
    national_heading: false,
    form_no: '05-VT',
    signatures: [
      { role: 'Người kiểm kê (lập biên bản)', hint: KY, slot: 'creator' },
      { role: 'Thủ kho', hint: KY },
      { role: 'Quản lý Kho (duyệt)', hint: KY, slot: 'approver' },
      { role: 'Kế toán trưởng', hint: KY },
    ],
    default_terms: '',
    printable: true,
  },
  DCK: {
    kind: 'DCK',
    label: 'Phiếu điều chuyển kho',
    prefix: 'DCK',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'PHIẾU ĐIỀU CHUYỂN KHO',
    title_en: null,
    national_heading: false,
    form_no: null,
    signatures: [
      { role: 'Người lập phiếu', hint: KY },
      { role: 'Thủ kho xuất', hint: KY },
      { role: 'Thủ kho nhận', hint: KY },
    ],
    default_terms: '',
    printable: true,
  },
  MS: {
    kind: 'MS',
    label: 'Mẫu showroom',
    prefix: 'MS',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'MẪU SHOWROOM',
    title_en: null,
    national_heading: false,
    form_no: null,
    signatures: [],
    default_terms: '',
    printable: false,
  },
  PM: {
    kind: 'PM',
    label: 'Phiếu mượn mẫu',
    prefix: 'PM',
    pattern: '{prefix}-{yyyy}-{seq}',
    seq_pad: 4,
    reset_scope: 'year',
    title_vi: 'PHIẾU MƯỢN MẪU',
    title_en: null,
    national_heading: false,
    form_no: null,
    signatures: [],
    default_terms: '',
    printable: false,
  },
}

export const isDocKind = (v: unknown): v is DocKind =>
  typeof v === 'string' && (DOC_KINDS as readonly string[]).includes(v)

/**
 * Ghép mã từ khuôn. Các ô thay thế:
 *   `{prefix}` tiền tố · `{yyyy}` 2026 · `{yy}` 26 · `{mm}` 08 · `{seq}` số đã đệm 0
 *
 * PHẢI khớp tuyệt đối với hàm SQL `next_doc_code` (0164) — đây là bản dùng để
 * XEM TRƯỚC trên màn cấu hình, số thật do DB cấp (chỉ DB mới đếm được an toàn
 * khi hai người bấm lưu cùng lúc).
 */
export function formatDocCode(
  t: Pick<DocTemplate, 'prefix' | 'pattern' | 'seq_pad'>,
  seq: number,
  at: Date,
): string {
  const yyyy = String(at.getFullYear())
  return t.pattern
    .replace(/\{prefix\}/g, t.prefix ?? '')
    .replace(/\{yyyy\}/g, yyyy)
    .replace(/\{yy\}/g, yyyy.slice(-2))
    .replace(/\{mm\}/g, String(at.getMonth() + 1).padStart(2, '0'))
    .replace(/\{seq\}/g, String(seq).padStart(t.seq_pad, '0'))
}

/**
 * Đổ dữ liệu THẬT của chứng từ vào khuôn chữ ký: thay ô `{company}` /
 * `{signer_role}` trong tên cột, và gắn tên người theo `slot`.
 *
 * Trang in gọi hàm này thay vì tự ghép — ba trang từng ghép ba kiểu, in ra là
 * ba tờ của cùng một công ty trông như ba nơi phát hành.
 */
export function resolveSignatures(
  cols: SignatureCol[],
  ctx: {
    company?: string | null
    signer_role?: string | null
    names?: Partial<Record<NonNullable<SignatureCol['slot']>, string | null>>
  },
): { role: string; hint?: string; name?: string | null }[] {
  return cols.map((c) => ({
    role: c.role
      .replace(/{company}/g, (ctx.company ?? 'GIÁM ĐỐC').toUpperCase())
      .replace(/{signer_role}/g, ctx.signer_role ?? ''),
    hint: c.hint,
    name: c.slot ? (ctx.names?.[c.slot] ?? '') : undefined,
  }))
}

/** Câu mô tả mốc reset — hiện cạnh ô chọn để người sửa biết hệ quả. */
export const RESET_LABEL: Record<ResetScope, string> = {
  year: 'Đầu năm về lại 1',
  month: 'Đầu tháng về lại 1',
  never: 'Chạy tiếp, không reset',
}
