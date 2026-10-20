// Nạp danh mục KHUÔN NHÔM từ file hợp nhất của phòng Kỹ thuật vào technical_dies.
//
//   node scripts/khuon-import.mjs "C:/.../QUAN LY KHUON NHOM - HOP NHAT_5.xlsx"
//   node scripts/khuon-import.mjs <file.xlsx> --apply     # ghi DB (mặc định chạy khô)
//   node scripts/khuon-import.mjs <file.xlsx> --report docs/khuon-doi-chieu.md
//
// ⚠️ CHẠY KHÔ LÀ MẶC ĐỊNH. Đợt 1 của docs/quan-ly-khuon-ke-hoach.md nghiệm thu
// bằng chính BẢN ĐỐI CHIẾU mà lượt chạy khô in ra — người phụ trách đọc xong,
// chốt các điểm phải quyết tay, rồi mới `--apply`.
//
// Cần migration 0190 đã áp (cột part_group, legacy_codes, technical_die_events…).
// Script tự dò và dừng sớm nếu chưa có, thay vì ghi được nửa vời.
//
// Nguồn — file "QUAN LY KHUON NHOM - HOP NHAT_5.xlsx", 13 sheet:
//   DANH MỤC KHUÔN        189 mã, header dòng 3, dữ liệu từ dòng 4 (cột A..U)
//   LỊCH SỬ SỬA KHUÔN     43 dòng → technical_die_events (event_type = modified)
//   KHUÔN TRÙNG NHIỀU NCC 22 cụm / 53 mã → duplicate_group
//   ĐỐI CHIẾU LỆCH        20 mã có số liệu đá nhau → data_confidence
//   TRA CỨU - …           5 bảng trọng lượng của NCC, KHÔNG nạp ở bước này
//
// Những chỗ file "bẩn" mà script phải chịu được:
//   · Cột ĐVT có 1 dòng ghi "0.385" (số lọt vào ô chữ) → bỏ, không ghi thẳng.
//   · Một mã viết nhiều kiểu ở 4 file cũ ("TD916-1", "TD916-3", "TD-A591 cũ") →
//     gom hết vào legacy_codes, và ĐÂY là đường khớp với 142 dòng đang có trong DB.
//   · Ảnh mặt cắt neo MỘT ảnh MỘT dòng ở cột C (170/189) → ghép theo `row` của
//     anchor. KHÔNG dùng lối "lấy ảnh lớn nhất" của luồng BOM: ở đó một file một
//     ảnh, ở đây một file 170 ảnh.
//   · "Đã chuyển nơi khác" / "Đã sửa / bỏ gân" KHÔNG phải trạng thái khuôn — cái
//     đầu là nơi giữ đổi, cái sau là sự kiện. Xem chú thích của 0190.
//
// Không import gì từ src/ để chạy được bằng `node` trần.

import { readFileSync, writeFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { client } from './products-lib.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const apply = args.includes('--apply')
const reportPath = args[args.indexOf('--report') + 1]?.startsWith('--')
  ? null
  : args.includes('--report')
    ? args[args.indexOf('--report') + 1]
    : null

if (!file) {
  console.error('✗ thiếu đường dẫn file .xlsx')
  console.error(
    '  node scripts/khuon-import.mjs "<file.xlsx>" [--apply] [--report <đường dẫn.md>]',
  )
  process.exit(1)
}

// ── Đọc file ───────────────────────────────────────────────────────────────

const wb = new ExcelJS.Workbook()
await wb.xlsx.load(readFileSync(file))

const sheet = (name) => {
  const ws = wb.getWorksheet(name)
  if (!ws) {
    console.error(`✗ file không có sheet "${name}"`)
    process.exit(1)
  }
  return ws
}

/** Ô → chuỗi đã trim. exceljs trả object cho ô công thức / rich text. */
const txt = (cell) => {
  const v = cell?.value
  if (v == null) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText))
      return v.richText
        .map((r) => r.text)
        .join('')
        .trim()
    if (v.result != null) return String(v.result).trim()
    if (v.text != null) return String(v.text).trim()
    return ''
  }
  return String(v).trim()
}

/** Ô → số. File này viết số kiểu Anh (0.76), dấu phẩy là ngăn nghìn. */
const num = (cell) => {
  const s = txt(cell)
  if (!s) return null
  const n = Number(s.replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Khoá so khớp: bỏ hết dấu cách / gạch / ký tự lạ, HOA hết. */
const norm = (s) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

// ── 1. DANH MỤC KHUÔN ──────────────────────────────────────────────────────
// Cột: A STT · B Mã chuẩn · C Ảnh · D Mã file gốc · E Tên · F Nhóm · G Dạng
//      H Hợp kim · I kg/m · J kg/m sau sửa · K ĐVT · L Đơn giá · M Nơi giữ
//      N NCC ghi trên file · O Tình trạng · P Đã sửa · Q BOM Buning · R Số file
//      S Cảnh báo lệch · T Ghi chú · U Nguồn

const STATUS_MAP = {
  'đang dùng': 'active',
  'ít dùng': 'rarely_used',
  'khuôn hư': 'broken',
  'khuôn cũ (đã thay)': 'replaced',
  'đã bỏ / không còn': 'retired',
  'chờ mở khuôn': 'pending',
  // Hai giá trị KHÔNG phải trạng thái khuôn — xem header 0190.
  'đã chuyển nơi khác': 'active',
  'đã sửa / bỏ gân': 'active',
  'chưa xác định': 'unknown',
}

const dmSheet = sheet('DANH MỤC KHUÔN')
const dies = []
dmSheet.eachRow((row, rowNo) => {
  if (rowNo < 4) return
  const code = txt(row.getCell(2))
  if (!code) return
  const rawStatus = txt(row.getCell(15))
  const statusKey = rawStatus.toLowerCase()
  const unit = txt(row.getCell(11))
  const legacy = txt(row.getCell(4))
    .split(/[;,\n]/)
    .map((s) => s.trim())
    .filter((s) => s && norm(s) !== norm(code))

  dies.push({
    rowNo,
    code,
    legacy_codes: [...new Set(legacy)],
    name: txt(row.getCell(5)) || null,
    part_group: txt(row.getCell(6)) || null,
    profile_shape: txt(row.getCell(7)) || null,
    alloy: txt(row.getCell(8)) || null,
    // ⚠️ BẪY ĐÃ TRẢ GIÁ MỘT LẦN: cột I là kg/m TRƯỚC sửa, cột J là SAU sửa.
    // Lấy thẳng cột I là đẩy ngược TD-A591 từ 0,743 (đã bỏ 2 gân) về 0,78 — tức
    // là dùng file mới để làm HỎNG số đúng đang có trong DB. kg/m hiệu lực luôn
    // là số sau sửa nếu có; số trước sửa đi vào sự kiện `modified`.
    weight_raw: num(row.getCell(9)),
    weight_after_fix: num(row.getCell(10)),
    weight_per_m: num(row.getCell(10)) ?? num(row.getCell(9)),
    // ĐVT là ô CHỮ; 1 dòng trong file lọt số 0.385 vào đây → bỏ.
    unit: /^[0-9.,]+$/.test(unit) ? null : unit || null,
    die_price: num(row.getCell(12)),
    holder_name: txt(row.getCell(13)) || null,
    supplier_name: txt(row.getCell(14)) || null,
    raw_status: rawStatus,
    status: STATUS_MAP[statusKey] ?? 'unknown',
    fixed: txt(row.getCell(16)) === 'Có',
    file_count: num(row.getCell(18)) ?? 0,
    conflict_warning: txt(row.getCell(19)) || null,
    note: txt(row.getCell(20)) || null,
    source_note: txt(row.getCell(21)) || null,
  })
})

// ── 2. Ảnh mặt cắt: neo một ảnh một dòng ở cột C ───────────────────────────
// exceljs trả anchor 0-based; dòng Excel = nativeRow + 1.

const imagesByRow = new Map()
for (const img of dmSheet.getImages()) {
  const excelRow = Math.round(img.range?.tl?.nativeRow ?? -1) + 1
  const media = wb.model.media?.[img.imageId] ?? wb.getImage(Number(img.imageId))
  if (excelRow <= 0 || !media?.buffer) continue
  // Một dòng chỉ giữ một ảnh — file có dòng neo chồng, lấy ảnh lớn hơn.
  const prev = imagesByRow.get(excelRow)
  if (!prev || media.buffer.byteLength > prev.buffer.byteLength) {
    imagesByRow.set(excelRow, {
      buffer: Buffer.from(media.buffer),
      extension: (media.extension ?? 'png').toLowerCase(),
    })
  }
}
for (const d of dies) d.has_image = imagesByRow.has(d.rowNo)

// ── 3. Cụm khuôn nghi trùng ────────────────────────────────────────────────
// Cột: A Cụm · B Mức độ · C Loại trùng · D Mã khuôn. Cột A/B chỉ ghi ở dòng đầu
// mỗi cụm (ô gộp) → phải nhớ giá trị gần nhất.

const dupByCode = new Map()
let curCluster = null
let curLevel = null
sheet('KHUÔN TRÙNG NHIỀU NCC').eachRow((row, rowNo) => {
  if (rowNo < 4) return
  const c = txt(row.getCell(1))
  if (c) {
    curCluster = c
    curLevel = txt(row.getCell(2)) || null
  }
  const code = txt(row.getCell(4))
  if (code && curCluster) {
    dupByCode.set(norm(code), { cluster: `C${curCluster}`, level: curLevel })
  }
})

// ── 4. Mã có số liệu đá nhau giữa các file cũ ──────────────────────────────

const conflictCodes = new Set()
sheet('ĐỐI CHIẾU LỆCH').eachRow((row, rowNo) => {
  if (rowNo < 3) return
  const code = txt(row.getCell(1))
  if (code) conflictCodes.add(norm(code))
})

// ── 5. Lịch sử sửa khuôn → sự kiện ─────────────────────────────────────────
// Cột: B Mã · E kg/m trước · F kg/m sau · I Đơn giá mở · J Báo giá sửa
//      K Nội dung sửa · L NCC · M Ngày sửa · N Tình trạng sau sửa · R Nguồn
//
// CHỈ nạp 43 dòng có cấu trúc này. KHÔNG bóc sự kiện bằng regex từ ô ghi chú tự
// do — đoán sai ngày tháng trong sổ lịch sử còn tệ hơn là không có dòng nào.

/** "24/10/2024" → "2024-10-24". Ô ngày kiểu VN, exceljs trả chuỗi. */
function vnDate(s) {
  if (!s) return null
  if (s instanceof Date) return s.toISOString().slice(0, 10)
  const m = String(s)
    .trim()
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const events = []
sheet('LỊCH SỬ SỬA KHUÔN').eachRow((row, rowNo) => {
  if (rowNo < 3) return
  const code = txt(row.getCell(2))
  // Dòng tiêu đề lọt vào vì sheet có một dòng tít phía trên — bắt theo nội dung
  // chứ không theo số dòng, để file sửa lại bố cục không âm thầm nạp rác.
  if (!code || code.toLowerCase() === 'mã khuôn') return
  const before = num(row.getCell(5))
  const after = num(row.getCell(6))
  const content = [txt(row.getCell(11)), txt(row.getCell(14))].filter(Boolean).join(' · ')
  events.push({
    code,
    event_type: 'modified',
    event_date: vnDate(row.getCell(13).value),
    weight_before: before,
    weight_after: after,
    cost: num(row.getCell(10)),
    content: content || null,
    source: txt(row.getCell(18)) || null,
  })
})

// ── 6. Khớp với 142 dòng đang có trong DB ──────────────────────────────────

const db = await client(import.meta.url)

const { data: probe, error: probeErr } = await db
  .from('technical_dies')
  .select('id, legacy_codes')
  .limit(1)
if (probeErr) {
  console.error(
    `✗ chưa áp migration 0190 (hoặc không đọc được bảng): ${probeErr.message}`,
  )
  console.error('  Áp supabase/migrations/0190_khuon_mo_rong.sql rồi chạy lại.')
  process.exit(1)
}
void probe

const { data: existing, error: exErr } = await db.from('technical_dies').select(
  // `*` chứ không chọn cột: file sao lưu ở bước --apply phải đủ để khôi phục.
  '*',
)
if (exErr) {
  console.error(`✗ đọc technical_dies lỗi: ${exErr.message}`)
  process.exit(1)
}

// Chỉ số tra: mã chuẩn trước, rồi mới tới mã ghi trên file gốc. Ngược lại là một
// mã cũ của khuôn A cướp mất dòng của khuôn B.
const byCode = new Map()
const byLegacy = new Map()
for (const d of dies) {
  byCode.set(norm(d.code), d)
  for (const l of d.legacy_codes) if (!byLegacy.has(norm(l))) byLegacy.set(norm(l), d)
}

const matched = [] // { row, db, via }
const orphans = [] // dòng DB không tìm thấy trong file
for (const row of existing) {
  const k = norm(row.code)
  const hit = byCode.get(k) ?? byLegacy.get(k)
  if (hit)
    matched.push({ row: hit, db: row, via: byCode.has(k) ? 'mã chuẩn' : 'mã file gốc' })
  else orphans.push(row)
}

// Một dòng file có thể ứng với NHIỀU dòng DB (mẹo is_current cũ tách một mã thành
// nhiều đời). Gom lại để biết dòng nào là đích ghi đè.
const dbByFileRow = new Map()
for (const m of matched) {
  const list = dbByFileRow.get(m.row.code) ?? []
  list.push(m)
  dbByFileRow.set(m.row.code, list)
}

const brandNew = dies.filter((d) => !dbByFileRow.has(d.code))

// Lệch kg/m: chỉ so với dòng DB đang là đời hiện hành.
//
// Tách làm hai loại, vì chúng đòi hai cách xử khác hẳn nhau:
//  · GIẢI THÍCH ĐƯỢC — DB đang giữ đúng số TRƯỚC sửa, file có số SAU sửa. Tức là
//    khuôn đã bỏ gân mà DB chưa cập nhật. Ghi đè an toàn + đẻ một sự kiện.
//  · KHÔNG GIẢI THÍCH ĐƯỢC — hai bên khác nhau không vì lý do sửa gân. Phải hỏi.
const weightUpdates = []
const weightConflicts = []
for (const [code, list] of dbByFileRow) {
  const row = list[0].row
  const current = list.find((m) => m.db.is_current) ?? list[0]
  const a = current.db.weight_per_m == null ? null : Number(current.db.weight_per_m)
  const b = row.weight_per_m
  if (a == null || b == null || Math.abs(a - b) <= 0.0005) continue
  const explained =
    row.weight_after_fix != null &&
    row.weight_raw != null &&
    Math.abs(a - row.weight_raw) <= 0.0005
  ;(explained ? weightUpdates : weightConflicts).push({
    code,
    db: a,
    file: b,
    dbId: current.db.id,
  })
}

// Trạng thái: dòng DB đang 'active' mà file ghi "Chưa xác định" → GIỮ 'active'.
// Hạ 74 mã xuống 'unknown' là ô chọn khuôn trên đơn mua (lọc status='active')
// mất luôn số đó. Ghi ra để người phụ trách quyết, không tự quyết trong script.
const statusHolds = []
for (const [code, list] of dbByFileRow) {
  const row = list[0].row
  const current = list.find((m) => m.db.is_current) ?? list[0]
  if (row.status === 'unknown' && current.db.status === 'active') {
    statusHolds.push({ code, keep: 'active' })
  }
}

const eventCodes = new Set(events.map((e) => norm(e.code)))
const eventsUnmatched = [...eventCodes].filter((k) => !byCode.has(k) && !byLegacy.has(k))

// ── 7. Bản đối chiếu ───────────────────────────────────────────────────────

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const L = []
const say = (s = '') => {
  L.push(s)
  console.log(s)
}

say(`# Bản đối chiếu nạp khuôn — ${new Date().toISOString().slice(0, 10)}`)
say()
say(`Nguồn: \`${file}\``)
say(`Chế độ: **${apply ? 'GHI DB (--apply)' : 'chạy khô — chưa ghi gì'}**`)
say()
say('## 1. Tổng quan')
say()
say('| Phép đo | Số |')
say('| --- | --- |')
say(`| Mã khuôn trong file | ${dies.length} |`)
say(`| Dòng đang có trong DB | ${existing.length} |`)
say(`| Ghép được vào dòng DB đã có | ${dbByFileRow.size} |`)
say(`| **Mã MỚI sẽ thêm** | **${brandNew.length}** |`)
say(`| Dòng DB không thấy trong file | ${orphans.length} |`)
say(
  `| Ảnh mặt cắt bóc được | ${imagesByRow.size}/${dies.length} (${pct(imagesByRow.size, dies.length)}) |`,
)
say(`| Sự kiện sửa khuôn | ${events.length} dòng / ${eventCodes.size} mã |`)
say(`| Mã thuộc cụm nghi trùng | ${dupByCode.size} |`)
say(
  `| Mã cần rà (lệch số liệu hoặc 1 nguồn) | ${dies.filter((d) => conflictCodes.has(norm(d.code)) || d.file_count <= 1).length} |`,
)
say()

say('## 2. Điểm PHẢI QUYẾT TAY')
say()
say(`### 2.1 Lệch kg/m giữa DB và file — ${weightConflicts.length} mã`)
say()
say('kg/m hiệu lực = **cột "kg/m sau sửa" nếu có**, không thì cột "Trọng lượng kg/m".')
say(
  `Trong file có ${dies.filter((d) => d.weight_after_fix != null).length} mã đã sửa gân nên hai cột khác nhau.`,
)
say()
if (weightConflicts.length) {
  say('Các mã dưới đây vẫn lệch **sau khi** đã áp quy tắc trên — phải quyết bằng tay.')
  say()
  say('| Mã | kg/m đang ở DB | kg/m hiệu lực của file | Chênh |')
  say('| --- | ---: | ---: | ---: |')
  for (const c of weightConflicts) {
    say(`| ${c.code} | ${c.db} | ${c.file} | ${(c.file - c.db).toFixed(4)} |`)
  }
} else {
  say('_Không có mã nào lệch mà không giải thích được._')
}
say()
say(
  `**${weightUpdates.length} mã DB còn giữ số TRƯỚC sửa** — file có số sau bỏ gân, ghi đè an toàn + đẻ một sự kiện:`,
)
say()
if (weightUpdates.length) {
  say('| Mã | DB (trước sửa) | File (sau sửa) | Nhẹ đi |')
  say('| --- | ---: | ---: | ---: |')
  for (const c of weightUpdates) {
    say(`| ${c.code} | ${c.db} | ${c.file} | ${(c.db - c.file).toFixed(4)} kg/m |`)
  }
} else say('_Không có._')
say()

say(`### 2.2 Dòng DB không tìm thấy trong file — ${orphans.length} mã`)
say()
if (orphans.length) {
  say('Giữ lại như khuôn riêng, hay là cách viết cũ của một mã nào đó trong file?')
  say('Script **giữ nguyên, không đụng tới** cho tới khi có quyết định.')
  say()
  say('| Mã | Tên | kg/m | Tình trạng |')
  say('| --- | --- | ---: | --- |')
  for (const o of orphans) {
    say(
      `| ${o.code} | ${(o.name ?? '').slice(0, 50)} | ${o.weight_per_m ?? '—'} | ${o.status} |`,
    )
  }
} else say('_Không có._')
say()

say(`### 2.3 File ghi "Chưa xác định" mà DB đang 'active' — ${statusHolds.length} mã`)
say()
say('Script **GIỮ `active`**: hạ xuống `unknown` là ô chọn khuôn trên đơn mua')
say('(lọc `status = active`) mất luôn số mã đó. Muốn bày đúng sự thật thì phải sửa')
say('`diesRepo.search()` ở Đợt 2 trước, rồi chạy lại script với quyết định mới.')
say()

say(`### 2.4 Sự kiện sửa khuôn không khớp mã nào — ${eventsUnmatched.length}`)
say()
say(eventsUnmatched.length ? eventsUnmatched.join(' · ') : '_Không có._')
say()

say('## 3. Sẽ ghi gì khi chạy `--apply`')
say()
say(`- **Thêm ${brandNew.length} mã mới** vào \`technical_dies\`.`)
say(
  `- **Cập nhật ${dbByFileRow.size} mã đã có**: nhóm chi tiết, dạng profile, hợp kim, nơi giữ, mã cũ, độ tin cậy, cụm trùng.`,
)
say(
  `- **Ghi ${events.length} sự kiện** vào \`technical_die_events\` (event_type = modified).`,
)
say('- **KHÔNG** đụng: `is_current`, `supplier_id`, và các dòng ở mục 2.2.')
say(
  `- **CHƯA** nạp ${imagesByRow.size} ảnh mặt cắt — ảnh phải đi qua \`filesService\` (bucket, đường dẫn, quyền), làm ở bước riêng ngay sau bước này.`,
)
say()
const unknownNew = brandNew.filter((d) => d.status === 'unknown').length
say(
  `Trong ${brandNew.length} mã mới có **${unknownNew} mã trạng thái \`unknown\`** — đó là sự thật của file, không phải lỗi nạp.`,
)
say()

say('## 4. Phân bố THEO FILE')
say()
say(
  `_Là số của file, chưa trừ ${statusHolds.length} mã giữ nguyên \`active\` ở mục 2.3._`,
)
say()
const dist = (key) => {
  const m = new Map()
  for (const d of dies) {
    const k = d[key] || '(trống)'
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].sort((a, b) => b[1] - a[1])
}
say('| Tình trạng | Số mã |')
say('| --- | ---: |')
for (const [k, v] of dist('status')) say(`| ${k} | ${v} |`)
say()
say('| Nơi giữ khuôn | Số mã |')
say('| --- | ---: |')
for (const [k, v] of dist('holder_name')) say(`| ${k} | ${v} |`)
say()

if (reportPath) {
  writeFileSync(reportPath, L.join('\n') + '\n', 'utf8')
  console.log(`\n→ đã ghi bản đối chiếu: ${reportPath}`)
}

if (!apply) {
  console.log('\n✓ chạy khô xong — chưa ghi gì vào DB. Thêm --apply để ghi.')
  process.exit(0)
}

// ── 8. Ghi DB ──────────────────────────────────────────────────────────────
// Chỉ chạy khi người phụ trách đã đọc bản đối chiếu ở trên.

// Sao lưu TRƯỚC khi ghi. Script này ghi đè name/weight/status/note của 116 dòng
// đang có — đường lùi phải tồn tại trước lượt ghi, không phải sau.
const backupPath = `backups/technical-dies-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(backupPath, JSON.stringify(existing, null, 2), 'utf8')
console.log(`\n→ đã sao lưu ${existing.length} dòng: ${backupPath}`)

console.log('… đang ghi DB')

const payload = (d, keepStatus) => ({
  code: d.code,
  name: d.name,
  weight_per_m: d.weight_per_m,
  die_price: d.die_price,
  supplier_name: d.supplier_name,
  unit: d.unit,
  status: keepStatus ?? d.status,
  part_group: d.part_group,
  profile_shape: d.profile_shape,
  alloy: d.alloy,
  holder_name: d.holder_name,
  legacy_codes: d.legacy_codes,
  duplicate_group: dupByCode.get(norm(d.code))?.cluster ?? null,
  data_confidence:
    conflictCodes.has(norm(d.code)) || d.file_count <= 1 ? 'needs_review' : 'confirmed',
  review_note: conflictCodes.has(norm(d.code))
    ? 'Các file cũ ghi số liệu khác nhau — xem sheet ĐỐI CHIẾU LỆCH'
    : d.file_count <= 1
      ? 'Mã chỉ xuất hiện ở một file nguồn — rà xem còn dùng không'
      : null,
  note: d.note,
  source_note: d.source_note,
})

let added = 0
let updated = 0
const idByCode = new Map()

for (const d of dies) {
  const list = dbByFileRow.get(d.code)
  if (list) {
    const target = list.find((m) => m.db.is_current) ?? list[0]
    const keep = d.status === 'unknown' && target.db.status === 'active' ? 'active' : null
    const { error } = await db
      .from('technical_dies')
      .update(payload(d, keep))
      .eq('id', target.db.id)
    if (error) {
      console.error(`✗ cập nhật ${d.code}: ${error.message}`)
      process.exit(1)
    }
    idByCode.set(norm(d.code), target.db.id)
    updated++
  } else {
    const { data, error } = await db
      .from('technical_dies')
      .insert(payload(d, null))
      .select('id')
      .single()
    if (error) {
      console.error(`✗ thêm ${d.code}: ${error.message}`)
      process.exit(1)
    }
    idByCode.set(norm(d.code), data.id)
    added++
  }
}
console.log(`  khuôn: +${added} mới, ${updated} cập nhật`)

// Sự kiện — xoá các dòng đã nạp từ cùng nguồn rồi ghi lại, để chạy lại không nhân đôi.
const dieIds = [...idByCode.values()]
for (let i = 0; i < dieIds.length; i += 200) {
  const { error } = await db
    .from('technical_die_events')
    .delete()
    .in('die_id', dieIds.slice(i, i + 200))
    .not('source', 'is', null)
  if (error) {
    console.error(`✗ dọn sự kiện cũ: ${error.message}`)
    process.exit(1)
  }
}

const evRows = events
  .map((e) => {
    const id = idByCode.get(norm(e.code))
    return id ? { ...e, die_id: id, code: undefined } : null
  })
  .filter(Boolean)
  .map(({ code, ...rest }) => rest)

for (let i = 0; i < evRows.length; i += 200) {
  const { error } = await db.from('technical_die_events').insert(evRows.slice(i, i + 200))
  if (error) {
    console.error(`✗ ghi sự kiện: ${error.message}`)
    process.exit(1)
  }
}
console.log(`  sự kiện: ${evRows.length} dòng`)

console.log(
  '\n✓ xong. Ảnh mặt cắt nạp bằng scripts/khuon-images.mjs (đi đường filesService).',
)
