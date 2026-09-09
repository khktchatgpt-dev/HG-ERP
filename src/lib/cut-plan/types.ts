/**
 * QUY CẮT PHÔI — kiểu dữ liệu dùng chung cho màn nhập, thuật toán và file Excel.
 * Thuần TypeScript, không phụ thuộc React hay DB.
 *
 * Bài toán: xưởng cắt phôi nhận một danh sách chi tiết (tên · dài cắt · số
 * lượng) của MỘT quy cách vật liệu và phải cắt từ cây tiêu chuẩn sao cho ít cây
 * nhất, ít hao hụt nhất — đúng phạm vi phần mềm Steel Cutting cũ của xưởng,
 * chỉ bỏ giới hạn 10 dòng.
 */

/** Tham số của thuật toán (nội bộ). Màn hình chỉ cho sửa chiều dài cây. */
export type CutParams = {
  stock_length_mm: number
  kerf_mm: number
  trim_start_mm: number
  trim_end_mm: number
  min_remnant_mm: number
}

export const DEFAULT_STOCK_LENGTH_MM = 6000

export const DEFAULT_CUT_PARAMS: CutParams = {
  stock_length_mm: DEFAULT_STOCK_LENGTH_MM,
  kerf_mm: 0,
  trim_start_mm: 0,
  trim_end_mm: 0,
  min_remnant_mm: 0,
}

/** Một dòng chi tiết cần cắt — đúng các cột của lưới nhập. */
export type CutLine = {
  /** Khoá dòng ở phía client (số tăng dần) — id của "item" trong kết quả. */
  key: number
  part_name: string
  /** Chiều dài phôi cần cắt (mm). '' = chưa nhập. */
  length_mm: number | ''
  /** Số lượng chi tiết. '' = chưa nhập. */
  qty: number | ''
  note: string
}

export const CUT_LINE_COLUMNS = ['part_name', 'length_mm', 'qty', 'note'] as const
export type CutLineColumn = (typeof CUT_LINE_COLUMNS)[number]

export const CUT_LINE_LABEL: Record<CutLineColumn, string> = {
  part_name: 'Tên chi tiết',
  length_mm: 'Dài cắt (mm)',
  qty: 'SL (cái)',
  note: 'Ghi chú',
}

export function blankLine(key: number): CutLine {
  return { key, part_name: '', length_mm: '', qty: '', note: '' }
}

/** Dòng hoàn toàn trống (kể cả ghi chú) — lưới bỏ khi ghép thêm dòng dán. */
export const isBlankLine = (l: CutLine) =>
  !l.part_name && l.length_mm === '' && l.qty === '' && !l.note

/**
 * Dòng CÓ SỐ LIỆU cắt (tên / dài / SL). Ghi chú suông không phải một chi tiết:
 * đầu trang, hộp "Xoá tất cả" và sheet Excel cùng đếm theo hàm này để một dòng
 * không bị nơi đếm, nơi bỏ.
 */
export const lineHasData = (l: CutLine) =>
  Boolean(l.part_name) || l.length_mm !== '' || l.qty !== ''

/** Đầu vào của thuật toán: một chi tiết = một chiều dài × số lượng. */
export type CutItem = {
  id: number
  length_mm: number
  qty: number
}

export type CutPatternPiece = { id: number; count: number }

/** Một SƠ ĐỒ CẮT trên một cây — lặp lại `bars` lần. */
export type CutPattern = {
  /** Chi tiết trên cây, xếp dài → ngắn (thợ cắt khúc dài trước). */
  pieces: CutPatternPiece[]
  /** Tổng chiều dài chi tiết trên cây (mm), chưa tính mạch cắt. */
  used_mm: number
  /** Tổng mạch cắt tiêu tốn trên cây = (số khúc − 1) × kerf. */
  kerf_mm: number
  /** Đoạn còn lại sau khi cắt hết (mm) = usable − used − kerf. */
  remnant_mm: number
  /** Đoạn còn lại đủ dài để giữ làm phôi (≥ min_remnant). */
  reusable: boolean
  /** Số cây cắt theo sơ đồ này. */
  bars: number
}

export type CutGroupResult = {
  stock_length_mm: number
  /** Phần cây dùng được sau khi cắt bỏ đầu/cuối. */
  usable_mm: number
  bars: number
  patterns: CutPattern[]
  /** Tổng số chi tiết đã bố trí. */
  pieces_total: number
  /** Tổng chiều dài cây mua vào = bars × stock. */
  material_mm: number
  /** Tổng chiều dài chi tiết thành phẩm. */
  used_mm: number
  /** Tổng đoạn dư tái dùng (các đoạn ≥ min_remnant). */
  reusable_mm: number
  /** Phế = material − used − reusable. */
  scrap_mm: number
  /** Hao hụt % = scrap / material. */
  waste_pct: number
  /** Đối chiếu từng chi tiết: cần bao nhiêu, đã bố trí bao nhiêu. */
  items: { id: number; required: number; planned: number }[]
  /** Lỗi khiến chi tiết không bố trí được — nói ra, không nuốt. */
  errors: string[]
}

export type CutPlanResult = {
  result: CutGroupResult
  /** Dòng bị bỏ khỏi tính toán (thiếu dài / SL) — bày cho người nhập. */
  skipped: { key: number; reason: string }[]
}

/**
 * Toàn bộ một đợt cắt — thứ được tự lưu localStorage và gửi lên server để xuất
 * Excel. Đầu phiếu theo đúng bản gốc: Project → tên đợt, Item → mã hàng, cộng
 * thêm quy cách vật liệu để phiếu nói rõ cắt loại cây nào.
 */
export type CutPlanDoc = {
  title: string
  item: string
  spec: string
  stock_length_mm: number
  lines: CutLine[]
}
