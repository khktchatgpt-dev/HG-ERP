/**
 * BỘ ĐỌC FILE BÁO GIÁ (.xlsx) — lớp logic THUẦN: nhận lưới ô đã đọc sẵn + vị trí
 * ảnh, trả về danh sách sản phẩm để dựng báo giá. Không đụng exceljs, không đụng
 * DB — nhờ vậy test được từng luật mà không cần file thật.
 *
 * Mẫu do `scripts/make-quote-template.mjs` sinh ra (docs/mau/MAU_BAO_GIA_SP_MOI.xlsx):
 * MỘT DÒNG = MỘT SẢN PHẨM. Nhưng bộ đọc KHÔNG bám vị trí cột cứng — nó dò theo
 * chữ ở dòng tiêu đề, để file Sale tự thêm/bớt cột vẫn đọc được.
 *
 * Quy ước kích thước lấy từ bảng kê quy cách của công ty:
 *   "KTTT: 548 x 565 x 876   (L/D x W x H) mm"
 * ⇒ Dài(sâu) × Rộng × Cao, đơn vị **mm**. Ô nào ghi cm (số nhỏ bất thường) thì
 * đánh dấu ngờ vực chứ KHÔNG tự nhân 10 — đoán sai đơn vị là sai gấp 10 lần.
 */

export type QuoteExcelField =
  | 'code'
  | 'customer_item_code'
  | 'name'
  | 'description_en'
  | 'image'
  | 'length_mm'
  | 'width_mm'
  | 'height_mm'
  | 'material'
  | 'colour'
  | 'qty_per_carton'
  | 'carton_l_cm'
  | 'carton_w_cm'
  | 'carton_h_cm'
  | 'nw_kg'
  | 'gw_kg'
  | 'loading_40hc'
  | 'unit'
  | 'unit_price'
  | 'note'

/** Một dòng đọc được, CHƯA khớp với thư viện SP (việc khớp do service làm). */
export type QuoteExcelRow = {
  /** Số dòng trong file — để báo lỗi cho người dùng lần ra đúng chỗ. */
  row: number
  code: string | null
  customer_item_code: string | null
  name: string | null
  description_en: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  material: string | null
  colour: string | null
  qty_per_carton: number | null
  carton_l_cm: number | null
  carton_w_cm: number | null
  carton_h_cm: number | null
  nw_kg: number | null
  gw_kg: number | null
  loading_40hc: number | null
  unit: string | null
  unit_price: number | null
  note: string | null
  /** Có ảnh nhúng neo vào dòng này không (id do lớp đọc file cấp). */
  image_id: string | null
  /** Thiếu thứ bắt buộc — vẫn trả về để hiện ở màn xem trước, nhưng chặn lưu. */
  missing: string[]
  /** Ngờ vực nhưng không chặn (vd kích thước nhỏ bất thường → có thể đang là cm). */
  warnings: string[]
}

export type QuoteExcelResult = {
  rows: QuoteExcelRow[]
  skipped: { row: number; text: string; reason: string }[]
  /** Cột nào nhận ra được — hiện lại cho người dùng kiểm, không tin mù. */
  mapped: { index: number; field: QuoteExcelField }[]
  headerRow: number | null
}

const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

const txt = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s || null
}

/**
 * Số trong ô Excel. Chấp nhận cả "1.234,56" (VN) lẫn "1,234.56" (Anh–Mỹ): dấu
 * NẰM SAU CÙNG là dấu thập phân. Ô đã là number thì lấy thẳng.
 */
export function parseNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const raw = txt(v)
  if (!raw) return null
  const s = raw.replace(/[^\d.,-]/g, '')
  if (!s || s === '-') return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let norm = s
  if (lastComma >= 0 && lastDot >= 0) {
    norm =
      lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    norm = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  }
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/**
 * Nhận cột theo CHỮ ở tiêu đề. Luật hẹp đứng trước luật rộng: "carton dài" phải
 * chặn trước "dài", nếu không mọi cột carton sẽ bị nuốt vào kích thước SP.
 */
const HEADER_RULES: [RegExp, QuoteExcelField][] = [
  [/ma sp|ma hg|ma noi bo/, 'code'],
  [/ma khach|item ?code|ma kh\b/, 'customer_item_code'],
  [/description|mo ta|ten (en|tieng anh)/, 'description_en'],
  [/ten sp|ten san pham|ten hang|^ten\b/, 'name'],
  [/anh|hinh|photo|picture/, 'image'],
  // Carton trước, luôn luôn.
  [/carton.*dai|carton.*l\b|kt ?bb.*dai/, 'carton_l_cm'],
  [/carton.*rong|carton.*w\b/, 'carton_w_cm'],
  [/carton.*cao|carton.*h\b/, 'carton_h_cm'],
  [/sl ?\/ ?thung|so luong ?\/ ?thung|qty ?\/ ?ctn|pcs ?\/ ?ctn/, 'qty_per_carton'],
  [/loading|40 ?hc|cai ?\/ ?40/, 'loading_40hc'],
  [/\bn\.?w\b|net weight|khoi luong tinh/, 'nw_kg'],
  [/\bg\.?w\b|gross weight|khoi luong ca bi/, 'gw_kg'],
  // Kích thước SP.
  [/dai|sau|\bd\b|\bl\b(?!oading)/, 'length_mm'],
  [/rong|\bw\b/, 'width_mm'],
  [/cao|\bh\b/, 'height_mm'],
  [/chat lieu|material|nguyen lieu|n\.?lieu/, 'material'],
  [/mau|colour|color/, 'colour'],
  [/dvt|don vi tinh/, 'unit'],
  [/don gia|gia|price|fob/, 'unit_price'],
  [/ghi chu|note|remark/, 'note'],
]

function fieldOf(cell: unknown): QuoteExcelField | null {
  const s = noAccent(txt(cell) ?? '')
    .replace(/\*/g, '')
    .trim()
  if (!s) return null
  for (const [re, f] of HEADER_RULES) if (re.test(s)) return f
  return null
}

/**
 * Dòng tiêu đề = dòng nhận ra ≥4 cột và có cả `name` lẫn một trong ba kích thước.
 * Đòi hỏi này chặn nhầm dòng tiêu đề phụ ("Quy Cách Tinh (mm)") của bảng kê.
 */
function readHeader(cells: unknown[]): Map<number, QuoteExcelField> | null {
  const hits = new Map<number, QuoteExcelField>()
  cells.forEach((c, i) => {
    const f = fieldOf(c)
    // Cột trùng luật thì cột ĐẦU thắng — mẫu xếp trái sang phải theo thứ tự đọc.
    if (f && ![...hits.values()].includes(f)) hits.set(i, f)
  })
  const fields = [...hits.values()]
  const hasDim =
    fields.includes('length_mm') ||
    fields.includes('width_mm') ||
    fields.includes('height_mm')
  return hits.size >= 4 && fields.includes('name') && hasDim ? hits : null
}

/** Dòng rác: trống, dòng tổng, hoặc dòng ghi chú lạc. */
function noiseReason(cells: unknown[]): string | null {
  const joined = noAccent(cells.map((c) => txt(c) ?? '').join(' ')).trim()
  if (!joined) return 'dòng trống'
  if (/^tong cong|^tong\b|^total\b/.test(joined)) return 'dòng tổng cộng'
  return null
}

/**
 * Kích thước SP nhỏ bất thường → nhiều khả năng đang điền cm thay vì mm.
 *
 * Ngưỡng 300: ghế 548×565×876 mm điền nhầm sang cm thành 54,8×56,5×87,6 — cả ba
 * đều dưới 300. Còn hàng thật mà cả ba chiều đều dưới 30cm thì gần như không có
 * trong ngành bàn ghế ngoài trời. Ngưỡng 50 (bản đầu) quá chặt: 87,6 đã vượt nên
 * đúng ca cần bắt lại lọt.
 */
const SUSPECT_MM_BELOW = 300

export function parseQuoteExcel(
  grid: unknown[][],
  imagesByRow: Map<number, string> = new Map(),
): QuoteExcelResult {
  const skipped: QuoteExcelResult['skipped'] = []
  let map: Map<number, QuoteExcelField> | null = null
  let headerIdx = -1

  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const h = readHeader(grid[i] ?? [])
    if (h) {
      map = h
      headerIdx = i
      break
    }
  }
  if (!map) return { rows: [], skipped, mapped: [], headerRow: null }

  const rows: QuoteExcelRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const cells = grid[i] ?? []
    const rowNo = i + 1
    const noise = noiseReason(cells)
    if (noise) {
      if (noise !== 'dòng trống')
        skipped.push({ row: rowNo, text: cells.join(' | ').slice(0, 80), reason: noise })
      continue
    }

    const get = (f: QuoteExcelField) => {
      for (const [idx, field] of map!) if (field === f) return cells[idx]
      return undefined
    }

    const r: QuoteExcelRow = {
      row: rowNo,
      code: txt(get('code')),
      customer_item_code: txt(get('customer_item_code')),
      name: txt(get('name')),
      description_en: txt(get('description_en')),
      length_mm: parseNum(get('length_mm')),
      width_mm: parseNum(get('width_mm')),
      height_mm: parseNum(get('height_mm')),
      material: txt(get('material')),
      colour: txt(get('colour')),
      qty_per_carton: parseNum(get('qty_per_carton')),
      carton_l_cm: parseNum(get('carton_l_cm')),
      carton_w_cm: parseNum(get('carton_w_cm')),
      carton_h_cm: parseNum(get('carton_h_cm')),
      nw_kg: parseNum(get('nw_kg')),
      gw_kg: parseNum(get('gw_kg')),
      loading_40hc: parseNum(get('loading_40hc')),
      unit: txt(get('unit')),
      unit_price: parseNum(get('unit_price')),
      note: txt(get('note')),
      image_id: imagesByRow.get(rowNo) ?? null,
      missing: [],
      warnings: [],
    }

    if (!r.name) r.missing.push('tên sản phẩm')
    if (r.unit_price == null) r.missing.push('đơn giá')
    const dims = [r.length_mm, r.width_mm, r.height_mm]
    if (dims.some((d) => d == null)) r.missing.push('kích thước (D×R×C mm)')

    // Ngờ vực đơn vị: 3 số đều nhỏ thì gần như chắc đang là cm. Không tự nhân 10.
    if (dims.every((d) => d != null && d > 0 && d < SUSPECT_MM_BELOW))
      r.warnings.push('kích thước nhỏ bất thường — có phải đang điền cm thay vì mm?')

    // Dòng rỗng ruột (chỉ có mỗi ghi chú) thì bỏ hẳn, đừng bắt người dùng đọc lỗi.
    if (!r.name && !r.code && !r.customer_item_code && r.unit_price == null) {
      skipped.push({
        row: rowNo,
        text: cells.join(' | ').slice(0, 80),
        reason: 'không có tên / mã sản phẩm',
      })
      continue
    }
    rows.push(r)
  }

  return {
    rows,
    skipped,
    mapped: [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, field]) => ({ index, field })),
    headerRow: headerIdx + 1,
  }
}
