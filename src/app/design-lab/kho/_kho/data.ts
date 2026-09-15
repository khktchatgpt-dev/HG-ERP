/**
 * Số liệu mẫu của bảy màn Kho.
 *
 * Mã vật tư, tên, ĐVT và tên nhóm lấy từ DANH MỤC THẬT (13.229 mã, đọc
 * 15/09/2026) — mẫu dùng số giả mà tên giả nữa thì không ai soi ra được cột
 * nào chật, tên nào tràn. Riêng LƯỢNG và NGÀY là dựng, vì kho thật đang ở
 * mốc 0 sau phiếu kiểm kê đầu kỳ.
 *
 * Để chung một chỗ vì bảy màn phải nói CÙNG MỘT CON SỐ: ô "Chờ cấp 7" ở bàn
 * làm việc và bảy dòng ở màn cấp vật tư phải là một tập, nếu không thì chính
 * màn mẫu đã vi phạm nguyên tắc "con số là một lời hứa".
 */

export const TODAY = '15/09/2026'

/* ── Vật tư ──────────────────────────────────────────────────────────────── */

export type Mat = {
  code: string
  name: string
  unit: string
  group: string
}

export const MATS: Record<string, Mat> = {
  'NH-0480': { code: 'NH-0480', name: 'Nhôm hộp 20 x 40 x T1.0 có 2 gân', unit: 'Cây', group: 'Nhôm định hình - tấm' }, // prettier-ignore
  'NH-0482': { code: 'NH-0482', name: 'Nhôm hộp 20 x 60 T1.2', unit: 'Cây', group: 'Nhôm định hình - tấm' }, // prettier-ignore
  'NH-0485': { code: 'NH-0485', name: 'Nhôm hộp 25 x 30 T1.2 ko gân có rãnh vải', unit: 'Cây', group: 'Nhôm định hình - tấm' }, // prettier-ignore
  MAY0448: { code: 'MAY0448', name: 'Dây dù tròn 6mm, màu kem', unit: 'Thanh', group: 'Dây mây - vật liệu đan' }, // prettier-ignore
  MAY0449: { code: 'MAY0449', name: 'Dây dù tròn 6mm, màu đen', unit: 'Thanh', group: 'Dây mây - vật liệu đan' }, // prettier-ignore
  BUL0071: { code: 'BUL0071', name: 'Bulon 6x50x12', unit: 'Con', group: 'Bu lông - vít - đinh - liên kết' }, // prettier-ignore
  LON0014: { code: 'LON0014', name: 'LĐN 8x19x20 (xanh đen)', unit: 'Con', group: 'Bu lông - vít - đinh - liên kết' }, // prettier-ignore
  GON0022: { code: 'GON0022', name: 'Gòn PKF 400gr x 111.5 x 37 x 2cm', unit: 'Tấm', group: 'Mút - xốp - nệm - gòn' }, // prettier-ignore
  CHI0005: { code: 'CHI0005', name: 'Chỉ PE 40/2 màu', unit: 'Cuộn', group: 'Vải - da - chỉ - phụ liệu may' }, // prettier-ignore
  PKN0294: { code: 'PKN0294', name: 'Tấm lót chân ghế carton 3 lớp 200x100mm', unit: 'Tấm', group: 'Bao bì - đóng gói - tem nhãn' }, // prettier-ignore
  HAN0032: { code: 'HAN0032', name: 'Dây hàn 70s-0.8 MM', unit: 'Kg', group: 'Vật tư hàn - cắt' }, // prettier-ignore
}

export const m = (code: string): Mat =>
  MATS[code] ?? { code, name: code, unit: '', group: '' }

/* ── Đợt giao đang chờ nhận (màn Hàng về + ô việc) ───────────────────────── */

export type Arrival = {
  id: string
  po: string
  supplier: string
  /** dd/mm hiển thị. */
  due: string
  /** Âm = quá hẹn bấy nhiêu ngày, 0 = hôm nay, dương = còn bấy nhiêu ngày. */
  inDays: number
  lines: number
  volume: string
  /** Vì sao dòng này đáng chú ý — cột này là lý do màn tồn tại. */
  why: string
  /** Chưa hẹn ngày: NCC không báo trước, vẫn phải ngóng. */
  noDate?: boolean
}

export const ARRIVALS: Arrival[] = [
  { id: 'a1', po: 'PO-2609-031', supplier: 'Sơn Tín Phát', due: '12/09', inDays: -3, lines: 8, volume: '1.240 kg', why: 'Cung ứng đã gọi 13/09, NCC hẹn lại "cuối tuần"' }, // prettier-ignore
  { id: 'a2', po: 'PO-2609-044', supplier: 'Vạn Vi Thành', due: '15/09', inDays: 0, lines: 3, volume: '96 cây', why: 'Lệnh 07/26-14 vào chuyền 16/09 — về trễ là dừng chuyền' }, // prettier-ignore
  { id: 'a3', po: 'PO-2609-047', supplier: 'Nhựa Tân Tiến', due: '15/09', inDays: 0, lines: 5, volume: '820 thanh', why: 'Đợt 2 của đơn, đợt 1 đã nhận đủ' }, // prettier-ignore
  { id: 'a4', po: 'PO-2609-049', supplier: 'Cơ khí Thành Đạt', due: '18/09', inDays: 3, lines: 4, volume: '2.400 con', why: 'Đúng hẹn' }, // prettier-ignore
  { id: 'a5', po: 'PO-2609-052', supplier: 'Gòn Phương Nam', due: '19/09', inDays: 4, lines: 2, volume: '600 tấm', why: 'Đúng hẹn' }, // prettier-ignore
  { id: 'a6', po: 'PO-2609-038', supplier: 'Bao bì Minh Long', due: '—', inDays: 9, lines: 6, volume: '12.000 tấm', why: 'NCC không nhận hẹn ngày, giao khi có xe', noDate: true }, // prettier-ignore
]

/* ── Lệnh chờ cấp vật tư ─────────────────────────────────────────────────── */

export type NeedLine = {
  code: string
  need: number
  issued: number
  /** Tồn DÙNG ĐƯỢC — không phải tổng tồn. */
  usable: number
  /** Lượng đang mắc ở trạng thái khác, kèm lý do đọc được. */
  stuck?: { qty: number; where: 'qc' | 'blocked'; note: string }
  /** Đường gỡ khi thiếu — bắt buộc có nếu dòng không đủ. */
  fix?: string
}

export type Lsx = {
  id: string
  code: string
  product: string
  qty: string
  /** Ngày vào chuyền. */
  start: string
  inDays: number
  lines: NeedLine[]
}

export const LSXS: Lsx[] = [
  {
    id: 'l1',
    code: 'LSX 07/26-14',
    product: 'Ghế MERXX-209',
    qty: '300 cái',
    start: '16/09',
    inDays: 1,
    lines: [
      { code: 'NH-0480', need: 900, issued: 900, usable: 380 },
      { code: 'NH-0482', need: 400, issued: 200, usable: 150, stuck: { qty: 200, where: 'blocked', note: 'khoá 12/09 — NCC giao sai mã hợp kim' }, fix: 'Thiếu 50 cây. 200 cây đang KHOÁ chờ Cung ứng quyết trả hay nhận.' }, // prettier-ignore
      { code: 'MAY0448', need: 120, issued: 0, usable: 0, fix: 'Chưa có cây nào. PO-2609-047 hẹn về 15/09 — hôm nay, chưa nhận.' }, // prettier-ignore
      { code: 'BUL0071', need: 2400, issued: 0, usable: 0, stuck: { qty: 2400, where: 'qc', note: 'nhận 14/09, chờ KCS kiểm' }, fix: '2.400 con đã về nhưng đang CHỜ KIỂM — nhờ KCS mở khoá là cấp được ngay.' }, // prettier-ignore
      { code: 'GON0022', need: 300, issued: 300, usable: 120 },
      { code: 'CHI0005', need: 40, issued: 40, usable: 18 },
      { code: 'PKN0294', need: 600, issued: 600, usable: 3200 },
      { code: 'LON0014', need: 2400, issued: 2400, usable: 5100 },
    ],
  },
  {
    id: 'l2',
    code: 'LSX 07/26-15',
    product: 'Bàn LAURA-11',
    qty: '120 bộ',
    start: '16/09',
    inDays: 1,
    lines: [
      { code: 'NH-0485', need: 480, issued: 0, usable: 520 },
      { code: 'MAY0449', need: 240, issued: 0, usable: 260 },
      { code: 'HAN0032', need: 18, issued: 0, usable: 24 },
      { code: 'LON0014', need: 960, issued: 0, usable: 5100 },
    ],
  },
  {
    id: 'l3',
    code: 'LSX 07/26-09',
    product: 'Ghế MERXX-909',
    qty: '200 cái',
    start: '11/09',
    inDays: -4,
    lines: [
      { code: 'NH-0480', need: 600, issued: 600, usable: 380 },
      { code: 'BUL0071', need: 1600, issued: 1200, usable: 0, stuck: { qty: 2400, where: 'qc', note: 'nhận 14/09, chờ KCS kiểm' }, fix: 'Còn 400 con. Lô 2.400 đang CHỜ KIỂM — mở khoá là đủ.' }, // prettier-ignore
      { code: 'CHI0005', need: 25, issued: 25, usable: 18 },
    ],
  },
]

/** Lệnh coi là "đủ" khi mọi dòng đã cấp hết phần cần. */
export const done = (l: NeedLine) => l.issued >= l.need
export const covered = (x: Lsx) => x.lines.filter(done).length

/* ── Tồn kho ─────────────────────────────────────────────────────────────── */

export type StockRow = {
  code: string
  /** Dùng được — số duy nhất được phép dùng để tính đủ/thiếu. */
  usable: number
  qc: number
  blocked: number
  /** Đã hứa cho lệnh đã duyệt. Là số TÍNH, không phải trạng thái lưu. */
  held: number
  min: number
  bin: string
}

export const STOCK: StockRow[] = [
  { code: 'NH-0480', usable: 380, qc: 0, blocked: 0, held: 180, min: 150, bin: 'NHOM-A1' }, // prettier-ignore
  { code: 'NH-0482', usable: 150, qc: 0, blocked: 200, held: 400, min: 200, bin: 'NHOM-A2' }, // prettier-ignore
  { code: 'NH-0485', usable: 520, qc: 0, blocked: 0, held: 480, min: 200, bin: 'NHOM-A3' }, // prettier-ignore
  { code: 'MAY0448', usable: 0, qc: 0, blocked: 0, held: 120, min: 100, bin: 'MAY-B1' },
  { code: 'MAY0449', usable: 260, qc: 0, blocked: 0, held: 240, min: 100, bin: 'MAY-B1' }, // prettier-ignore
  { code: 'BUL0071', usable: 0, qc: 2400, blocked: 0, held: 4000, min: 1000, bin: 'TIEP-NHAN' }, // prettier-ignore
  { code: 'LON0014', usable: 5100, qc: 0, blocked: 0, held: 3360, min: 1000, bin: 'PK-C2' }, // prettier-ignore
  { code: 'GON0022', usable: 120, qc: 0, blocked: 0, held: 0, min: 150, bin: 'NEM-D1' },
  { code: 'CHI0005', usable: 18, qc: 0, blocked: 0, held: 0, min: 20, bin: 'MAY-B3' },
  { code: 'PKN0294', usable: 3200, qc: 0, blocked: 0, held: 600, min: 500, bin: 'BB-E1' }, // prettier-ignore
  { code: 'HAN0032', usable: 24, qc: 0, blocked: 0, held: 18, min: 10, bin: 'HAN-F1' },
]

export const free = (s: StockRow) => s.usable - s.held

/* ── Việc chờ cất (sau khi ghi sổ phiếu nhập) ────────────────────────────── */

export type PutRow = {
  code: string
  qty: number
  /** Kệ gợi ý theo lần cất gần nhất của chính mã đó. */
  suggest: string
  /** Hàng khoá đi thẳng kệ khoá, không cho chọn. */
  locked?: boolean
}

export type PutDoc = {
  doc: string
  at: string
  supplier: string
  rows: PutRow[]
}

export const PUTAWAY: PutDoc[] = [
  {
    doc: 'PNK-2609-051',
    at: '09:20',
    supplier: 'Vạn Vi Thành',
    rows: [
      { code: 'NH-0480', qty: 380, suggest: 'NHOM-A1' },
      { code: 'NH-0482', qty: 200, suggest: 'KHOA-01', locked: true },
      { code: 'BUL0071', qty: 2400, suggest: '' },
    ],
  },
  {
    doc: 'PNK-2609-050',
    at: '08:05',
    supplier: 'Nhựa Tân Tiến',
    rows: [
      { code: 'MAY0449', qty: 260, suggest: 'MAY-B1' },
      { code: 'CHI0005', qty: 18, suggest: 'MAY-B3' },
    ],
  },
]

/* ── Định dạng ───────────────────────────────────────────────────────────── */

export const n = (v: number) => v.toLocaleString('vi-VN')
/* ══════════════════════════════════════════════════════════════════════════
   MƯỜI HAI MÃ LÝ DO — bộ từ vựng chung của cả phân hệ.

   Chép movement type của SAP, cắt từ ~200 xuống 12. Thứ đáng chép không phải
   số lượng mà là: MÃ LÝ DO QUYẾT ĐỊNH BA THỨ — trường đối ứng nào bắt buộc,
   có phải duyệt không, lưới soạn phiếu hiện cột nào.

   Thay cho ba chỗ rời nhau hiện nay: `docs.kind` (4 giá trị) + `ref_type`
   (6 giá trị) + ô `reason` văn bản tự do. Không chỗ nào trong ba chỗ đó ràng
   buộc nổi "xuất huỷ thì bắt buộc có lý do".
   ══════════════════════════════════════════════════════════════════════════ */

export type Reason = {
  code: string
  name: string
  dir: 'in' | 'out' | 'move'
  /** Trường đối ứng BẮT BUỘC — lưới và đầu phiếu đọc đúng mảng này. */
  needs: string[]
  approve: boolean
}

export const REASONS: Reason[] = [
  { code: 'N1', name: 'Nhập mua theo đơn', dir: 'in', needs: ['Đơn mua'], approve: false }, // prettier-ignore
  { code: 'N2', name: 'Nhập mua ngoài đơn', dir: 'in', needs: ['Nhà cung cấp', 'Lý do'], approve: false }, // prettier-ignore
  { code: 'N3', name: 'Nhập lại vật tư thừa từ SX', dir: 'in', needs: ['Lệnh SX'], approve: false }, // prettier-ignore
  { code: 'N4', name: 'Nhập thừa sau kiểm kê', dir: 'in', needs: ['Đợt kiểm kê'], approve: true }, // prettier-ignore
  { code: 'X1', name: 'Cấp cho lệnh SX', dir: 'out', needs: ['Lệnh SX'], approve: false }, // prettier-ignore
  { code: 'X2', name: 'Xuất dùng chung / sửa chữa', dir: 'out', needs: ['Bộ phận nhận'], approve: false }, // prettier-ignore
  { code: 'X3', name: 'Trả hàng nhà cung cấp', dir: 'out', needs: ['Đơn mua', 'Lý do'], approve: false }, // prettier-ignore
  { code: 'X4', name: 'Xuất huỷ / phế liệu', dir: 'out', needs: ['Lý do'], approve: true }, // prettier-ignore
  { code: 'X5', name: 'Xuất thiếu sau kiểm kê', dir: 'out', needs: ['Đợt kiểm kê'], approve: true }, // prettier-ignore
  { code: 'C1', name: 'Chuyển vị trí', dir: 'move', needs: ['Kệ đi', 'Kệ đến'], approve: false }, // prettier-ignore
  { code: 'C2', name: 'Mở khoá sau kiểm hàng', dir: 'move', needs: [], approve: false }, // prettier-ignore
  { code: 'C3', name: 'Khoá hàng hỏng / sai quy cách', dir: 'move', needs: ['Lý do'], approve: true }, // prettier-ignore
]

export const reason = (code: string): Reason =>
  REASONS.find((r) => r.code === code) ?? REASONS[0]

/* ── Lô đang KHOÁ hoặc CHỜ KIỂM ──────────────────────────────────────────── */

export type Lot = {
  id: string
  code: string
  qty: number
  state: 'blocked' | 'qc'
  bin: string
  /** Lý do nguyên văn người khoá đã ghi — đi theo lô suốt đời nó. */
  why: string
  since: string
  days: number
  supplier: string
  po: string
  /** Ai phải ra quyết định. Lô không có người giữ là lô nằm chết. */
  holder: string
}

export const LOTS: Lot[] = [
  { id: 'lot1', code: 'NH-0482', qty: 200, state: 'blocked', bin: 'KHOA-01', why: 'Giao sai mã hợp kim — hồ sơ ghi 6063 T5, hàng về dập 6061', since: '12/09', days: 3, supplier: 'Vạn Vi Thành', po: 'PO-2609-044', holder: 'Cung ứng — Nguyễn Văn A' }, // prettier-ignore
  { id: 'lot2', code: 'GON0022', qty: 60, state: 'blocked', bin: 'KHOA-01', why: 'Ẩm mốc mép tấm, 60 trên 600 tấm — kho phát hiện lúc cất', since: '05/09', days: 10, supplier: 'Gòn Phương Nam', po: 'PO-2609-019', holder: 'Cung ứng — Nguyễn Văn A' }, // prettier-ignore
  { id: 'lot3', code: 'BUL0071', qty: 2400, state: 'qc', bin: 'TIEP-NHAN', why: 'Nhóm Bu lông có bật cờ cần kiểm — chờ KCS đo mẫu', since: '14/09', days: 1, supplier: 'Vạn Vi Thành', po: 'PO-2609-044', holder: 'KCS — Lê Minh' }, // prettier-ignore
]

/* ── Đợt kiểm kê ─────────────────────────────────────────────────────────── */

export type CountLine = {
  code: string
  bin: string
  /** Tồn sổ ĐÃ ĐÓNG BĂNG lúc mở đợt — không phải tồn hiện tại. */
  book: number
  counted: number | null
  note: string
}

export const COUNT_LINES: CountLine[] = [
  { code: 'NH-0480', bin: 'NHOM-A1', book: 380, counted: 380, note: '' },
  { code: 'NH-0482', bin: 'NHOM-A2', book: 150, counted: 142, note: 'Cong 8 cây, để riêng góc kệ' }, // prettier-ignore
  { code: 'NH-0485', bin: 'NHOM-A3', book: 520, counted: 520, note: '' },
  { code: 'MAY0448', bin: 'MAY-B1', book: 0, counted: 0, note: '' },
  { code: 'MAY0449', bin: 'MAY-B1', book: 260, counted: 274, note: 'Thừa 14 thanh, nghi nhầm với MAY0448 lần cấp 02/09' }, // prettier-ignore
  { code: 'CHI0005', bin: 'MAY-B3', book: 18, counted: null, note: '' },
  { code: 'LON0014', bin: 'PK-C2', book: 5100, counted: null, note: '' },
  { code: 'HAN0032', bin: 'HAN-F1', book: 24, counted: 24, note: '' },
]

/* ── Sổ phiếu ────────────────────────────────────────────────────────────── */

export type DocRow = {
  code: string
  date: string
  rc: string
  party: string
  lines: number
  by: string
  /** Phiếu này bị tờ nào đảo, hoặc nó đang đảo tờ nào. */
  reversedBy?: string
  reverses?: string
  pending?: boolean
}

export const DOCS: DocRow[] = [
  { code: 'PNK-2609-051', date: '15/09', rc: 'N1', party: 'Vạn Vi Thành', lines: 3, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PXK-2609-050', date: '15/09', rc: 'X1', party: 'LSX 07/26-09', lines: 2, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PCK-2609-049', date: '15/09', rc: 'C1', party: 'TIEP-NHAN sang NHOM-A1', lines: 1, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PNK-2609-048', date: '14/09', rc: 'N1', party: 'Vạn Vi Thành', lines: 5, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PCK-2609-047', date: '14/09', rc: 'C3', party: 'NH-0482 · 200 cây', lines: 1, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PXK-2609-046', date: '13/09', rc: 'X4', party: 'Gòn ẩm mốc 60 tấm', lines: 1, by: 'Trần Thị C', pending: true }, // prettier-ignore
  { code: 'PXK-2609-045', date: '12/09', rc: 'X1', party: 'LSX 07/26-14', lines: 8, by: 'Trần Thị C', reversedBy: 'PXK-2609-044' }, // prettier-ignore
  { code: 'PXK-2609-044', date: '12/09', rc: 'X1', party: 'LSX 07/26-14', lines: 8, by: 'Trần Thị C', reverses: 'PXK-2609-045' }, // prettier-ignore
  { code: 'PNK-2609-043', date: '11/09', rc: 'N3', party: 'LSX 07/26-09 trả thừa', lines: 2, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PXK-2609-042', date: '10/09', rc: 'X3', party: 'Sơn Tín Phát', lines: 1, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PXK-2609-041', date: '09/09', rc: 'X2', party: 'Tổ Bảo trì', lines: 3, by: 'Trần Thị C' }, // prettier-ignore
  { code: 'PNK-2609-040', date: '09/09', rc: 'N2', party: 'Mua lẻ — Chợ Kim Biên', lines: 2, by: 'Trần Thị C' }, // prettier-ignore
]

/* ── Kệ ──────────────────────────────────────────────────────────────────── */

export type Bin = {
  code: string
  name: string
  kind: 'store' | 'receiving' | 'blocked' | 'scrap'
  mats: number
  lastCount: string | null
}

/**
 * MƯỜI HAI KHU THÔ, không đánh tới từng ô.
 *
 * Xưởng chưa đánh mã kệ ngoài thực địa, nên bắt đầu bằng KHU là mức rẻ nhất
 * mà vẫn trả lời được câu "hàng để đâu": sơn một tấm biển mỗi khu là xong,
 * không phải kẻ vạch từng ô. Chia nhỏ thêm về sau chỉ là thêm dòng vào bảng
 * này — còn đánh mã chi tiết ngay từ đầu thì phải dán tem cả nhà kho trước
 * khi dùng được một ngày nào.
 *
 * Bốn LOẠI kệ, trong đó ba loại là KỆ ẢO: tiếp nhận (chưa cất), khoá (chưa
 * được dùng), phế (chờ thanh lý). Đây là cách chép "địa điểm ảo" của Odoo mà
 * không phải dựng cả cây địa điểm — và là lý do "chờ cất" không cần một cờ
 * trạng thái nào để nuôi.
 */
export const BINS_ALL: Bin[] = [
  { code: 'TIEP-NHAN', name: 'Khu tiếp nhận — hàng vừa về, chưa cất', kind: 'receiving', mats: 1, lastCount: null }, // prettier-ignore
  { code: 'KHOA-01', name: 'Kệ hàng khoá — chờ trả hoặc huỷ', kind: 'blocked', mats: 2, lastCount: null }, // prettier-ignore
  {
    code: 'NHOM-A1',
    name: 'Nhôm hộp',
    kind: 'store',
    mats: 1,
    lastCount: '15/09',
  },
  { code: 'NHOM-A2', name: 'Nhôm hộp khổ lớn', kind: 'store', mats: 1, lastCount: '15/09' }, // prettier-ignore
  { code: 'NHOM-A3', name: 'Nhôm có rãnh vải', kind: 'store', mats: 1, lastCount: '15/09' }, // prettier-ignore
  {
    code: 'MAY-B1',
    name: 'Dây mây, dây dù',
    kind: 'store',
    mats: 2,
    lastCount: '15/09',
  },
  {
    code: 'MAY-B3',
    name: 'Chỉ may, phụ liệu',
    kind: 'store',
    mats: 1,
    lastCount: null,
  },
  { code: 'PK-C2', name: 'Bu lông, long đền, ốc vít', kind: 'store', mats: 1, lastCount: '02/08' }, // prettier-ignore
  {
    code: 'NEM-D1',
    name: 'Gòn, mút, nệm',
    kind: 'store',
    mats: 1,
    lastCount: '02/08',
  },
  {
    code: 'BB-E1',
    name: 'Bao bì, tem nhãn',
    kind: 'store',
    mats: 1,
    lastCount: null,
  },
  {
    code: 'HAN-F1',
    name: 'Vật tư hàn, cắt',
    kind: 'store',
    mats: 1,
    lastCount: null,
  },
  { code: 'PHE-Z', name: 'Khu phế liệu — chờ thanh lý', kind: 'scrap', mats: 0, lastCount: null }, // prettier-ignore
]
