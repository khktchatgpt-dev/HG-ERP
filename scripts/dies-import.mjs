// Import danh mục KHUÔN NHÔM (technical_dies) từ file Excel của phòng Kỹ thuật.
//
//   node scripts/dies-import.mjs "E:/PO/YOTRIO-01-BIỂU MẪU TÍNH NHÔM ĐẶT NCC.xlsx"
//   node scripts/dies-import.mjs <file.xlsx> --reset     # nạp lại từ đầu
//   node scripts/dies-import.mjs <file.xlsx> --dry       # chỉ in, không ghi DB
//
// Vì sao cần: mẫu đơn đặt hàng NHÔM tính tiền theo (kg/m × dài cây × số cây) ×
// giá/kg. `kg/m` là thuộc tính của KHUÔN, không phải của vật tư — không có bảng
// này thì mỗi dòng đơn nhôm phải tra Excel rồi gõ tay.
//
// Sheet nguồn: "KHUÔN" — header ở dòng 5, dữ liệu từ dòng 6:
//   B Mã khuôn · C Hình ảnh/quy cách · D Tên chi tiết · E kg/m · F ĐVT
//   G Đơn giá khuôn · H NCC · I Ghi chú · J Ghi chú 2 (trạng thái / ngày)
//
// Những chỗ file gốc "bẩn" mà script phải chịu được:
//   · Dòng lệch cột — có dòng bỏ trống E, kg/m nằm ở F (vd YH-G22 → 0.385).
//   · Số viết kiểu VN — "0,714/ 6 mét" (kg/m), "13,500,000" (giá khuôn).
//   · Mã ghép chú thích — "TW-HG02 / Đổi thành TD-HG10", "VEC-B40 / 25x60x1.0li".
//     Lấy đoạn trước dấu "/" làm mã; đoạn sau thành quy cách nếu cột C trống.
//   · Cùng mã nhiều đời (mở lại, bỏ gân, tăng dày) khác kg/m → đời SAU CÙNG trong
//     file là `is_current`, các đời trước giữ lại để tra cứu lịch sử.
//   · "Bỏ" đứng một mình = khuôn đã bỏ (retired). "Bỏ gân 12/12/2024" thì KHÔNG —
//     đó là sửa khuôn. "Hư"/"khuôn hư" ở mã hoặc ghi chú = broken.
//
// Không import gì từ src/ để chạy được bằng `node` trần.

import { readFileSync } from 'node:fs'
import { client } from './products-lib.mjs'

const SHEET = 'KHUÔN'
const FIRST_ROW = 6

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const reset = args.includes('--reset')
const dry = args.includes('--dry')

if (!file) {
  console.error('✗ thiếu đường dẫn file .xlsx')
  console.error(
    '  node scripts/dies-import.mjs "E:/PO/YOTRIO-01-….xlsx" [--reset] [--dry]',
  )
  process.exit(1)
}

/**
 * Đọc số. Dấu phẩy trong file lúc là ngăn nghìn ("13,500,000" — giá khuôn), lúc
 * là dấu thập phân kiểu VN ("0,714" — kg/m). KHÔNG đoán được từ hình dạng chuỗi
 * ("0,714" và "13,500" cùng shape) nên bắt gọi phải khai `mode`.
 *
 *   num(v, 'thousands') → "13,500,000" = 13500000
 *   num(v, 'decimal')   → "0,714"      = 0.714
 */
function num(v, mode = 'thousands') {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim()
  if (!s) return null
  s = mode === 'decimal' ? s.replace(',', '.') : s.replace(/,/g, '')
  const m = s.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * kg/m của khuôn. Hầu hết ô là kg/m thẳng, nhưng có ô ghi khối lượng CẢ CÂY kèm
 * chiều dài — "0,714/ 6 mét" (La 22×2.0: 0,714 kg cho cây 6 m ⇒ 0,119 kg/m; đối
 * chiếu hình học 22×2 mm² × 2,7 g/cm³ = 0,119 kg/m, khớp). Không chia thì cột
 * kg/m lệch 6 lần và đơn nhôm ra tiền sai.
 */
function weightPerM(v) {
  const n = num(v, 'decimal')
  if (n == null) return null
  const perBar = String(v).match(/\/\s*([\d.,]+)\s*m(ét|\b)/i)
  if (perBar) {
    const len = num(perBar[1], 'decimal')
    if (len && len > 0) return Math.round((n / len) * 10000) / 10000
  }
  return n
}

function text(v) {
  if (v == null) return null
  const s = String(v)
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  return s === '' ? null : s
}

/** Ô ngày của Excel về qua SheetJS là Date (cellDates: true). */
function asDate(v) {
  return v instanceof Date && !Number.isNaN(v.getTime())
    ? v.toISOString().slice(0, 10)
    : null
}

/** Chuỗi trông như quy cách profile chứ không phải ghi chú. */
const SPEC_RE = /^(hộp|vuông|tròn|la|ống|phi|ø|\d)/i

/**
 * Tách ô mã khuôn thành { code, spec, annotation }.
 *
 * Ô gốc nhồi nhiều thứ vào một chỗ, mỗi kiểu một cách:
 *   "TD-B108 - Vuông 60x60x1.2"             → code + quy cách (gạch nối có khoảng trắng)
 *   "VEC-B40 /  25x60x1.0li"                → code + quy cách (gạch chéo)
 *   "TW-HG02 / Đổi thành TD-HG10"           → code + ghi chú
 *   "TD-973 (khuôn hư 27/11/2021)\nDT-BD04" → code + chú thích trong ngoặc + ghi chú
 *
 * ⚠️ CHỈ tách ở xuống dòng hoặc " / " (khoảng trắng hai bên) — tách ở mọi dấu "/"
 * sẽ cắt nát ngày tháng trong ngoặc thành "TD-973 (khuôn hư 27".
 * Gạch nối chỉ tách khi có khoảng trắng ĐỨNG TRƯỚC, để không phá "TD-HG-AL03".
 */
function splitCode(raw) {
  const segs = String(raw)
    .split(/\r?\n|\s+\/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  let head = segs[0] ?? ''
  const rest = segs.slice(1)

  // Chú thích trong ngoặc ở cuối mã: "TD-973 (khuôn hư 27/11/2021)" → ghi chú.
  let annotation = null
  const paren = head.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (paren && paren[1].trim()) {
    head = paren[1].trim()
    annotation = paren[2].trim()
  }

  // Quy cách nối bằng gạch nối: "TD-B477 - 24x40", "TD-B583 -17x30".
  let spec = null
  const dash = head.match(/^(.+?)\s+-\s*(.+)$/)
  if (dash && SPEC_RE.test(dash[2])) {
    head = dash[1].trim()
    spec = dash[2].trim()
  }

  // Phần đuôi: giống quy cách thì làm quy cách, còn lại gom vào ghi chú.
  for (const s of rest) {
    if (spec == null && SPEC_RE.test(s)) spec = s
    else annotation = [annotation, s].filter(Boolean).join(' · ')
  }
  // Ngoặc có khi chính là quy cách: "TW-HG06 (Hộp 10x86)".
  if (spec == null && annotation && SPEC_RE.test(annotation)) {
    spec = annotation
    annotation = null
  }
  return { code: head || String(raw).trim(), spec, annotation }
}

/**
 * Khuôn hư. KHÔNG dùng `\bhư\b`: trong regex JS không cờ `u`, "ư" không phải
 * word-char nên `\b` không khớp và mọi dòng hư đều lọt lưới. Neo bằng khoảng
 * trắng / dấu ngoặc để "chưa" không bị nhận nhầm.
 */
function isBroken(s) {
  return /(^|[\s(])hư([\s).,:;]|$)/i.test(s)
}

const XLSX = await import('xlsx')
const wb = XLSX.read(readFileSync(file), { type: 'buffer', cellDates: true })
const ws = wb.Sheets[SHEET]
if (!ws) {
  console.error(`✗ file không có sheet "${SHEET}" — có: ${wb.SheetNames.join(', ')}`)
  process.exit(1)
}
const grid = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
})

const rows = []
let skipped = 0
// Dưới bảng khuôn, cùng sheet, còn một bảng tra "Hộp / Dày / Khối lượng riêng" và
// một khối công thức ("Khối lượng (kg) = Diện tích mặt cắt × …"). Chữ ở đó cũng
// rơi vào cột B nên sẽ bị nhận nhầm thành mã khuôn. Bảng khuôn không có khoảng
// trống dài ở giữa, nên gặp đủ 5 dòng trống liên tiếp là hết bảng → dừng.
const END_GAP = 5
let blankRun = 0
for (let r = FIRST_ROW - 1; r < grid.length; r++) {
  const g = grid[r] ?? []
  const cell = (i) => g[i] ?? null
  const rawCode = text(cell(1)) // B
  if (!rawCode) {
    skipped++
    if (++blankRun >= END_GAP) break
    continue
  }
  blankRun = 0
  if (/^stt$/i.test(rawCode)) continue

  const { code, spec: codeSpec, annotation } = splitCode(String(cell(1)))

  let weight = weightPerM(cell(4)) // E
  let unit = text(cell(5)) // F
  const price = num(cell(6), 'thousands') // G
  // Dòng lệch cột: E trống mà F là số → F chính là kg/m, ĐVT coi như chưa khai.
  if (weight == null && unit != null && weightPerM(cell(5)) != null) {
    weight = weightPerM(cell(5))
    unit = null
  }

  const note1 = text(cell(8)) // I
  const rawNote2 = cell(9) // J — có khi là Date
  const note2 = asDate(rawNote2) ? null : text(rawNote2)
  const effective_date = asDate(rawNote2)
  const note = [annotation, note1, note2].filter(Boolean).join(' · ') || null

  // "Bỏ" đứng một mình = đã bỏ khuôn; "Bỏ gân…" là sửa khuôn, không phải bỏ.
  const retired = [note1, note2].some((s) => s != null && /^bỏ$/i.test(s.trim()))
  const broken = isBroken(`${rawCode} ${note ?? ''}`)
  const status = broken ? 'broken' : retired ? 'retired' : 'active'

  rows.push({
    code,
    name: text(cell(3)), // D
    profile_spec: text(cell(2)) ?? codeSpec, // C, thiếu thì lấy quy cách kèm mã
    weight_per_m: weight,
    unit,
    die_price: price,
    supplier_name: text(cell(7)), // H
    status,
    is_current: status === 'active',
    effective_date,
    note,
  })
}

// Cùng mã nhiều đời → chỉ đời cuối cùng còn `is_current`.
const lastIdx = new Map()
rows.forEach((d, i) => lastIdx.set(d.code.toLowerCase(), i))
rows.forEach((d, i) => {
  if (lastIdx.get(d.code.toLowerCase()) !== i) d.is_current = false
})

const withWeight = rows.filter((d) => d.weight_per_m != null).length
console.log(
  `→ ${rows.length} khuôn (bỏ qua ${skipped} dòng trống) · ${withWeight} có kg/m · ` +
    `${rows.filter((d) => d.is_current).length} đang dùng · ` +
    `${rows.filter((d) => d.status === 'broken').length} hư · ` +
    `${rows.filter((d) => d.status === 'retired').length} đã bỏ`,
)

if (rows.length === 0) {
  console.error('✗ không đọc được dòng nào — kiểm tra lại sheet/FIRST_ROW')
  process.exit(1)
}
if (dry) {
  console.table(rows.slice(0, 12))
  process.exit(0)
}

const sb = await client(import.meta.url)

// Nối NCC giữ khuôn sang hồ sơ NCC nếu tên khớp — phần lớn NCC nhôm chưa có hồ
// sơ trong app nên để null, `supplier_name` vẫn giữ nguyên chữ trong file.
const { data: sups } = await sb.from('supply_suppliers').select('id, name')
const norm = (s) => s.toLowerCase().replace(/[^a-zà-ỹ0-9]/gi, '')
for (const d of rows) {
  if (!d.supplier_name) continue
  const hit = (sups ?? []).find(
    (s) =>
      norm(s.name) === norm(d.supplier_name) ||
      norm(s.name).includes(norm(d.supplier_name)),
  )
  if (hit) d.supplier_id = hit.id
}

const { count } = await sb
  .from('technical_dies')
  .select('id', { count: 'exact', head: true })
if (count && !reset) {
  console.error(`✗ technical_dies đã có ${count} dòng — thêm --reset để nạp lại từ đầu`)
  process.exit(1)
}
if (count && reset) {
  const { error } = await sb
    .from('technical_dies')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.error('✗ xoá dữ liệu cũ thất bại:', error.message)
    process.exit(1)
  }
  console.log(`  đã xoá ${count} dòng cũ`)
}

for (let i = 0; i < rows.length; i += 100) {
  const batch = rows.slice(i, i + 100)
  const { error } = await sb.from('technical_dies').insert(batch)
  if (error) {
    console.error('✗ insert thất bại:', error.message)
    process.exit(1)
  }
}
console.log(`✓ đã nạp ${rows.length} khuôn vào technical_dies`)
