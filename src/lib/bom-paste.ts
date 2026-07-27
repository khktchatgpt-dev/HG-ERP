import { parseShape } from './bom-calc'

/**
 * Đọc một vùng dán từ Excel thành các dòng định mức nháp.
 *
 * NHẬN DẠNG CỘT THEO TIÊU ĐỀ, không theo vị trí cố định. Bản trước ánh xạ cứng
 * "cột 1 là tên, cột 2 là loại…" nên chỉ đúng với khối KHUNG của biểu mẫu cũ:
 *
 *  · Biểu mẫu mới (28-02-2026) chèn thêm cột **`Parts/ Bộ phận`** (cụm) vào giữa
 *    Stt và Tên chi tiết ⇒ mọi cột sau đó lệch một ô, dán vào là quy cách sai hết.
 *  · Khối GỖ/NỆM không có cột "Loại" và có thêm cột "Mộng".
 *  · Khối NGŨ KIM/BAO BÌ không có kích thước nào, đổi lại có ĐVT và "Vật Liệu".
 *
 * Có dòng tiêu đề thì khớp theo chữ; không có thì mới đoán theo vị trí (dựa vào
 * chỗ nào ra được dạng profile). Cột tính được (tổng dài, diện tích) BỎ QUA — app
 * tự tính lại từ hình học. Trọng lượng thì GIỮ vì có thể là số theo bảng cân NCC.
 */
export type DraftPart = {
  part_no: number | null
  /** Cột `Parts/ Bộ phận` — tên cụm, service tự khớp/tạo. */
  cluster_name: string | null
  part_name: string
  profile_shape: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  bend_waste_mm: number | null
  tenon_mm: number | null
  qty: number | null
  unit: string | null
  material_note: string | null
  weight_kg: number | null
  note: string | null
}

/** Trường mà một cột của vùng dán ánh xạ tới. */
type Field = Exclude<keyof DraftPart, 'part_name'> | 'part_name' | 'skip'

export type PasteResult = {
  rows: DraftPart[]
  /** Dòng bị bỏ và lý do — hiện cho người dán biết, không im lặng nuốt. */
  skipped: { line: number; text: string; reason: string }[]
  /** Cột nào đã nhận ra — hiện lại để người dán kiểm, không tin mù. */
  mapped: { index: number; field: Field; label: string }[]
  source: 'header' | 'guess'
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null
  // Excel VN hay dùng dấu phẩy thập phân và dấu chấm phân nhóm nghìn.
  const s = v
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const cleaned = s.replace(/[^\d.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
const txt = (v: string | undefined): string | null => {
  const s = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || null
}
const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

/**
 * Chữ trong ô tiêu đề → trường. Thứ tự QUAN TRỌNG: luật hẹp đứng trước luật rộng
 * ("tong chieu dai" phải chặn trước "dai", "day vat lieu" trước "day").
 */
const HEADER_RULES: [RegExp, Field][] = [
  [/^(stt|tt|so tt)$/, 'part_no'],
  [/parts|bo phan|^cum/, 'cluster_name'],
  [/ten chi tiet|ten hang|ten vat tu|^ten$/, 'part_name'],
  [/^loai$|kieu|dang/, 'profile_shape'],
  // Các cột TÍNH ĐƯỢC — bỏ qua trước khi luật kích thước kịp bắt nhầm.
  [/tong chieu dai|tong dai/, 'skip'],
  [/dien tich|^dt/, 'skip'],
  [/thanh tien|^tt$|don gia|^dgia$/, 'skip'],
  [/xac nhan/, 'skip'],
  [/trong luong|khoi luong|^kl|\bkg\b/, 'weight_kg'],
  [/day vat lieu|do day|^δ$|^d$/, 'wall_thickness_mm'],
  [/phi ?hao|phe lieu|hao uon/, 'bend_waste_mm'],
  [/^mong$|mong \(/, 'tenon_mm'],
  [/^day/, 'dim_a_mm'],
  [/^rong/, 'dim_b_mm'],
  [/^dai/, 'cut_length_mm'],
  [/so luong|^sl/, 'qty'],
  [/^dvt$|don vi tinh|^dv$/, 'unit'],
  [/vat lieu|chat lieu/, 'material_note'],
  [/ghi chu|^note$/, 'note'],
]

const FIELD_LABEL: Record<string, string> = {
  part_no: 'STT',
  cluster_name: 'Cụm',
  part_name: 'Tên chi tiết',
  profile_shape: 'Loại',
  dim_a_mm: 'Dày',
  dim_b_mm: 'Rộng',
  wall_thickness_mm: 'δ',
  cut_length_mm: 'Dài',
  bend_waste_mm: 'Phi hao',
  tenon_mm: 'Mộng',
  qty: 'SL',
  unit: 'ĐVT',
  material_note: 'Vật liệu',
  weight_kg: 'Khối lượng',
  note: 'Ghi chú',
  skip: '—',
}

function fieldOfHeader(cell: string): Field | null {
  const s = noAccent(cell).trim()
  if (!s) return null
  for (const [re, f] of HEADER_RULES) if (re.test(s)) return f
  return null
}

/**
 * Dòng có phải TIÊU ĐỀ không: ít nhất 3 ô khớp luật, và không ô nào là số.
 * Biểu mẫu có tiêu đề 2 tầng (`Quy Cách Tinh (mm)` / `Dày · Rộng · Dài`) nên phải
 * chấp nhận cả tầng dưới.
 */
function readHeader(cells: string[]): Map<number, Field> | null {
  const hits = new Map<number, Field>()
  let numeric = 0
  cells.forEach((c, i) => {
    if (!txt(c)) return
    if (num(c) != null && /^\s*[\d.,-]+\s*$/.test(c)) numeric++
    const f = fieldOfHeader(c)
    if (f) hits.set(i, f)
  })
  if (numeric > 0) return null
  return hits.size >= 3 ? hits : null
}

/** Dòng tổng / dòng rỗng — không phải chi tiết. */
function isNoise(cells: string[]): string | null {
  const joined = noAccent(cells.join(' ')).trim()
  if (!joined) return 'dòng trống'
  if (/^tong cong|^tong\b|^total\b/.test(joined)) return 'dòng tổng cộng'
  return null
}

/**
 * Không có tiêu đề thì đoán: tìm cột ra được dạng profile (Hộp/Tròn/Vuông…) rồi
 * suy ngược — đó là cột "Loại", ngay trước nó là "Tên chi tiết", và nếu còn cột
 * nữa ở trước thì cột đó là Cụm (biểu mẫu mới) chứ không phải STT.
 */
function guessMap(grids: string[][]): Map<number, Field> {
  const m = new Map<number, Field>()
  const width = Math.max(0, ...grids.map((g) => g.length))

  // Bảng HẸP = thứ tự cột của chính lưới nhập trong app (người dùng copy lại từ
  // bảng của mình, hoặc gõ tay). Biểu mẫu BOM luôn ≥ 12 cột.
  if (width < 12) {
    const compact: Field[] = [
      'part_name',
      'profile_shape',
      'dim_a_mm',
      'dim_b_mm',
      'wall_thickness_mm',
      'cut_length_mm',
      'qty',
      'unit',
      'note',
    ]
    compact.forEach((f, i) => {
      if (i < width) m.set(i, f)
    })
    return m
  }

  // Biểu mẫu BOM. Neo vào cột "Loại": đứng ở vị trí 2 là biểu mẫu cũ, ở vị trí 3
  // là biểu mẫu mới (đã chèn cột `Parts/ Bộ phận`). Đây đúng chỗ mà bản trước
  // ánh xạ cứng nên đọc lệch một ô toàn bộ quy cách.
  let shapeCol = -1
  for (let c = 1; c < Math.min(width, 5) && shapeCol < 0; c++) {
    const hits = grids.filter((g) => parseShape(g[c])).length
    if (hits >= Math.max(1, Math.ceil(grids.length / 3))) shapeCol = c
  }
  if (shapeCol < 0) shapeCol = 2 // không dòng nào ra dạng → giả định biểu mẫu cũ

  m.set(shapeCol, 'profile_shape')
  m.set(shapeCol - 1, 'part_name')
  if (shapeCol >= 3) {
    m.set(shapeCol - 2, 'cluster_name')
    m.set(shapeCol - 3, 'part_no')
  } else if (shapeCol === 2) m.set(0, 'part_no')

  // Sau cột "Loại": Dày · Rộng · Dài · Phi hao · SL · [Tổng dài] · KL ·
  // [Diện tích] · δ · Ghi chú.
  const after: Field[] = [
    'dim_a_mm',
    'dim_b_mm',
    'cut_length_mm',
    'bend_waste_mm',
    'qty',
    'skip',
    'weight_kg',
    'skip',
    'wall_thickness_mm',
    'note',
  ]
  after.forEach((f, i) => {
    if (shapeCol + 1 + i < width) m.set(shapeCol + 1 + i, f)
  })
  return m
}

const blank = (): DraftPart => ({
  part_no: null,
  cluster_name: null,
  part_name: '',
  profile_shape: null,
  dim_a_mm: null,
  dim_b_mm: null,
  wall_thickness_mm: null,
  cut_length_mm: null,
  bend_waste_mm: null,
  tenon_mm: null,
  qty: null,
  unit: null,
  material_note: null,
  weight_kg: null,
  note: null,
})

export function parseBomPaste(text: string): PasteResult {
  const lines = String(text ?? '').split(/\r?\n/)
  // Tách theo Tab (Excel) — nếu không có Tab thì thử nhiều khoảng trắng / dấu ;
  const split = (l: string) =>
    l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : l.split(/ {2,}/)

  const grids = lines.map(split)
  const skipped: PasteResult['skipped'] = []

  // Tiêu đề có thể trải 2 dòng (biểu mẫu gộp ô) — gộp các dòng tiêu đề liên tiếp.
  let map: Map<number, Field> | null = null
  let bodyFrom = 0
  for (let i = 0; i < Math.min(grids.length, 6); i++) {
    const h = readHeader(grids[i])
    if (!h) {
      if (map) break
      continue
    }
    if (!map) map = new Map()
    // Tầng dưới ("Dày · Rộng · Dài") cụ thể hơn tầng trên ("Quy Cách Tinh") nên
    // được ghi đè lên.
    for (const [k, v] of h) map.set(k, v)
    bodyFrom = i + 1
    skipped.push({
      line: i + 1,
      text: grids[i].join(' | ').slice(0, 80),
      reason: 'dòng tiêu đề',
    })
  }

  const source: PasteResult['source'] = map ? 'header' : 'guess'
  const body = grids.slice(bodyFrom)
  const finalMap = map ?? guessMap(body.filter((g) => g.some(Boolean)))

  const rows: DraftPart[] = []
  body.forEach((cells, i) => {
    const lineNo = bodyFrom + i + 1
    const reason = isNoise(cells)
    if (reason) {
      if (cells.some(Boolean))
        skipped.push({ line: lineNo, text: cells.join(' | ').slice(0, 80), reason })
      return
    }

    const row = blank()
    for (const [idx, field] of finalMap) {
      const raw = cells[idx]
      if (field === 'skip') continue
      switch (field) {
        case 'part_no': {
          const v = num(raw)
          row.part_no = v == null ? null : Math.trunc(v)
          break
        }
        case 'part_name':
          row.part_name = txt(raw) ?? ''
          break
        case 'profile_shape':
          row.profile_shape = parseShape(raw)
          break
        case 'cluster_name':
        case 'unit':
        case 'material_note':
        case 'note':
          row[field] = txt(raw)
          break
        default:
          row[field] = num(raw)
      }
    }

    if (!row.part_name) {
      if (cells.some(Boolean))
        skipped.push({
          line: lineNo,
          text: cells.join(' | ').slice(0, 80),
          reason: 'không có tên chi tiết',
        })
      return
    }
    rows.push(row)
  })

  const mapped = [...finalMap.entries()]
    .filter(([, f]) => f !== 'skip')
    .sort((a, b) => a[0] - b[0])
    .map(([index, field]) => ({ index, field, label: FIELD_LABEL[field] ?? field }))

  return { rows, skipped, mapped, source }
}
