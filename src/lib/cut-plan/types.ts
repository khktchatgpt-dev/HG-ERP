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
  /**
   * Quy cách vật liệu ("Nhôm hộp 20×40×1,2"). Mỗi quy cách là một bài toán cắt
   * riêng với cây tiêu chuẩn riêng; để trống = nhóm "chưa ghi quy cách".
   */
  spec: string
  note: string
}

/** Thứ tự cột của lưới — cũng là thứ tự Ctrl+V chạy sang phải. */
export const CUT_LINE_COLUMNS = ['part_name', 'length_mm', 'qty', 'spec', 'note'] as const
export type CutLineColumn = (typeof CUT_LINE_COLUMNS)[number]

export const CUT_LINE_LABEL: Record<CutLineColumn, string> = {
  part_name: 'Tên chi tiết',
  length_mm: 'Dài cắt (mm)',
  qty: 'SL (cái)',
  spec: 'Quy cách',
  note: 'Ghi chú',
}

export function blankLine(key: number): CutLine {
  return { key, part_name: '', length_mm: '', qty: '', spec: '', note: '' }
}

/** Dòng hoàn toàn trống (kể cả ghi chú) — lưới bỏ khi ghép thêm dòng dán. */
export const isBlankLine = (l: CutLine) =>
  !l.part_name && l.length_mm === '' && l.qty === '' && !l.spec && !l.note

/**
 * Khoá nhóm của một quy cách: gọn khoảng trắng, không phân biệt hoa thường —
 * "Nhôm hộp 20×40" và "nhôm  hộp 20×40" là một loại cây. Nhãn hiển thị lấy
 * theo chuỗi gặp đầu tiên.
 */
export const specKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** Nhãn cho nhóm không ghi quy cách. */
export const NO_SPEC_LABEL = 'Chưa ghi quy cách'

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

/** Kết quả của MỘT quy cách — một bài toán cắt trên một loại cây. */
export type CutGroupPlan = {
  /** Khoá nhóm (`specKey`). '' = chưa ghi quy cách. */
  key: string
  /** Nhãn hiển thị (chuỗi người dùng gõ, gặp đầu tiên). */
  spec: string
  stock_length_mm: number
  /** Số dòng của lưới rơi vào nhóm. */
  lines: number
  result: CutGroupResult
}

export type CutPlanResult = {
  /** Theo thứ tự quy cách xuất hiện trong lưới. */
  groups: CutGroupPlan[]
  /** Dòng bị bỏ khỏi tính toán (thiếu dài / SL) — bày cho người nhập. */
  skipped: { key: number; reason: string }[]
}

/** Tổng cả đợt qua mọi quy cách — dải KPI đầu trang và dòng tổng Excel. */
export type CutPlanTotals = {
  groups: number
  bars: number
  pieces_total: number
  material_mm: number
  scrap_mm: number
  waste_pct: number
  errors: number
}

export function planTotals(plan: Pick<CutPlanResult, 'groups'>): CutPlanTotals {
  let bars = 0
  let pieces = 0
  let material = 0
  let scrap = 0
  let errors = 0
  for (const g of plan.groups) {
    bars += g.result.bars
    pieces += g.result.pieces_total
    material += g.result.material_mm
    scrap += g.result.scrap_mm
    errors += g.result.errors.length
  }
  return {
    groups: plan.groups.length,
    bars,
    pieces_total: pieces,
    material_mm: material,
    scrap_mm: Math.round(scrap * 10) / 10,
    waste_pct: material > 0 ? Math.round((scrap / material) * 1000) / 10 : 0,
    errors,
  }
}

/**
 * Toàn bộ một đợt cắt — thứ được tự lưu localStorage và gửi lên server để xuất
 * Excel. Đầu phiếu theo bản gốc: Project → tên đợt, Item → mã hàng. Cây tiêu
 * chuẩn có một giá trị mặc định và bảng riêng theo quy cách (`stock_by_spec`,
 * khoá `specKey`): nhôm hộp thường 6000, thép có loại 12000, la 2440…
 */
export type CutPlanDoc = {
  title: string
  item: string
  stock_length_mm: number
  stock_by_spec: Record<string, number>
  lines: CutLine[]
}

/** Cây tiêu chuẩn áp cho một nhóm: riêng theo quy cách, không có thì mặc định. */
export function stockFor(
  doc: Pick<CutPlanDoc, 'stock_length_mm' | 'stock_by_spec'>,
  key: string,
) {
  const v = doc.stock_by_spec[key]
  return typeof v === 'number' && v > 0 ? v : doc.stock_length_mm
}
