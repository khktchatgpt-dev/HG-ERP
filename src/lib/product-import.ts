import {
  FRAME_MATERIALS,
  MAX_SERIAL,
  PRODUCT_TYPES,
  buildProductCode,
  parseProductCode,
} from './product-code'
import { normalizeCustomerLabel } from './customer-label'

/**
 * THÊM SẢN PHẨM HÀNG LOẠT BẰNG EXCEL (07/10/2026) — luật thuần, không chạm DB.
 *
 * Kỹ thuật: "làm cho anh cái form nhập y [form Thêm sản phẩm], bằng excel, để anh
 * lưu bên anh chỉnh sửa rồi export ra nhập vô cho lẹ". Đo lúc đó: 807 SP, chỉ 28
 * SP thêm tay qua form trong 30 ngày; đợt lớn (436 SP ngày 26/07) phải nạp bằng
 * script vì người dùng không có đường nào tự làm.
 *
 * Chủ dự án duyệt theo đề xuất (bản vẽ "Nhập SP từ Excel"):
 *  · file có dòng LỖI thì chặn CẢ LÔ — thêm phần đúng trước thì lần tải lại sau
 *    thêm trùng chính các dòng đó;
 *  · chỉ THÊM MỚI, không sửa SP đã có (gõ mã đã có = lỗi);
 *  · đúng 7 ô của form; ĐVT mặc định "cái" có dấu (799/807 SP);
 *  · trùng tên + khách, nhãn khách gần giống nhãn có sẵn: chỉ CẢNH BÁO (81 cặp
 *    tên + khách trùng nhau là chuyện thường của thư viện).
 *
 * Một hàm `planImport` cho cả màn soi lẫn lúc ghi: service tính lại từ file ngay
 * lúc bấm Thêm, không nhận kết quả soi từ client.
 */

export const IMPORT_SHEET = 'Nhập SP'
/** Hàng 1 tiêu đề, hàng 2 ghi chú — dữ liệu từ hàng 3. */
export const IMPORT_FIRST_ROW = 3
export const IMPORT_MAX_ROWS = 500
export const DEFAULT_UNIT = 'cái'

export type ImportField =
  'type' | 'material' | 'code' | 'name' | 'name_foreign' | 'customer' | 'unit'

/** Cột của file mẫu — ĐÚNG thứ tự ô của form "Thêm sản phẩm". */
export const IMPORT_COLUMNS: {
  key: ImportField
  header: string
  required?: boolean
  note: string
  width: number
}[] = [
  { key: 'type', header: 'Loại sản phẩm', required: true, note: 'Chọn trong danh sách', width: 24 }, // prettier-ignore
  { key: 'material', header: 'Vật liệu khung', required: true, note: 'Chọn trong danh sách', width: 22 }, // prettier-ignore
  { key: 'code', header: 'Mã nội bộ', note: 'Để trống = tự cấp theo loại. Chỉ gõ khi SP mã cũ.', width: 18 }, // prettier-ignore
  { key: 'name', header: 'Tên SP (tiếng Việt)', required: true, note: 'Bắt buộc', width: 40 }, // prettier-ignore
  { key: 'name_foreign', header: 'Tên theo khách — in trên LSX', note: 'Đức / Anh / Pháp…', width: 34 }, // prettier-ignore
  { key: 'customer', header: 'Khách hàng / nhóm', note: 'Gõ tên bất kỳ — trống là mẫu chung', width: 22 }, // prettier-ignore
  { key: 'unit', header: 'ĐVT bán', note: 'Trống = "cái"', width: 10 },
]

export const FIELD_LABEL: Record<ImportField, string> = Object.fromEntries(
  IMPORT_COLUMNS.map((c) => [c.key, c.header]),
) as Record<ImportField, string>

/** Giới hạn độ dài — trùng `productCreateSchema` để không lọt lỗi ở lúc ghi. */
const MAX_LEN: Partial<Record<ImportField, number>> = {
  code: 100,
  name: 200,
  name_foreign: 300,
  customer: 200,
  unit: 30,
}

type Option = { code: string; label: string }

/** "TB — Bàn" — đúng chữ của ô thả xuống trong file mẫu. */
export const optionText = (o: Option) => `${o.code} — ${o.label}`

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

/**
 * Chữ trong ô Loại / Vật liệu → mã 2 ký tự. Nhận "TB — Bàn" (chọn từ danh sách),
 * "TB", "Bàn", "ban", "tb - ban". Không khớp → null.
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

export type RawRow = {
  /** Số hàng trong Excel — người dùng tìm lại dòng bằng số này. */
  row: number
  cells: Record<ImportField, string>
}

export type RowIssue = { field?: ImportField; msg: string }

export type ImportStatus = 'ok' | 'warn' | 'error'

export type PlannedRow = {
  row: number
  status: ImportStatus
  /** Chữ gốc trong ô — màn soi bày lại đúng thứ người dùng gõ. */
  raw: Record<ImportField, string>
  type: string | null
  material: string | null
  /** Mã sẽ ghi: tự cấp hoặc gõ tay. null khi dòng lỗi chưa cấp được. */
  code: string | null
  codeAuto: boolean
  name: string
  name_foreign: string | null
  customer: string | null
  unit: string
  errors: RowIssue[]
  warnings: RowIssue[]
}

export type ExistingProduct = { code: string; name: string; customer_name: string | null }

export type ImportPlan = {
  rows: PlannedRow[]
  counts: { total: number; ok: number; warn: number; error: number }
  /** Số mã sẽ cấp theo loại (chỉ dòng không lỗi) — chân bảng. */
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
  for (const e of existing) {
    if (e === label) return null
  }
  for (const e of existing) {
    const t = squash(e)
    if (t.length < 4) continue
    if (t === s || editDistanceAtMost1(s, t)) return e
  }
  return null
}

// Chỉ MÃ trong câu lỗi — tên đủ 7 loại làm câu dài gãy 7 dòng trên màn soi; danh
// sách đầy đủ đã nằm ở ô thả xuống của file.
const TYPE_LIST = PRODUCT_TYPES.map((o) => o.code).join(', ')
const MATERIAL_LIST = FRAME_MATERIALS.map((o) => o.code).join(', ')

/**
 * Lập kế hoạch cho cả file: kiểm từng dòng, cấp mã cho dòng hợp lệ, gắn cảnh báo.
 *
 * Cấp mã: số thứ tự kế tiếp của MỖI loại = max(mã có trong thư viện, mã gõ tay
 * trong file) + 1, tăng dần theo thứ tự dòng — cùng luật `nextSerial` của form
 * (không lấp khoảng trống: số đã cấp là số đã in ra đơn hàng).
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
  // Nhãn đông SP đứng trước: gợi ý "BUNNINGS (16 SP)" chứ không phải "BUNNING (12)".
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

  const rows: PlannedRow[] = input.map(({ row, cells }) => {
    const errors: RowIssue[] = []
    const warnings: RowIssue[] = []
    const raw = cells

    for (const [f, max] of Object.entries(MAX_LEN) as [ImportField, number][]) {
      if (raw[f].length > max) errors.push({ field: f, msg: `${FIELD_LABEL[f]} dài quá ${max} ký tự` }) // prettier-ignore
    }

    const type = matchOption(raw.type, PRODUCT_TYPES)
    if (!raw.type) errors.push({ field: 'type', msg: 'Thiếu Loại sản phẩm' })
    else if (!type) errors.push({ field: 'type', msg: `Loại không hiểu "${raw.type}" — chọn trong danh sách thả xuống (${TYPE_LIST})` }) // prettier-ignore

    const material = matchOption(raw.material, FRAME_MATERIALS)
    if (!raw.material) errors.push({ field: 'material', msg: 'Thiếu Vật liệu khung' })
    else if (!material) errors.push({ field: 'material', msg: `Vật liệu không hiểu "${raw.material}" — chọn trong danh sách thả xuống (${MATERIAL_LIST})` }) // prettier-ignore

    const name = raw.name
    if (!name) errors.push({ field: 'name', msg: 'Thiếu Tên SP (tiếng Việt)' })

    const customer = normalizeCustomerLabel(raw.customer)
    const unit = raw.unit || DEFAULT_UNIT

    let code: string | null = null
    if (raw.code) {
      code = raw.code.toUpperCase()
      const taken = byCode.get(code)
      const parsed = parseProductCode(code)
      const dupRow = codeRows.get(code)
      if (taken) {
        // Hay gặp nhất: tải lại chính file "đã có mã" của lần Thêm trước. Bảo "xoá ô mã"
        // không thôi là xui người ta thêm TRÙNG — nói cả hai trường hợp.
        errors.push({ field: 'code', msg: `Mã đã có — đang là "${taken.name}"${taken.customer_name ? ` của ${taken.customer_name}` : ''}. Đã thêm rồi (file tải về sau lần Thêm trước) thì bỏ dòng này; là SP khác thì xoá ô mã để cấp mã mới.` }) // prettier-ignore
      } else if (dupRow != null) {
        errors.push({ field: 'code', msg: `Mã trùng với dòng ${dupRow} trong file` })
      } else if (parsed && type && parsed.type !== type) {
        errors.push({
          field: 'code',
          msg: `Mã ghi loại ${parsed.type} nhưng ô Loại là ${type}`,
        })
      } else if (parsed && material && parsed.material !== material) {
        errors.push({ field: 'code', msg: `Mã ghi vật liệu ${parsed.material} nhưng ô Vật liệu là ${material}` }) // prettier-ignore
      }
      if (dupRow == null) codeRows.set(code, row)
      bump(code)
    }

    if (name) {
      const k = nameKey(name, customer)
      const hit = byName.get(k)
      const inFile = nameRows.get(k)
      // Mã đã có thì trùng tên là CHÍNH SP đó — lỗi mã đã nói đủ, đừng nói hai lần.
      if (hit && !errors.some((e) => e.field === 'code')) warnings.push({ field: 'name', msg: `Trùng tên + khách với ${hit}. Vẫn thêm — bỏ dòng này trong file nếu đúng là cùng một SP.` }) // prettier-ignore
      else if (inFile != null) warnings.push({ field: 'name', msg: `Trùng tên + khách với dòng ${inFile} trong file` }) // prettier-ignore
      if (inFile == null) nameRows.set(k, row)
    }
    if (customer) {
      const near = nearLabel(customer, labels)
      if (near) warnings.push({ field: 'customer', msg: `Nhãn khách gần giống "${near}" (${labelCount.get(near)} SP). Đúng là khách khác thì cứ thêm.` }) // prettier-ignore
    }

    return {
      row,
      status: errors.length ? 'error' : warnings.length ? 'warn' : 'ok',
      raw,
      type,
      material,
      code,
      codeAuto: false,
      name,
      name_foreign: raw.name_foreign || null,
      customer,
      unit,
      errors,
      warnings,
    }
  })

  // Cấp mã SAU khi đã gom mọi mã gõ tay — mã tự cấp không đụng mã gõ ở dòng dưới.
  const byType: Record<string, number> = {}
  for (const r of rows) {
    if (r.status === 'error' || r.code || !r.type || !r.material) continue
    const serial = (maxSerial.get(r.type) ?? 0) + 1
    if (serial > MAX_SERIAL) {
      r.errors.push({ field: 'code', msg: `Hết số thứ tự cho loại ${r.type}` })
      r.status = 'error'
      continue
    }
    maxSerial.set(r.type, serial)
    r.code = buildProductCode(r.type, serial, r.material)
    r.codeAuto = true
  }
  for (const r of rows) {
    if (r.status !== 'error' && r.type) byType[r.type] = (byType[r.type] ?? 0) + 1
  }

  return {
    rows,
    counts: {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      warn: rows.filter((r) => r.status === 'warn').length,
      error: rows.filter((r) => r.status === 'error').length,
    },
    byType,
  }
}

/** Ô trống ở mọi cột → bỏ qua, không báo lỗi. */
export const isBlankCells = (c: Record<ImportField, string>) =>
  IMPORT_COLUMNS.every((col) => !c[col.key])
