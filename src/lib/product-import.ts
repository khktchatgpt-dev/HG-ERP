import {
  FRAME_MATERIALS,
  MAX_SERIAL,
  PRODUCT_TYPES,
  buildProductCode,
  parseProductCode,
} from './product-code'
import { normalizeCustomerLabel } from './customer-label'

/**
 * THÊM + CẬP NHẬT SẢN PHẨM BẰNG EXCEL (07/10/2026) — luật thuần, không chạm DB.
 *
 * Kỹ thuật: "làm cho anh cái form nhập y, bằng excel, để anh lưu bên anh chỉnh
 * sửa rồi export ra nhập vô cho lẹ" → vòng 2: "thêm sản phẩm cũng như cập nhật
 * lại, đầy đủ thông tin của một sản phẩm, cũng như ảnh". Bản vẽ vòng 2 duyệt theo
 * đề xuất; đây là B1 (đủ thông tin, chưa ảnh):
 *  · Dòng CÓ mã đang có → cập nhật; dòng KHÔNG mã → thêm mới, tự cấp mã.
 *  · Ô TRỐNG = giữ nguyên; gõ "-" = xoá trắng (Q1). Ngược lại thì lỡ xoá một cột
 *    trong Excel là xoá trắng cả trăm SP.
 *  · Còn dòng LỖI → chặn cả file (vòng 1, Q1) — tải lại sau không thêm trùng.
 *  · Đổi Loại / Vật liệu SP đã có: cho đổi, cảnh báo "mã không đổi theo" (Q4).
 *  · SP bị sửa trên web sau khi xuất file: cảnh báo, vẫn cho ghi (Q5).
 *  · Đủ ô trang chi tiết; KHÔNG có giá thành KH (bí mật Bán hàng), người phụ
 *    trách, trạng thái BOM, số tính từ định mức (app tự tính).
 *
 * Cột được nhận theo TIÊU ĐỀ chứ không theo vị trí: người dùng xoá bớt cột không
 * cần (cột vắng = không đụng), và B2 chèn cột Ảnh không làm hỏng file xuất ở B1.
 *
 * Một hàm `planImport` cho cả màn soi lẫn lúc ghi: server tính lại từ file ngay
 * lúc ghi, không nhận kết quả soi từ client.
 */

export const IMPORT_SHEET = 'Sản phẩm'
export const GROUP_ROW = 1
export const HEADER_ROW = 2
export const NOTE_ROW = 3
export const IMPORT_FIRST_ROW = 4
export const IMPORT_MAX_ROWS = 1000
export const DEFAULT_UNIT = 'cái'
/** Gõ ô này để XOÁ TRẮNG giá trị đang có. */
export const CLEAR_MARK = '-'

type Option = { code: string; label: string }
/** "TB — Bàn" — đúng chữ của ô thả xuống trong file. */
export const optionText = (o: Option) => `${o.code} — ${o.label}`

export const ASSEMBLY_OPTIONS = [
  { code: 'assembled', label: 'Nguyên chiếc' },
  { code: 'kd', label: 'Tháo rời (KD)' },
] as const

type Kind =
  | 'code'
  | 'type'
  | 'material'
  | 'text'
  | 'customer'
  | 'unit'
  | 'num'
  | 'pos'
  | 'int'
  | 'bool'
  | 'assembly'
  | 'version'

/** Ô ghi vào đâu: cột thường, hay khoá trong jsonb `packing` / `tech_spec`. */
export type Target = { col: string } | { json: 'packing' | 'tech_spec'; key: string }

export type ColumnSpec = {
  key: string
  header: string
  group: string
  kind: Kind
  target?: Target
  required?: boolean
  max?: number
  note?: string
  width: number
}

const G_ID = 'Nhận diện'
const G_DIM = 'Kích thước & khối lượng'
const G_PACK = 'Đóng gói xuất khẩu'
const G_FEAT = 'Đặc tính sản phẩm'
const G_MAT = 'Vật liệu & màu'
const G_PROD = 'Thông số sản xuất'
const G_TEXT = 'Mô tả & ghi chú'

const col = (c: string): Target => ({ col: c })
const pack = (k: string): Target => ({ json: 'packing', key: k })
const spec = (k: string): Target => ({ json: 'tech_spec', key: k })

/**
 * CỘT CỦA FILE — đúng nhãn + nhóm của trang chi tiết (`product-sections.ts`).
 * Ràng buộc trùng `productCreateSchema` / `packingSchema` / `techSpecSchema` để
 * lỗi lộ ở màn soi chứ không phải lúc ghi.
 */
export const IMPORT_COLUMNS: ColumnSpec[] = [
  { key: 'code', header: 'Mã nội bộ', group: G_ID, kind: 'code', max: 100, width: 15, note: 'Trống = SP mới, tự cấp mã' }, // prettier-ignore
  { key: 'name', header: 'Tên SP (tiếng Việt)', group: G_ID, kind: 'text', target: col('name'), required: true, max: 200, width: 36 }, // prettier-ignore
  { key: 'type', header: 'Loại sản phẩm', group: G_ID, kind: 'type', target: col('product_type'), required: true, width: 22, note: 'Danh sách' }, // prettier-ignore
  { key: 'material', header: 'Vật liệu khung', group: G_ID, kind: 'material', target: col('frame_material'), required: true, width: 18, note: 'Danh sách' }, // prettier-ignore
  { key: 'name_foreign', header: 'Tên theo khách (in LSX)', group: G_ID, kind: 'text', target: col('name_foreign'), max: 300, width: 30 }, // prettier-ignore
  { key: 'customer', header: 'Khách hàng / nhóm', group: G_ID, kind: 'customer', target: col('customer_name'), max: 200, width: 18 }, // prettier-ignore
  { key: 'customer_item_code', header: 'Mã KH đặt', group: G_ID, kind: 'text', target: col('customer_item_code'), max: 100, width: 14 }, // prettier-ignore
  { key: 'code_legacy', header: 'Mã cũ', group: G_ID, kind: 'text', target: col('code_legacy'), max: 100, width: 14 }, // prettier-ignore
  { key: 'unit', header: 'ĐVT bán', group: G_ID, kind: 'unit', target: col('unit'), max: 30, width: 8 }, // prettier-ignore
  { key: 'barcode', header: 'Barcode', group: G_ID, kind: 'text', target: col('barcode'), max: 50, width: 16 }, // prettier-ignore
  { key: 'reference_price', header: 'Giá tham khảo', group: G_ID, kind: 'num', target: col('reference_price'), width: 12 }, // prettier-ignore

  { key: 'length_mm', header: 'Dài SP (mm)', group: G_DIM, kind: 'num', target: col('length_mm'), width: 10 }, // prettier-ignore
  { key: 'width_mm', header: 'Rộng SP (mm)', group: G_DIM, kind: 'num', target: col('width_mm'), width: 10 }, // prettier-ignore
  { key: 'height_mm', header: 'Cao SP (mm)', group: G_DIM, kind: 'num', target: col('height_mm'), width: 10 }, // prettier-ignore
  { key: 'length_open_mm', header: 'Dài khi mở (mm)', group: G_DIM, kind: 'num', target: col('length_open_mm'), width: 11 }, // prettier-ignore
  { key: 'width_open_mm', header: 'Rộng khi mở (mm)', group: G_DIM, kind: 'num', target: col('width_open_mm'), width: 11 }, // prettier-ignore
  { key: 'height_open_mm', header: 'Cao khi mở (mm)', group: G_DIM, kind: 'num', target: col('height_open_mm'), width: 11 }, // prettier-ignore
  { key: 'thickness_mm', header: 'Độ dày (mm)', group: G_DIM, kind: 'num', target: col('thickness_mm'), width: 10 }, // prettier-ignore
  { key: 'net_weight_kg', header: 'Khối lượng tịnh (kg)', group: G_DIM, kind: 'num', target: col('net_weight_kg'), width: 12 }, // prettier-ignore
  { key: 'actual_weight_kg', header: 'KL cân thực tế (kg)', group: G_DIM, kind: 'num', target: col('actual_weight_kg'), width: 12 }, // prettier-ignore

  { key: 'qty_per_carton', header: 'SP / thùng', group: G_PACK, kind: 'int', target: pack('qty_per_carton'), width: 9 }, // prettier-ignore
  { key: 'carton_l_cm', header: 'Carton dài (cm)', group: G_PACK, kind: 'pos', target: pack('carton_l_cm'), width: 11 }, // prettier-ignore
  { key: 'carton_w_cm', header: 'Carton rộng (cm)', group: G_PACK, kind: 'pos', target: pack('carton_w_cm'), width: 11 }, // prettier-ignore
  { key: 'carton_h_cm', header: 'Carton cao (cm)', group: G_PACK, kind: 'pos', target: pack('carton_h_cm'), width: 11 }, // prettier-ignore
  { key: 'loading_40hc', header: 'Xếp cont 40HC (thùng)', group: G_PACK, kind: 'int', target: pack('loading_40hc'), width: 12 }, // prettier-ignore
  { key: 'nw_kg', header: 'NW / thùng (kg)', group: G_PACK, kind: 'pos', target: pack('nw_kg'), width: 11 }, // prettier-ignore
  { key: 'gw_kg', header: 'GW / thùng (kg)', group: G_PACK, kind: 'pos', target: pack('gw_kg'), width: 11 }, // prettier-ignore
  { key: 'pack_unit_label', header: 'Đơn vị đóng gói', group: G_PACK, kind: 'text', target: pack('pack_unit_label'), max: 30, width: 11, note: 'ctn / pallet' }, // prettier-ignore

  { key: 'max_load_kg', header: 'Tải trọng tối đa (kg)', group: G_FEAT, kind: 'num', target: col('max_load_kg'), width: 12 }, // prettier-ignore
  { key: 'assembly', header: 'Lắp ráp', group: G_FEAT, kind: 'assembly', target: col('assembly'), width: 14, note: 'Danh sách' }, // prettier-ignore
  { key: 'set_contents', header: 'Bộ gồm', group: G_FEAT, kind: 'text', target: col('set_contents'), max: 500, width: 24 }, // prettier-ignore
  { key: 'is_set', header: 'Là bộ nhiều món', group: G_FEAT, kind: 'bool', target: col('is_set'), width: 10, note: 'có / không' }, // prettier-ignore

  { key: 'material_main', header: 'Chất liệu chính', group: G_MAT, kind: 'text', target: col('material'), max: 300, width: 20 }, // prettier-ignore
  { key: 'wood', header: 'Loại gỗ', group: G_MAT, kind: 'text', target: spec('wood'), max: 200, width: 16 }, // prettier-ignore
  { key: 'paint', header: 'Sơn (mã màu)', group: G_MAT, kind: 'text', target: spec('paint'), max: 200, width: 16 }, // prettier-ignore
  { key: 'fabric', header: 'Vải', group: G_MAT, kind: 'text', target: spec('fabric'), max: 200, width: 14 }, // prettier-ignore
  { key: 'glass', header: 'Kính', group: G_MAT, kind: 'text', target: spec('glass'), max: 200, width: 14 }, // prettier-ignore
  { key: 'cushion', header: 'Nệm / mút', group: G_MAT, kind: 'text', target: spec('cushion'), max: 200, width: 14 }, // prettier-ignore
  { key: 'hardware', header: 'Phụ kiện (ngũ kim)', group: G_MAT, kind: 'text', target: spec('hardware'), max: 200, width: 16 }, // prettier-ignore
  { key: 'finish', header: 'Màu hoàn thiện (finish)', group: G_MAT, kind: 'text', target: spec('finish'), max: 200, width: 16 }, // prettier-ignore
  { key: 'is_upholstered', header: 'Có nệm / bọc', group: G_MAT, kind: 'bool', target: col('is_upholstered'), width: 10, note: 'có / không' }, // prettier-ignore
  { key: 'has_glass', header: 'Có kính', group: G_MAT, kind: 'bool', target: col('has_glass'), width: 9, note: 'có / không' }, // prettier-ignore

  { key: 'machine', header: 'Máy', group: G_PROD, kind: 'text', target: spec('machine'), max: 200, width: 14 }, // prettier-ignore
  { key: 'showroom_sample', header: 'Có mẫu tại showroom', group: G_PROD, kind: 'bool', target: col('showroom_sample'), width: 11, note: 'có / không' }, // prettier-ignore

  { key: 'description_en', header: 'Mô tả tiếng Anh (in báo giá)', group: G_TEXT, kind: 'text', target: col('description_en'), max: 2000, width: 36 }, // prettier-ignore
  { key: 'shipping_mark', header: 'Nội dung shipping mark', group: G_TEXT, kind: 'text', target: col('shipping_mark'), max: 2000, width: 30 }, // prettier-ignore
  { key: 'notes', header: 'Ghi chú nội bộ', group: G_TEXT, kind: 'text', target: col('notes'), max: 2000, width: 30 }, // prettier-ignore

  {
    key: 'version',
    header: 'Phiên bản (đừng sửa)',
    group: '',
    kind: 'version',
    width: 20,
  },
]

export const COLUMN_BY_KEY = new Map(IMPORT_COLUMNS.map((c) => [c.key, c]))

/** Bỏ dấu, thường hoá, gộp khoảng trắng — để "ban", "Bàn", "BÀN" là một. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tiêu đề cột trong file → cột. Nhận cả khi người dùng bỏ dấu / đổi hoa thường / thêm dấu *. */
export function columnForHeader(header: string): ColumnSpec | null {
  const h = fold(header).replace(/\s*\*$/, '')
  if (!h) return null
  return IMPORT_COLUMNS.find((c) => fold(c.header) === h) ?? null
}

/**
 * Chữ trong ô Loại / Vật liệu / Lắp ráp → mã. Nhận "TB — Bàn" (chọn từ danh
 * sách), "TB", "Bàn", "ban", "tb - ban". Không khớp → null.
 */
export function matchOption(raw: string, options: readonly Option[]): string | null {
  const t = fold(raw)
  if (!t) return null
  const head = t.split(/\s*[-–—]\s*/)[0]
  for (const o of options) {
    const code = fold(o.code)
    if (t === code || t === fold(o.label) || t === fold(optionText(o)) || head === code) {
      return o.code
    }
  }
  return null
}

/**
 * Số trong ô. Ô kiểu SỐ của Excel giữ nguyên (1,234 kg không thành 1234). Ô CHỮ
 * đọc kiểu Việt: "1.390" = 1390, "2,5" = 2,5 — cùng luật `lib/cut-plan/paste`;
 * cho phép đuôi đơn vị "mm/cm/kg". Còn lại (vd "1/2", "khoảng 5") → null.
 */
export function parseNumberCell(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = v
    .replace(/\s/g, '')
    .replace(/(mm|cm|kg|m)$/i, '')
    .replace(/(?<!^-?0)[.,](?=\d{3}\b)/g, '')
    .replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const YES = new Set(['co', 'x', '✓', '✔', '1', 'true', 'yes', 'y', 'dung'])
const NO = new Set(['khong', '0', 'false', 'no', 'n', 'sai'])
export function parseBoolCell(v: string | number): boolean | null {
  const t = fold(String(v))
  if (YES.has(t)) return true
  if (NO.has(t)) return false
  return null
}

export type CellValue = string | number
export type RawRow = {
  /** Số hàng trong Excel — người dùng tìm lại dòng bằng số này. */
  row: number
  /** Chỉ các cột CÓ trong file (theo tiêu đề); ô trống là ''. */
  cells: Record<string, CellValue>
}

export type RowIssue = { field?: string; msg: string }
export type RowAction = 'create' | 'update' | 'same' | 'error'

/** Một ô đổi — màn soi bày "cũ → mới". */
export type CellChange = { key: string; label: string; before: string; after: string }

/** Giá trị đã đọc của một ô: undefined = để nguyên; null = xoá trắng. */
type Parsed = string | number | boolean | null | undefined

export type ExistingProduct = {
  id: string
  code: string
  name: string
  customer_name: string | null
  updated_at: string
  locked_at: string | null
  packing: Record<string, unknown> | null
  tech_spec: Record<string, unknown> | null
} & Record<string, unknown>

export type PlannedRow = {
  row: number
  action: RowAction
  /** Có cảnh báo (vẫn ghi được). */
  warn: boolean
  /** Mã sẽ ghi: mã đang có (cập nhật), tự cấp hoặc gõ tay (thêm mới). */
  code: string | null
  codeAuto: boolean
  /** id SP đang có — chỉ khi cập nhật. */
  id: string | null
  name: string
  customer: string | null
  changes: CellChange[]
  /** Cột thường + jsonb đã gộp, đúng thứ sẽ ghi. Rỗng khi không đổi / lỗi. */
  write: Record<string, unknown>
  errors: RowIssue[]
  warnings: RowIssue[]
}

export type ImportPlan = {
  rows: PlannedRow[]
  counts: { total: number; create: number; update: number; same: number; warn: number; error: number } // prettier-ignore
  /** Số ô đổi cộng dồn của các dòng cập nhật — chân bảng. */
  changedCells: number
  byType: Record<string, number>
}

const nameKey = (name: string, customer: string | null) =>
  `${fold(name)}|${customer ?? ''}`
const squash = (s: string) => fold(s).replace(/[^a-z0-9]/g, '')

/** Khoảng cách sửa chữ ≤ 1 — đủ bắt "BUNNING"/"BUNNINGS", "ROSSCO"/"ROSCO". */
function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * Nhãn khách gần giống một nhãn đang có (mà không trùng hẳn) — trả nhãn đó.
 * Chỉ xét nhãn ≥ 4 ký tự: "AE" với "ACE" là hai khách thật.
 */
export function nearLabel(label: string, existing: readonly string[]): string | null {
  const s = squash(label)
  if (s.length < 4) return null
  if (existing.includes(label)) return null
  for (const e of existing) {
    const t = squash(e)
    if (t.length < 4) continue
    if (t === s || editDistanceAtMost1(s, t)) return e
  }
  return null
}

const TYPE_LIST = PRODUCT_TYPES.map((o) => o.code).join(', ')
const MATERIAL_LIST = FRAME_MATERIALS.map((o) => o.code).join(', ')

/** Giá trị đang có của một cột trên SP — để so và để bày "cũ". */
export function currentValue(p: ExistingProduct | null, c: ColumnSpec): unknown {
  if (!p || !c.target) return undefined
  if ('col' in c.target) return p[c.target.col]
  return (p[c.target.json] as Record<string, unknown> | null)?.[c.target.key]
}

const fmtNum = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/** Chữ bày trên màn soi cho một giá trị. */
export function displayValue(c: ColumnSpec, v: unknown): string {
  // Ô có/không: xoá trắng là ghi "không" — bày đúng thứ sẽ ghi, đừng bày "(trống)".
  if (c.kind === 'bool') return v ? 'có' : 'không'
  if (v == null || v === '') return '(trống)'
  if (c.kind === 'type') return optionText(PRODUCT_TYPES.find((o) => o.code === v) ?? { code: String(v), label: '' }) // prettier-ignore
  if (c.kind === 'material') return optionText(FRAME_MATERIALS.find((o) => o.code === v) ?? { code: String(v), label: '' }) // prettier-ignore
  if (c.kind === 'assembly')
    return ASSEMBLY_OPTIONS.find((o) => o.code === v)?.label ?? String(v)
  if (typeof v === 'number') return fmtNum(v)
  return String(v)
}

/** Giá trị ghi ra ô khi XUẤT — cùng chữ ô thả xuống; ô có/không chỉ ghi "có". */
export function exportValue(c: ColumnSpec, v: unknown): string | number | null {
  if (v == null || v === '') return null
  if (c.kind === 'bool') return v ? 'có' : null
  if (c.kind === 'num' || c.kind === 'pos' || c.kind === 'int') {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (c.kind === 'type' || c.kind === 'material' || c.kind === 'assembly')
    return displayValue(c, v)
  return String(v)
}

/** So hai giá trị cùng cột — số so bằng số, chữ bỏ khoảng trắng đầu cuối, null = ''. */
function same(a: unknown, b: unknown): boolean {
  const na = a == null || a === '' ? null : a
  const nb = b == null || b === '' ? null : b
  if (na === null || nb === null) {
    // Ô có/không: "không" và trống là một (cột boolean mặc định false).
    if (na === false || nb === false) return !na && !nb
    return na === nb
  }
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb)
  if (typeof na === 'boolean' || typeof nb === 'boolean')
    return Boolean(na) === Boolean(nb)
  // Xuống dòng Windows (\r\n — ghi chú nạp từ web cũ) và Excel (\n) là một.
  const norm = (x: unknown) => String(x).replace(/\r\n?/g, '\n').trim()
  return norm(na) === norm(nb)
}

/**
 * Đọc MỘT ô theo loại cột. undefined = để nguyên (ô trống); null = xoá trắng ("-").
 * Sai dạng → đẩy lỗi, trả undefined.
 */
function parseCell(c: ColumnSpec, raw: CellValue, errors: RowIssue[]): Parsed {
  const s = typeof raw === 'number' ? String(raw) : raw.trim()
  if (s === '') return undefined
  if (s === CLEAR_MARK) {
    if (c.required || c.kind === 'unit') {
      errors.push({ field: c.key, msg: `${c.header} không xoá trắng được` })
      return undefined
    }
    return null
  }
  const bad = (msg: string): undefined => {
    errors.push({ field: c.key, msg })
    return undefined
  }
  switch (c.kind) {
    case 'type':
      return matchOption(s, PRODUCT_TYPES) ?? bad(`Loại không hiểu "${s}" — chọn trong danh sách thả xuống (${TYPE_LIST})`) // prettier-ignore
    case 'material':
      return matchOption(s, FRAME_MATERIALS) ?? bad(`Vật liệu không hiểu "${s}" — chọn trong danh sách thả xuống (${MATERIAL_LIST})`) // prettier-ignore
    case 'assembly':
      return matchOption(s, ASSEMBLY_OPTIONS) ?? bad(`Lắp ráp "${s}" — chọn Nguyên chiếc hoặc Tháo rời (KD)`) // prettier-ignore
    case 'bool': {
      const b = parseBoolCell(raw)
      return b ?? bad(`${c.header} "${s}" — gõ "có" hoặc "không"`)
    }
    case 'num':
    case 'pos':
    case 'int': {
      const n = parseNumberCell(raw)
      if (n == null) return bad(`${c.header} "${s}" không phải số`)
      if (n < 0 || (c.kind !== 'num' && n === 0)) return bad(`${c.header} phải lớn hơn 0`)
      if (c.kind === 'int' && !Number.isInteger(n))
        return bad(`${c.header} phải là số nguyên`)
      return n
    }
    case 'customer':
      if (c.max && s.length > c.max) return bad(`${c.header} dài quá ${c.max} ký tự`)
      return normalizeCustomerLabel(s)
    default:
      if (c.max && s.length > c.max) return bad(`${c.header} dài quá ${c.max} ký tự`)
      return s
  }
}

/**
 * Lập kế hoạch cho cả file: đọc từng ô, so với SP đang có, cấp mã cho dòng mới.
 *
 * Cấp mã: số kế tiếp của MỖI loại = max(mã trong thư viện, mã gõ tay trong file)
 * + 1, tăng theo thứ tự dòng — cùng luật `nextSerial` của form (không lấp khoảng
 * trống: số đã cấp là số đã in ra đơn hàng).
 */
export function planImport(
  input: readonly RawRow[],
  existing: readonly ExistingProduct[],
): ImportPlan {
  const byCode = new Map(existing.map((p) => [p.code.toUpperCase(), p]))
  const byName = new Map<string, string>()
  const labelCount = new Map<string, number>()
  for (const p of existing) {
    const k = nameKey(p.name, p.customer_name)
    if (!byName.has(k)) byName.set(k, p.code)
    if (p.customer_name) labelCount.set(p.customer_name, (labelCount.get(p.customer_name) ?? 0) + 1) // prettier-ignore
  }
  const labels = [...labelCount.keys()].sort(
    (a, b) => (labelCount.get(b) ?? 0) - (labelCount.get(a) ?? 0),
  )

  const maxSerial = new Map<string, number>()
  const bump = (code: string) => {
    const p = parseProductCode(code)
    if (p && p.serial > (maxSerial.get(p.type) ?? 0)) maxSerial.set(p.type, p.serial)
  }
  for (const p of existing) bump(p.code)

  const codeRows = new Map<string, number>()
  const nameRows = new Map<string, number>()
  const pending: { r: PlannedRow; type: string; material: string }[] = []

  const rows: PlannedRow[] = input.map(({ row, cells }) => {
    const errors: RowIssue[] = []
    const warnings: RowIssue[] = []
    const rawCode = String(cells.code ?? '')
      .trim()
      .toUpperCase()
    const version = String(cells.version ?? '').trim()

    // ── Dòng này là SP nào? ────────────────────────────────────────────────
    let target: ExistingProduct | null = null
    let manualNew = false
    if (rawCode) {
      const dupRow = codeRows.get(rawCode)
      if (dupRow != null)
        errors.push({ field: 'code', msg: `Mã trùng với dòng ${dupRow} trong file` }) // prettier-ignore
      else codeRows.set(rawCode, row)
      target = byCode.get(rawCode) ?? null
      if (!target) {
        if (parseProductCode(rawCode)) {
          // Mã đúng quy tắc mà không có → gõ nhầm / SP đã xoá. Thêm mới bằng mã đó
          // là đẻ ra SP lạ mang số của dãy — bắt sửa.
          errors.push({ field: 'code', msg: `Mã "${rawCode}" không có trong thư viện — sửa mã, hoặc để trống để thêm SP mới` }) // prettier-ignore
        } else if (rawCode.length > 100) {
          errors.push({ field: 'code', msg: 'Mã nội bộ dài quá 100 ký tự' })
        } else {
          manualNew = true
          warnings.push({ field: 'code', msg: `Thêm mới với mã gõ tay "${rawCode}" (ngoài quy tắc [loại][số]HG-[vật liệu])` }) // prettier-ignore
        }
      }
    }
    if (target?.locked_at) {
      errors.push({
        field: 'code',
        msg: 'Hồ sơ đã khoá — mở khoá ở trang chi tiết rồi tải lại file',
      })
    }

    // ── Đọc từng ô ────────────────────────────────────────────────────────
    const parsed = new Map<string, Parsed>()
    for (const c of IMPORT_COLUMNS) {
      if (!c.target || !(c.key in cells)) continue
      parsed.set(c.key, parseCell(c, cells[c.key], errors))
    }

    const isNew = !target && (!rawCode || manualNew)
    if (isNew) {
      for (const c of IMPORT_COLUMNS) {
        if (!c.required) continue
        if (parsed.get(c.key) == null && !errors.some((e) => e.field === c.key)) {
          errors.push({ field: c.key, msg: `SP mới thiếu ${c.header}` })
        }
      }
    }

    // ── So với SP đang có, dựng bản ghi ───────────────────────────────────
    const write: Record<string, unknown> = {}
    const changes: CellChange[] = []
    const packing = { ...(target?.packing ?? {}) }
    const techSpec = { ...(target?.tech_spec ?? {}) }
    let packingTouched = false
    let specTouched = false
    for (const c of IMPORT_COLUMNS) {
      const t = c.target
      if (!t || !parsed.has(c.key)) continue
      const next = parsed.get(c.key)
      if (next === undefined) continue
      const before = currentValue(target, c)
      if (target && same(before, next)) continue
      if (!target && next === null) continue
      if ('col' in t) {
        write[t.col] = next ?? (c.kind === 'bool' ? false : null)
      } else {
        const bag = t.json === 'packing' ? packing : techSpec
        if (next === null) delete bag[t.key]
        else bag[t.key] = next
        if (t.json === 'packing') packingTouched = true
        else specTouched = true
      }
      if (target) changes.push({ key: c.key, label: c.header, before: displayValue(c, before), after: displayValue(c, next) }) // prettier-ignore
    }
    if (packingTouched) write.packing = packing
    if (specTouched) write.tech_spec = techSpec

    const nameCell = parsed.get('name')
    const name = typeof nameCell === 'string' ? nameCell : (target?.name ?? '')
    const custCell = parsed.get('customer')
    const customer =
      custCell !== undefined ? ((custCell as string | null) ?? null) : (target?.customer_name ?? null) // prettier-ignore

    // ── Cảnh báo ──────────────────────────────────────────────────────────
    if (target && changes.length) {
      if (write.product_type !== undefined || write.frame_material !== undefined) {
        warnings.push({ field: 'type', msg: `Đổi Loại / Vật liệu nhưng mã ${target.code} không đổi theo` }) // prettier-ignore
      }
      if (version && version !== target.updated_at) {
        const at = new Date(target.updated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) // prettier-ignore
        warnings.push({ msg: `SP đã được sửa trên web lúc ${at}, sau khi xuất file — các ô đổi ở dòng này sẽ đè giá trị trên web` }) // prettier-ignore
      }
    }
    if (isNew && name) {
      const k = nameKey(name, customer)
      const hit = byName.get(k)
      const inFile = nameRows.get(k)
      if (hit) warnings.push({ field: 'name', msg: `Trùng tên + khách với ${hit} — đúng là SP đó thì điền mã ${hit} để cập nhật thay vì thêm mới` }) // prettier-ignore
      else if (inFile != null) warnings.push({ field: 'name', msg: `Trùng tên + khách với dòng ${inFile} trong file` }) // prettier-ignore
      if (inFile == null) nameRows.set(k, row)
    }
    if (customer && (isNew || write.customer_name !== undefined)) {
      const near = nearLabel(customer, labels)
      if (near) warnings.push({ field: 'customer', msg: `Nhãn khách gần giống "${near}" (${labelCount.get(near)} SP). Đúng là khách khác thì cứ ghi.` }) // prettier-ignore
    }

    const action: RowAction = errors.length
      ? 'error'
      : target
        ? changes.length
          ? 'update'
          : 'same'
        : 'create'

    if (action === 'create') {
      // SP mới luôn có ĐVT: ô trống = "cái".
      if (write.unit === undefined) write.unit = DEFAULT_UNIT
      if (manualNew) bump(rawCode)
    }

    const planned: PlannedRow = {
      row,
      action,
      warn: action !== 'same' && action !== 'error' && warnings.length > 0,
      code: target?.code ?? (manualNew ? rawCode : null),
      codeAuto: false,
      id: target?.id ?? null,
      name,
      customer,
      changes: action === 'update' ? changes : [],
      write: action === 'create' || action === 'update' ? write : {},
      errors,
      warnings: action === 'same' ? [] : warnings,
    }
    if (action === 'create' && !manualNew) {
      pending.push({ r: planned, type: String(write.product_type), material: String(write.frame_material) }) // prettier-ignore
    }
    return planned
  })

  // Cấp mã SAU khi đã gom mọi mã gõ tay — mã tự cấp không đụng mã gõ ở dòng dưới.
  for (const { r, type, material } of pending) {
    const serial = (maxSerial.get(type) ?? 0) + 1
    if (serial > MAX_SERIAL) {
      r.errors.push({ field: 'code', msg: `Hết số thứ tự cho loại ${type}` })
      r.action = 'error'
      r.warn = false
      r.write = {}
      continue
    }
    maxSerial.set(type, serial)
    r.code = buildProductCode(type, serial, material)
    r.codeAuto = true
  }

  const byType: Record<string, number> = {}
  for (const r of rows) {
    if (r.action !== 'create') continue
    const t = String(r.write.product_type ?? '?')
    byType[t] = (byType[t] ?? 0) + 1
  }
  return {
    rows,
    counts: {
      total: rows.length,
      create: rows.filter((r) => r.action === 'create').length,
      update: rows.filter((r) => r.action === 'update').length,
      same: rows.filter((r) => r.action === 'same').length,
      warn: rows.filter((r) => r.warn).length,
      error: rows.filter((r) => r.action === 'error').length,
    },
    changedCells: rows.reduce((s, r) => s + r.changes.length, 0),
    byType,
  }
}
