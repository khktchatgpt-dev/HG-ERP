import { FRAME_MATERIALS, PRODUCT_TYPES } from './product-code'
import { normalizeCustomerLabel } from './customer-label'

/**
 * THÊM + CẬP NHẬT SẢN PHẨM BẰNG MỘT FILE EXCEL (09/10/2026) — luật thuần,
 * không chạm DB. Chủ dự án: "1 mẫu file Excel riêng để thêm lên, có thể thêm
 * ảnh ngay trong file"; "cột đóng gói để cùng sheet".
 *
 *  · MỘT sheet "Sản phẩm": hàng 1 nhóm, hàng 2 TIÊU ĐỀ (đọc lại theo chữ này,
 *    không theo vị trí), hàng 3 ghi chú, dữ liệu từ hàng 4.
 *  · Dòng CÓ mã → cập nhật; KHÔNG mã → thêm mới (service cấp mã theo Loại + Khung).
 *  · Ô TRỐNG = giữ nguyên; gõ "-" = xoá trắng. Lỡ xoá một cột trong Excel không
 *    xoá trắng cả trăm SP.
 *  · 8 ô đóng gói = thùng của phương án MẶC ĐỊNH, nằm ngay trên dòng SP.
 *  · Ảnh: một ảnh đại diện mỗi dòng, dán vào ô Ảnh. Cột ẩn "Ảnh gốc" giữ
 *    `fileId|sha256` của ảnh đã xuất — ảnh để nguyên thì không tải lên lần nữa.
 *  · Còn dòng LỖI → chặn cả file.
 *
 * Bản 07/10 (nhánh backup/nhap-sp-excel-1007) có 46 cột + sheet Đóng gói riêng
 * và bị chê rối; bản này rút về 36 cột đúng khối Thông số + Đóng gói của hồ sơ.
 */

export const SP_SHEET = 'Sản phẩm'
export const SP_HEADER_ROW = 2
export const SP_NOTE_ROW = 3
export const SP_FIRST_ROW = 4
export const SP_MAX_ROWS = 1000
/** Gõ ô này để XOÁ TRẮNG giá trị đang có. */
export const CLEAR = '-'

export type ColKind =
  'code' | 'image' | 'text' | 'type' | 'mat' | 'cust' | 'unit' | 'num' | 'bool' | 'hidden'
export type SpCol = {
  key: string
  group: string
  header: string
  note?: string
  width: number
  kind: ColKind
  required?: boolean
}

const G1 = 'NHẬN DIỆN'
const G2 = 'KÍCH THƯỚC · KHỐI LƯỢNG'
const G3 = 'ĐÓNG GÓI (phương án mặc định)'
const G4 = 'THÔNG SỐ IN LSX'
const G5 = 'KHÁC'
export const SP_COLS: SpCol[] = [
  {
    key: 'code',
    group: G1,
    header: 'Mã nội bộ',
    note: 'trống = thêm mới',
    width: 14,
    kind: 'code',
  },
  {
    key: 'image',
    group: G1,
    header: 'Ảnh',
    note: 'dán ảnh vào ô',
    width: 11,
    kind: 'image',
  },
  {
    key: 'name',
    group: G1,
    header: 'Tên SP *',
    note: 'Ô trống = giữ nguyên · gõ "-" = xoá trắng',
    width: 42,
    kind: 'text',
    required: true,
  },
  {
    key: 'product_type',
    group: G1,
    header: 'Loại SP *',
    note: 'chọn',
    width: 16,
    kind: 'type',
    required: true,
  },
  {
    key: 'frame_material',
    group: G1,
    header: 'Vật liệu khung *',
    note: 'chọn',
    width: 16,
    kind: 'mat',
    required: true,
  },
  {
    key: 'name_foreign',
    group: G1,
    header: 'Tên theo khách',
    note: 'in LSX',
    width: 32,
    kind: 'text',
  },
  {
    key: 'customer_name',
    group: G1,
    header: 'Khách / nhóm',
    note: 'gợi ý',
    width: 14,
    kind: 'cust',
  },
  { key: 'customer_item_code', group: G1, header: 'Mã KH đặt', width: 14, kind: 'text' },
  { key: 'unit', group: G1, header: 'ĐVT', note: 'cái / bộ', width: 8, kind: 'unit' },
  {
    key: 'length_mm',
    group: G2,
    header: 'Dài (mm)',
    note: 'số kiểu VN: 1.390',
    width: 10,
    kind: 'num',
  },
  { key: 'width_mm', group: G2, header: 'Rộng (mm)', width: 10, kind: 'num' },
  { key: 'height_mm', group: G2, header: 'Cao (mm)', width: 10, kind: 'num' },
  {
    key: 'net_weight_kg',
    group: G2,
    header: 'KL tịnh (kg)',
    note: '2,5',
    width: 11,
    kind: 'num',
  },
  { key: 'actual_weight_kg', group: G2, header: 'KL cân (kg)', width: 11, kind: 'num' },
  {
    key: 'pk_qty',
    group: G3,
    header: 'SP / thùng',
    note: 'thùng của phương án mặc định',
    width: 10,
    kind: 'num',
  },
  { key: 'pk_l', group: G3, header: 'Thùng D (cm)', width: 11, kind: 'num' },
  { key: 'pk_w', group: G3, header: 'Thùng R (cm)', width: 11, kind: 'num' },
  { key: 'pk_h', group: G3, header: 'Thùng C (cm)', width: 11, kind: 'num' },
  { key: 'pk_nw', group: G3, header: 'NW / thùng (kg)', width: 12, kind: 'num' },
  { key: 'pk_gw', group: G3, header: 'GW / thùng (kg)', width: 12, kind: 'num' },
  { key: 'pk_cbm', group: G3, header: 'CBM / thùng', width: 11, kind: 'num' },
  { key: 'pk_hc', group: G3, header: 'Xếp 40HC (thùng)', width: 12, kind: 'num' },
  {
    key: 'material',
    group: G4,
    header: 'Chất liệu chính',
    note: 'trống nếu SP không có',
    width: 18,
    kind: 'text',
  },
  { key: 'ts_wood', group: G4, header: 'Gỗ', width: 16, kind: 'text' },
  { key: 'ts_paint', group: G4, header: 'Sơn (mã màu)', width: 16, kind: 'text' },
  { key: 'ts_fabric', group: G4, header: 'Vải', width: 16, kind: 'text' },
  { key: 'ts_glass', group: G4, header: 'Kính', width: 16, kind: 'text' },
  { key: 'ts_cushion', group: G4, header: 'Nệm / mút', width: 16, kind: 'text' },
  { key: 'ts_hardware', group: G4, header: 'Ngũ kim', width: 16, kind: 'text' },
  { key: 'ts_finish', group: G4, header: 'Màu hoàn thiện', width: 16, kind: 'text' },
  { key: 'barcode', group: G5, header: 'Barcode', width: 14, kind: 'text' },
  {
    key: 'description_en',
    group: G5,
    header: 'Mô tả EN',
    note: 'in báo giá',
    width: 28,
    kind: 'text',
  },
  { key: 'notes', group: G5, header: 'Ghi chú', width: 24, kind: 'text' },
  {
    key: 'is_active',
    group: G5,
    header: 'Đang dùng',
    note: 'có / không',
    width: 10,
    kind: 'bool',
  },
  {
    key: 'version',
    group: '',
    header: 'Phiên bản (đừng sửa)',
    note: 'hệ thống dùng',
    width: 10,
    kind: 'hidden',
  },
  {
    key: 'image_ref',
    group: '',
    header: 'Ảnh gốc (đừng sửa)',
    note: 'hệ thống dùng',
    width: 10,
    kind: 'hidden',
  },
]
export const SP_COL_BY_KEY = new Map(SP_COLS.map((c) => [c.key, c]))
export const PK_KEYS = [
  'pk_qty',
  'pk_l',
  'pk_w',
  'pk_h',
  'pk_nw',
  'pk_gw',
  'pk_cbm',
  'pk_hc',
] as const
export type PkKey = (typeof PK_KEYS)[number]
export const TS_KEYS = [
  'wood',
  'paint',
  'fabric',
  'glass',
  'cushion',
  'hardware',
  'finish',
] as const
export type TsKey = (typeof TS_KEYS)[number]
const NUM_KEYS = new Set([
  'length_mm',
  'width_mm',
  'height_mm',
  'net_weight_kg',
  'actual_weight_kg',
])

export const normHeader = (s: string) =>
  s.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim()
export function columnForHeader(h: string): SpCol | undefined {
  const n = normHeader(h)
  return SP_COLS.find((c) => normHeader(c.header) === n)
}

/** "CH — Ghế" | "CH" | "ghế" → "CH". null = trống; undefined = không có trong danh sách. */
export function optionCode(
  text: string,
  pairs: readonly { code: string; label: string }[],
): string | null | undefined {
  const t = text.trim()
  if (!t) return null
  const head = t
    .split(/\s[—–-]\s/)[0]
    .trim()
    .toUpperCase()
  const byCode = pairs.find((p) => p.code === head || p.code === t.toUpperCase())
  if (byCode) return byCode.code
  const byLabel = pairs.find((p) => p.label.toLowerCase() === t.toLowerCase())
  return byLabel?.code
}
export const optionText = (
  pairs: readonly { code: string; label: string }[],
  code: string | null,
) => {
  const p = pairs.find((x) => x.code === code)
  return p ? `${p.code} — ${p.label}` : (code ?? '')
}

/** "1.390" → 1390 · "2,5" → 2.5 · 1390 (số thật từ Excel) giữ nguyên. undefined = không phải số. */
export function parseVnNum(v: string | number): number | null | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function parseBool(v: string): boolean | null | undefined {
  const t = v.trim().toLowerCase()
  if (!t) return null
  if (['có', 'co', 'x', 'yes', 'true', '1'].includes(t)) return true
  if (['không', 'khong', 'no', 'false', '0'].includes(t)) return false
  return undefined
}

/** Một dòng đọc từ file: ô theo KEY cột (chuỗi thô, số thật giữ là số). */
export type RawRow = {
  row: number
  cells: Record<string, string | number>
  /** Ảnh dán trong ô Ảnh của dòng này (vân tay SHA-256). */
  image?: { sha: string; ext: string; bytes: number }
}

/** 8 ô đóng gói của phương án mặc định (cm, kg, thùng). */
export type PkSummary = Record<PkKey, number | null>
export type ExistingSp = {
  id: string
  code: string
  name: string
  product_type: string | null
  frame_material: string | null
  name_foreign: string | null
  customer_name: string | null
  customer_item_code: string | null
  unit: string
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
  actual_weight_kg: number | null
  material: string | null
  tech_spec: Partial<Record<TsKey, string | null>>
  barcode: string | null
  description_en: string | null
  notes: string | null
  is_active: boolean
  locked_at: string | null
  updated_at: string
  image_file_id: string | null
  pk: PkSummary
}

export type Change = { key: string; label: string; old: string; new: string }
export type PlannedRow = {
  row: number
  action: 'create' | 'update' | 'unchanged' | 'error'
  /** Mã đang có (update) · null (create, service cấp). */
  code: string | null
  id: string | null
  name: string
  type: string | null
  material: string | null
  errors: string[]
  warnings: string[]
  changes: Change[]
  /** Ô thuộc tính SP sẽ ghi (đã parse). */
  write: Record<string, unknown>
  /** tech_spec đã trộn — null = không đụng. */
  tech: Record<string, string | null> | null
  /** Ô đóng gói sẽ ghi — null = không đụng. */
  pk: Partial<PkSummary> | null
  hasImage: boolean
  newImage: boolean
  /** SHA-256 ảnh trong ô — ghi vào "Ảnh gốc" sau khi tải lên. */
  imageSha: string | null
}

const cellStr = (v: string | number | undefined) => (v == null ? '' : String(v).trim())
const fmt = (v: unknown): string => {
  if (v == null || v === '') return '—'
  if (typeof v === 'number')
    return v.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
  if (typeof v === 'boolean') return v ? 'có' : 'không'
  return String(v)
}
const sameStr = (a: string | null | undefined, b: string | null) =>
  (a ?? '').trim() === (b ?? '').trim()
const sameNum = (a: number | null | undefined, b: number | null) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9)

/** Giá trị đang có của một cột — để XUẤT file và để so khi đọc lại. */
export function currentValue(p: ExistingSp, key: string): string | number | null {
  if (key === 'code') return p.code
  if (key === 'product_type') return optionText(PRODUCT_TYPES, p.product_type)
  if (key === 'frame_material') return optionText(FRAME_MATERIALS, p.frame_material)
  if (key === 'is_active') return p.is_active ? 'có' : 'không'
  if (key === 'version') return p.updated_at
  if (key.startsWith('pk_')) return p.pk[key as PkKey]
  if (key.startsWith('ts_')) return p.tech_spec[key.slice(3) as TsKey] ?? null
  if (key === 'image' || key === 'image_ref') return null
  const v = (p as unknown as Record<string, unknown>)[key]
  return typeof v === 'number' || typeof v === 'string' ? v : null
}

/** Vân tay ảnh đã xuất: `fileId|sha`. */
export const imageRef = (fileId: string, sha: string) => `${fileId}|${sha}`
export const parseImageRef = (s: string | number | undefined) => {
  const t = cellStr(s)
  const [fileId, sha] = t.split('|')
  return fileId && sha ? { fileId, sha } : null
}

/** Soi cả file: mỗi dòng → thêm / cập nhật / không đổi / lỗi + từng ô cũ → mới. */
export function planRows(
  rows: RawRow[],
  existing: ExistingSp[],
): {
  rows: PlannedRow[]
  counts: Record<'create' | 'update' | 'unchanged' | 'error' | 'image', number>
} {
  const byCode = new Map(existing.map((p) => [p.code.toUpperCase(), p]))
  const seen = new Set<string>()
  const out: PlannedRow[] = []
  for (const r of rows) {
    const c = r.cells
    const code = cellStr(c.code).toUpperCase()
    const errors: string[] = []
    const warnings: string[] = []
    const changes: Change[] = []
    const write: Record<string, unknown> = {}
    let tech: Record<string, string | null> | null = null
    let pk: Partial<PkSummary> | null = null
    const p = code ? byCode.get(code) : undefined
    if (code && !p)
      errors.push(
        `Mã ${code} không có trong thư viện — bỏ trống ô Mã để thêm mới, hoặc sửa đúng mã`,
      )
    if (code) {
      if (seen.has(code)) errors.push(`Mã ${code} lặp ở dòng khác trong file`)
      seen.add(code)
    }
    if (p?.locked_at) errors.push('Hồ sơ đã khoá — mở khoá trên hồ sơ rồi mới sửa được')

    const lbl = (k: string) => SP_COL_BY_KEY.get(k)?.header.replace(' *', '') ?? k
    const put = (k: string, oldV: unknown, newV: unknown) => {
      changes.push({ key: k, label: lbl(k), old: fmt(oldV), new: fmt(newV) })
    }

    for (const col of SP_COLS) {
      if (
        ['code', 'image', 'version', 'image_ref', 'hidden'].includes(col.key) ||
        col.kind === 'hidden'
      )
        continue
      const raw = c[col.key]
      const s = cellStr(raw)
      if (s === '') continue
      const clear = s === CLEAR
      const k = col.key
      if (col.kind === 'text' || col.kind === 'cust') {
        const v = clear ? null : col.kind === 'cust' ? normalizeCustomerLabel(s) : s
        const cur = p
          ? ((p as unknown as Record<string, string | null>)[k] ?? null)
          : null
        if (!p || !sameStr(v, cur)) {
          if (k === 'name' && v == null) errors.push('Tên SP không được xoá trắng')
          else {
            write[k] = v
            if (p) put(k, cur, v)
          }
        }
      } else if (col.kind === 'unit') {
        const v = clear ? 'cái' : s
        if (!p || !sameStr(v, p.unit)) {
          write.unit = v
          if (p) put(k, p.unit, v)
        }
      } else if (col.kind === 'type' || col.kind === 'mat') {
        const pairs = col.kind === 'type' ? PRODUCT_TYPES : FRAME_MATERIALS
        const v = clear ? null : optionCode(s, pairs)
        if (v === undefined) errors.push(`${lbl(k)} "${s}" không có trong danh sách`)
        else {
          const cur =
            col.kind === 'type' ? (p?.product_type ?? null) : (p?.frame_material ?? null)
          if (!p || !sameStr(v, cur)) {
            write[k] = v
            if (p) {
              put(k, cur, v)
              warnings.push(`${lbl(k)} đổi nhưng mã ${p.code} không đổi theo`)
            }
          }
        }
      } else if (col.kind === 'num') {
        const v = clear ? null : parseVnNum(raw as string | number)
        if (v === undefined) errors.push(`${lbl(k)} "${s}" không phải số`)
        else if (k.startsWith('pk_')) {
          const cur = p?.pk[k as PkKey] ?? null
          if (!p || !sameNum(v, cur)) {
            pk = { ...(pk ?? {}), [k]: v }
            if (p) put(k, cur, v)
          }
        } else if (NUM_KEYS.has(k)) {
          const cur = p
            ? ((p as unknown as Record<string, number | null>)[k] ?? null)
            : null
          if (!p || !sameNum(v, cur)) {
            write[k] = v
            if (p) put(k, cur, v)
          }
        }
      } else if (col.kind === 'bool') {
        const v = clear ? null : parseBool(s)
        if (v === undefined) errors.push(`${lbl(k)} "${s}" — gõ "có" hoặc "không"`)
        else if (v != null && (!p || v !== p.is_active)) {
          write.is_active = v
          if (p) put(k, p.is_active, v)
        }
      }
      if (k.startsWith('ts_') && col.kind === 'text' && k in write) {
        // thông số in LSX nằm trong jsonb tech_spec — gom riêng, không ghi cột
        tech = { ...(tech ?? {}), [k.slice(3)]: (write[k] as string | null) ?? null }
        delete write[k]
      }
    }
    // thông số LSX: so với tech_spec đang có (ô text ở trên đã so với cột cùng tên — đây so đúng chỗ)
    if (tech && p) {
      for (const [tk, tv] of Object.entries(tech)) {
        const cur = p.tech_spec[tk as TsKey] ?? null
        if (sameStr(tv, cur)) {
          delete tech[tk]
          const i = changes.findIndex((x) => x.key === `ts_${tk}`)
          if (i >= 0) changes.splice(i, 1)
        } else {
          const i = changes.findIndex((x) => x.key === `ts_${tk}`)
          if (i >= 0) changes[i] = { ...changes[i], old: fmt(cur) }
        }
      }
      if (Object.keys(tech).length === 0) tech = null
    }

    // ảnh
    const ref = parseImageRef(c.image_ref)
    const hasImage = !!r.image
    const newImage = hasImage && (!ref || ref.sha !== r.image!.sha)
    if (newImage && p)
      changes.push({
        key: 'image',
        label: 'Ảnh',
        old: p.image_file_id ? 'ảnh cũ' : '—',
        new: 'ảnh mới',
      })

    // phiên bản
    const ver = cellStr(c.version)
    if (p && ver && ver !== p.updated_at)
      warnings.push('SP đã được sửa trên web sau khi xuất file — ô bạn gõ sẽ đè lên')

    const name =
      cellStr(c.name) && cellStr(c.name) !== CLEAR ? cellStr(c.name) : (p?.name ?? '')
    const type =
      (write.product_type as string | null | undefined) ?? p?.product_type ?? null
    const material =
      (write.frame_material as string | null | undefined) ?? p?.frame_material ?? null
    if (!p && !code) {
      if (!name) errors.push('SP mới cần Tên SP')
      if (!type) errors.push('SP mới cần Loại SP để cấp mã')
      if (!material) errors.push('SP mới cần Vật liệu khung để cấp mã')
    }
    const touched =
      Object.keys(write).length > 0 || tech != null || pk != null || newImage
    const action: PlannedRow['action'] = errors.length
      ? 'error'
      : p
        ? touched
          ? 'update'
          : 'unchanged'
        : 'create'
    out.push({
      row: r.row,
      action,
      code: p?.code ?? null,
      id: p?.id ?? null,
      name,
      type,
      material,
      errors,
      warnings,
      changes,
      write,
      tech,
      pk,
      hasImage,
      newImage,
      imageSha: r.image?.sha ?? null,
    })
  }
  const counts = { create: 0, update: 0, unchanged: 0, error: 0, image: 0 }
  for (const r of out) {
    counts[r.action]++
    if (r.newImage && r.action !== 'error') counts.image++
  }
  return { rows: out, counts }
}
