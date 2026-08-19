// QUÉT BỘ CỘT THẬT CỦA TỪNG KHỐI trong file BOM — để thiết kế lại màn Định mức.
//
//   node scripts/bom-scan-columns.mjs "C:/Users/HP/Downloads/All Bom"
//   node scripts/bom-scan-columns.mjs "<thư mục>" --json out.json
//
// Vì sao cần: `part-layouts.ts` hiện chia 6 họ cột, dựng từ đợt quét 187 file
// trước. Đợt đó trả lời "có bao nhiêu NHÓM"; bản này trả lời câu khác —
// **mỗi khối thật sự có những CỘT nào, viết bằng chữ gì, đơn vị gì**, vì đó mới
// là thứ phải bày lên UI cho người nhập điền.
//
// Cách nhận diện (không đoán theo vị trí cột — biểu mẫu có nhiều đời):
//  1. Dò HÀNG TIÊU ĐỀ CỘT: hàng có ≥3 ô khớp từ vựng tiêu đề và không có ô số.
//  2. Tiêu đề KHỐI = ô chữ đứng một mình gần nhất PHÍA TRÊN hàng đó.
//  3. Biểu mẫu có tiêu đề 2 tầng ("Quy Cách Tinh (mm)" / "Dày · Rộng · Dài") —
//     gộp hàng kế tiếp nếu nó cũng toàn chữ và cùng vùng cột.
//
// Chỉ ĐỌC, không ghi gì.

import nodeFs from 'node:fs'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

// SheetJS bản ESM KHÔNG tự nối fs — thiếu dòng này thì readFile ném
// 'Cannot access file' cho MỌI file mà không nói vì sao.
XLSX.set_fs(nodeFs)

const DIR = process.argv[2]
if (!DIR) {
  console.error('✗ thiếu đường dẫn thư mục chứa file BOM')
  process.exit(1)
}
const JSON_OUT = (() => {
  const i = process.argv.indexOf('--json')
  return i > 0 ? process.argv[i + 1] : null
})()

const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** Từ vựng tiêu đề cột — dùng để NHẬN RA hàng tiêu đề, không để ánh xạ trường. */
const HEADER_WORDS = [
  'stt',
  'tt',
  'ten chi tiet',
  'ten hang',
  'ten vat tu',
  'ten',
  'loai',
  'day',
  'rong',
  'dai',
  'cao',
  'mong',
  'so luong',
  'sl',
  'dvt',
  'don vi',
  'vat lieu',
  'chat lieu',
  'ghi chu',
  'tong chieu dai',
  'trong luong',
  'khoi luong',
  'k. luong',
  'dien tich',
  'phi hao',
  'hao hut',
  'don gia',
  'thanh tien',
  'ncc',
  'mau',
  'quy cach',
  'parts',
  'bo phan',
  'kich thuoc',
  'met toi',
  'kho',
  'ma hang',
  'xac nhan',
  'phoi',
  'mm',
  'm2',
  'm3',
  'kg',
]

const looksHeaderCell = (v) => {
  const t = nod(v)
  if (!t || t.length > 40) return false
  if (/^[\d.,%]+$/.test(t)) return false
  return HEADER_WORDS.some((w) => t === w || t.includes(w))
}
const isNumeric = (v) => typeof v === 'number' || /^[\d.,]+$/.test(String(v ?? '').trim())

/** Tiêu đề khối → họ, theo đúng chữ người lập bảng gõ. */
function familyOf(title) {
  const t = nod(title)
  if (!t) return 'KHÔNG TÊN'
  // ĐÓNG GÓI phải xét TRƯỚC nệm: "VẬT TƯ ĐÓNG GÓI" có chữ "gói" khớp luật
  // "gối" của nệm — để sau thì 311 khối bao bì bị xếp nhầm sang CUSHION.
  if (/bao bi|dong goi/.test(t)) return 'PACKAGING'
  if (/polywood|van ep|nan poly/.test(t)) return 'POLYWOOD'
  if (/kinh|mat da|mat ban|gach|ceramic/.test(t)) return 'PANEL'
  if (/^quy cach *:? *go|go teck|go keo|bach dan|^go /.test(t)) return 'WOOD'
  if (/nem|^goi[ ,:]|mousse|mouse|gon /.test(t)) return 'CUSHION'
  if (/vai|textilen/.test(t)) return 'FABRIC'
  if (/day du|day dan|^may$|wicker|rattan|soi/.test(t)) return 'DAN'
  if (/ngu kim|^vat tu$/.test(t)) return 'HARDWARE'
  if (/^tem/.test(t)) return 'LABEL'
  if (/day keo|ykk|nham gai/.test(t)) return 'ZIPPER'
  if (/^son|hoa chat|nhom *\+ *son/.test(t)) return 'PAINT'
  if (/quy cach *:? *(nhom|sat|inox|la sat|thep)|^quy cach *:?$|khung/.test(t))
    return 'FRAME'
  return 'KHÁC'
}

const files = readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
const blocks = []
let bad = 0

for (const f of files) {
  let wb
  try {
    wb = XLSX.readFile(join(DIR, f), { cellFormula: false, cellHTML: false })
  } catch {
    bad++
    continue
  }
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws || !ws['!ref']) continue
    const grid = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: true,
      defval: null,
    })
    if (grid.length > 4000) continue

    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? []
      const cells = row.map((c) => (c == null ? '' : String(c).trim()))
      const hits = cells.filter(looksHeaderCell).length
      const nums = cells.filter((c) => c && isNumeric(c)).length
      if (hits < 3 || nums > 0) continue

      // Tầng tiêu đề thứ hai (biểu mẫu gộp ô "Quy Cách Tinh (mm)" ở trên).
      const next = (grid[r + 1] ?? []).map((c) => (c == null ? '' : String(c).trim()))
      const nextIsHeader =
        next.filter(looksHeaderCell).length >= 3 && next.every((c) => !c || !isNumeric(c))
      const merged = cells.map((c, i) => {
        const b = nextIsHeader ? next[i] : ''
        return [c, b].filter(Boolean).join(' / ')
      })

      // Tiêu đề khối: ô chữ đứng một mình gần nhất phía trên.
      let title = ''
      for (let k = r - 1; k >= Math.max(0, r - 6); k--) {
        const up = (grid[k] ?? [])
          .map((c) => (c == null ? '' : String(c).trim()))
          .filter(Boolean)
        if (up.length === 0) continue
        if (up.length <= 2 && up[0].length > 2 && !isNumeric(up[0])) {
          title = up[0]
          break
        }
      }

      blocks.push({
        file: f,
        sheet: name,
        title,
        family: familyOf(title),
        cols: merged.filter(Boolean),
      })
      if (nextIsHeader) r++
    }
  }
}

/* ── Tổng hợp ───────────────────────────────────────────────────────────── */
console.log(
  `File đọc được: ${files.length - bad}/${files.length}  ·  khối tìm được: ${blocks.length}\n`,
)

const byFam = new Map()
for (const b of blocks) {
  if (!byFam.has(b.family)) byFam.set(b.family, [])
  byFam.get(b.family).push(b)
}

const order = [...byFam.entries()].sort((a, b) => b[1].length - a[1].length)
for (const [fam, list] of order) {
  // Tần suất TỪNG CỘT trong họ đó — đây là thứ quyết định bộ cột trên UI.
  const freq = new Map()
  for (const b of list) {
    for (const c of new Set(b.cols.map((x) => x.replace(/\s+/g, ' ').trim()))) {
      freq.set(c, (freq.get(c) ?? 0) + 1)
    }
  }
  const top = [...freq].sort((a, b) => b[1] - a[1])
  console.log(`\n${'='.repeat(78)}\n${fam} — ${list.length} khối`)
  const titles = [...new Set(list.map((b) => b.title).filter(Boolean))].slice(0, 8)
  console.log(`tiêu đề: ${titles.join(' | ')}`)
  console.log('cột (≥5% số khối):')
  for (const [c, n] of top) {
    const pct = Math.round((100 * n) / list.length)
    if (pct < 5) continue
    console.log(`  ${String(pct).padStart(3)}%  ${n.toString().padStart(4)}  ${c}`)
  }
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(blocks, null, 1))
  console.log(`\n→ ${JSON_OUT}`)
}
