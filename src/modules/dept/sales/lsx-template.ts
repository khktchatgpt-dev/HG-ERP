/**
 * FORM PHIẾU LỆNH SẢN XUẤT — MỘT MẪU CHUẨN DÙNG CHUNG CHO MỌI KHÁCH.
 *
 * Chủ dự án chốt 04/08/2026: bỏ kiểu "mỗi khách một mẫu". Bốn file Excel đang
 * chạy khác nhau vì hai nhân viên Sales mỗi người tự dựng một bảng — đó là hiện
 * trạng cần chuẩn hoá, không phải quy tắc cần giữ. Cột nào chỉ một khách dùng
 * thì vẫn có mặt trên form, khách khác để trống.
 *
 * Cái LẤY LẠI từ file Excel là CÁCH TRÌNH BÀY, không phải bộ cột:
 *   · thông tin nhóm (đơn hàng / số PO / ngày giao / ghi chú) nằm ở CỘT RIÊNG,
 *     gộp ô suốt các dòng của nhóm — như merged cell A12:A15 của ROSCO;
 *   · STT đánh lại từ 1 trong mỗi nhóm;
 *   · khép mỗi nhóm bằng dòng cộng (SL + khối), khép phiếu bằng dòng "Tổng".
 *
 * Thứ CÒN RIÊNG theo khách chỉ là NỘI DUNG, không phải hình thức: khối "một số
 * lưu ý chung" cuối phiếu (bảo hành, tiêu chuẩn nệm, logo…) — khai ở
 * `sales_customers.lsx_template.notes_footer`.
 */

export type LsxLineField =
  | 'product_code'
  | 'customer_item_code'
  | 'name_foreign'
  | 'name_vi'
  | 'name_customs'
  | 'barcode'
  | 'unit'
  | 'qty'
  | 'cbm'
  | 'packing'
  | 'ship'
  | 'note'
  | 'important_note'

export type LsxColSource =
  | { kind: 'stt' }
  | { kind: 'image' }
  | { kind: 'line'; field: LsxLineField }
  /** CBM × số lượng. */
  | { kind: 'total_cbm' }
  | { kind: 'spec'; key: string }
  | { kind: 'check'; key: string }
  | { kind: 'extra'; key: string }
  /** Thông tin NHÓM, in gộp ô suốt các dòng của nhóm. */
  | { kind: 'group'; field: 'title' | 'buyer_name' | 'po_no' | 'ship' | 'note' }

export type LsxSheetColumn = {
  label: string
  source: LsxColSource
  /** Tiêu đề tầng trên gộp nhiều cột. */
  band?: string
  align?: 'left' | 'center' | 'right'
  /** Ô nhập nhiều dòng ở màn soạn (spec thật hay 2 dòng: "Sơn xám cát ⏎ PT-7476"). */
  multiline?: boolean
  hint?: string
}

export type LsxTemplate = {
  label: string
  columns: LsxSheetColumn[]
  stt_mode: 'line' | 'group'
  group_mode: 'columns' | 'title_row' | 'none'
  group_total: 'cube' | null
  grand_total: 'qty' | null
  notes_footer: string | null
}

/**
 * BỘ CỘT CHUẨN — hợp của những gì 4 khách đang dùng, xếp theo trình tự đọc của
 * xưởng: định danh → số lượng/khối → vật liệu → đóng gói/giao → kiểm tra hồ sơ.
 */
export const LSX_FORM_COLUMNS: LsxSheetColumn[] = [
  { label: 'STT', source: { kind: 'stt' } },
  // Nhóm = một đơn hàng / một PO (lệnh gộp nhiều đơn — 0113). Gộp ô suốt nhóm.
  { label: 'Đơn hàng', source: { kind: 'group', field: 'title' }, align: 'left' },
  { label: 'Số PO', source: { kind: 'group', field: 'po_no' } },
  { label: 'Hình ảnh sp', source: { kind: 'image' } },
  { label: 'Mã SP', source: { kind: 'line', field: 'product_code' } },
  { label: 'Mã khách', source: { kind: 'line', field: 'customer_item_code' } },
  {
    label: 'Tên nước ngoài\n(nội dung trên shipping mark)',
    source: { kind: 'line', field: 'name_foreign' },
    align: 'left',
  },
  { label: 'Tên tiếng việt', source: { kind: 'line', field: 'name_vi' }, align: 'left' },
  {
    label: 'Tên khai hải quan\n(kế toán)',
    source: { kind: 'line', field: 'name_customs' },
    align: 'left',
  },
  { label: 'Số barcode', source: { kind: 'line', field: 'barcode' } },
  { label: 'ĐVT', source: { kind: 'line', field: 'unit' } },
  { label: 'Số lượng', source: { kind: 'line', field: 'qty' }, align: 'right' },
  { label: 'CBM', source: { kind: 'line', field: 'cbm' }, align: 'right' },
  { label: 'Tổng CBM', source: { kind: 'total_cbm' }, align: 'right' },
  {
    label: 'Mây',
    source: { kind: 'spec', key: 'may' },
    multiline: true,
    hint: 'Dây dù màu kem / HK-PP6 kem',
  },
  {
    label: 'Nệm',
    source: { kind: 'spec', key: 'nem' },
    multiline: true,
    hint: 'Màu kem 230gr Olefin',
  },
  {
    label: 'Sơn',
    source: { kind: 'spec', key: 'son' },
    multiline: true,
    hint: 'Sơn xám cát / PT-7476',
  },
  { label: 'Kính', source: { kind: 'spec', key: 'kinh' }, hint: 'Kính cường lực 8mm' },
  {
    label: 'Gỗ',
    source: { kind: 'spec', key: 'go' },
    multiline: true,
    hint: 'Acacia FSC 100% / Màu 142',
  },
  { label: 'Đóng gói', source: { kind: 'line', field: 'packing' }, hint: '4 cái/ thùng' },
  { label: 'Thời gian xuất', source: { kind: 'line', field: 'ship' }, hint: 'w37.26' },
  { label: 'Note', source: { kind: 'line', field: 'note' }, align: 'left' },
  {
    label: 'Lưu ý quan trọng',
    source: { kind: 'line', field: 'important_note' },
    align: 'left',
  },
  { label: 'BOM', source: { kind: 'check', key: 'bom' }, band: 'Kiểm tra hồ sơ' },
  { label: 'Bản vẽ', source: { kind: 'check', key: 'ban_ve' }, band: 'Kiểm tra hồ sơ' },
  { label: 'Mẫu', source: { kind: 'check', key: 'mau' }, band: 'Kiểm tra hồ sơ' },
  {
    label: 'Mẫu tại showroom',
    source: { kind: 'check', key: 'showroom' },
    band: 'Kiểm tra hồ sơ',
  },
]

/** Form chuẩn — mọi khách in ra cùng một bảng này. */
export const LSX_FORM: LsxTemplate = {
  label: 'Form chuẩn Hoàng Gia',
  columns: LSX_FORM_COLUMNS,
  stt_mode: 'line',
  group_mode: 'columns',
  group_total: 'cube',
  grand_total: 'qty',
  notes_footer: null,
}

/**
 * Mẫu áp dụng cho một khách = FORM CHUẨN + phần nội dung riêng của khách.
 * `sales_customers.lsx_template` chỉ còn khai được `notes_footer` (khối lưu ý
 * chung cuối phiếu); mọi khai báo cột cũ bị bỏ qua để phiếu không lệch nhau nữa.
 */
export function resolveLsxTemplate(raw: unknown): LsxTemplate {
  const t = (raw ?? {}) as { notes_footer?: string | null }
  return {
    ...LSX_FORM,
    notes_footer:
      typeof t.notes_footer === 'string' && t.notes_footer.trim() ? t.notes_footer : null,
  }
}

/** Cột spec/checklist/cột phụ — màn soạn dòng dựng ô nhập từ đây. */
export const specColumnsOf = (t: LsxTemplate) =>
  t.columns.filter((c) => c.source.kind === 'spec')
export const checkColumnsOf = (t: LsxTemplate) =>
  t.columns.filter((c) => c.source.kind === 'check')
export const extraColumnsOf = (t: LsxTemplate) =>
  t.columns.filter((c) => c.source.kind === 'extra')

/** Khoá jsonb của một cột (spec/check/extra) — dùng khi đọc/ghi giá trị dòng. */
export const colKey = (c: LsxSheetColumn) => ('key' in c.source ? c.source.key : '')

/** Form chuẩn luôn có cột CBM — giữ hàm cho chỗ gọi cũ khỏi phải biết chi tiết. */
export const hasCbm = (t: LsxTemplate) =>
  t.columns.some(
    (c) =>
      c.source.kind === 'total_cbm' ||
      (c.source.kind === 'line' && c.source.field === 'cbm'),
  )
