// Nạp ẢNH MẶT CẮT KHUÔN từ file hợp nhất của Kỹ thuật lên Storage + gắn vào hồ sơ.
//
//   node scripts/khuon-images.mjs "C:/.../QUAN LY KHUON NHOM - HOP NHAT_5.xlsx"
//   node scripts/khuon-images.mjs <file.xlsx> --apply     # upload thật
//   node scripts/khuon-images.mjs <file.xlsx> --apply --force   # nạp đè ảnh đã có
//
// Vì sao tách khỏi khuon-import.mjs: ảnh phải đi qua đúng nếp của `files`
// (bucket, đường dẫn `<parent>/<id>/<uuid>-<tên>`, doc_type, finalized_at). Nhét
// chung vào lượt nạp danh mục là một lượt chạy hỏng giữa chừng để lại cả hai thứ
// dở dang — danh mục ghi rồi mà ảnh thì không.
//
// Vì sao ảnh đáng công: tổ định hình cầm cây nhôm KHÔNG có mã in trên cây. Mặt
// cắt là cách nhận dạng khuôn duy nhất ở xưởng. 170/189 mã trong file có ảnh.
//
// ⚠️ BẪY: ảnh ở đây neo MỘT ảnh MỘT DÒNG ở cột C, phải ghép theo `row` của anchor.
// KHÔNG dùng lối "lấy ảnh lớn nhất trong workbook" của luồng BOM (`readWorkbookImages`)
// — ở đó một file một ảnh, ở đây một file 170 ảnh.
//
// Chạy lại được: mã nào đã có `image_file_id` thì bỏ qua, trừ khi `--force`.
// Không import gì từ src/ để chạy được bằng `node` trần.

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import { client, chunk } from './products-lib.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const APPLY = args.includes('--apply')
const FORCE = args.includes('--force')

const BUCKET = 'attachments'
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

if (!file) {
  console.error('✗ thiếu đường dẫn file .xlsx')
  console.error('  node scripts/khuon-images.mjs "<file.xlsx>" [--apply] [--force]')
  process.exit(1)
}

const norm = (s) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

// Cùng luật với sanitizeFilename của filesService: lột dấu, chỉ giữ [A-Za-z0-9._-].
const safeName = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')

// ── 1. Bóc ảnh theo dòng ───────────────────────────────────────────────────

const wb = new ExcelJS.Workbook()
await wb.xlsx.load(readFileSync(file))
const ws = wb.getWorksheet('DANH MỤC KHUÔN')
if (!ws) {
  console.error('✗ file không có sheet "DANH MỤC KHUÔN"')
  process.exit(1)
}

const txt = (cell) => {
  const v = cell?.value
  if (v == null) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText))
      return v.richText
        .map((r) => r.text)
        .join('')
        .trim()
    return String(v.result ?? v.text ?? '').trim()
  }
  return String(v).trim()
}

const codeByRow = new Map()
ws.eachRow((row, rowNo) => {
  if (rowNo < 4) return
  const code = txt(row.getCell(2))
  if (code) codeByRow.set(rowNo, code)
})

const imagesByRow = new Map()
for (const img of ws.getImages()) {
  const excelRow = Math.round(img.range?.tl?.nativeRow ?? -1) + 1
  const media = wb.model.media?.[img.imageId] ?? wb.getImage(Number(img.imageId))
  if (excelRow <= 0 || !media?.buffer) continue
  const ext = (media.extension ?? 'png').toLowerCase()
  if (!MIME[ext]) continue
  const prev = imagesByRow.get(excelRow)
  if (!prev || media.buffer.byteLength > prev.buffer.byteLength) {
    imagesByRow.set(excelRow, { buffer: Buffer.from(media.buffer), ext })
  }
}

// ── 2. Ghép với hồ sơ khuôn trong DB ───────────────────────────────────────

const sb = await client(import.meta.url)
const { data: dies, error } = await sb
  .from('technical_dies')
  .select('id, code, legacy_codes, image_file_id')
if (error) {
  console.error(`✗ đọc technical_dies: ${error.message}`)
  process.exit(1)
}

const byCode = new Map()
for (const d of dies) {
  byCode.set(norm(d.code), d)
  for (const l of d.legacy_codes ?? []) if (!byCode.has(norm(l))) byCode.set(norm(l), d)
}

const todo = []
const noDie = []
let already = 0
for (const [rowNo, img] of imagesByRow) {
  const code = codeByRow.get(rowNo)
  const die = code ? byCode.get(norm(code)) : null
  if (!die) {
    noDie.push(`dòng ${rowNo}${code ? ` (${code})` : ''}`)
    continue
  }
  if (die.image_file_id && !FORCE) {
    already++
    continue
  }
  todo.push({ die, code, ...img })
}

const totalKb = Math.round(todo.reduce((s, t) => s + t.buffer.byteLength, 0) / 1024)
console.log(`Ảnh trong file           : ${imagesByRow.size}`)
console.log(`Ghép được vào hồ sơ khuôn: ${todo.length + already}`)
console.log(`  đã có ảnh, bỏ qua      : ${already}${FORCE ? ' (--force: vẫn nạp)' : ''}`)
console.log(`  sẽ nạp                 : ${todo.length} (${totalKb} KB)`)
console.log(`Không tìm thấy mã khuôn  : ${noDie.length}`)
if (noDie.length) console.log(`  ${noDie.slice(0, 20).join(' · ')}`)

if (!APPLY) {
  console.log('\n✓ chạy khô — chưa upload gì. Thêm --apply để nạp.')
  process.exit(0)
}

// ── 3. Upload + gắn ────────────────────────────────────────────────────────
// Ghi Storage TRƯỚC rồi mới chốt row `files`, và row hỏng thì xoá object —
// không để lại bản ghi trỏ vào object không tồn tại (cùng lối uploadFromServer).

let ok = 0
const errs = []

async function one(item) {
  const filename = `${safeName(item.code)}.${item.ext}`
  const path = `die/${item.die.id}/${randomUUID()}-${filename}`
  const mime = MIME[item.ext]

  const up = await sb.storage
    .from(BUCKET)
    .upload(path, item.buffer, { contentType: mime, upsert: false })
  if (up.error) return `storage: ${up.error.message}`

  const ins = await sb
    .from('files')
    .insert({
      bucket: BUCKET,
      path,
      filename,
      mime_type: mime,
      size_bytes: item.buffer.byteLength,
      die_id: item.die.id,
      doc_type: 'image',
      finalized_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (ins.error) {
    await sb.storage.from(BUCKET).remove([path])
    return `db files: ${ins.error.message}`
  }

  const upd = await sb
    .from('technical_dies')
    .update({ image_file_id: ins.data.id })
    .eq('id', item.die.id)
  // Ảnh đã nằm trên Storage và đã có row `files` trỏ đúng khuôn — chỉ thiếu con
  // trỏ ảnh chính. Chạy lại script là gắn được, không phải upload lại.
  if (upd.error) return `gắn image_file_id: ${upd.error.message}`

  return null
}

for (const batch of chunk(todo, 6)) {
  const rs = await Promise.all(batch.map(one))
  rs.forEach((why, i) => {
    if (why) errs.push(`${batch[i].code}: ${why}`)
    else ok++
  })
}

console.log(
  `\n✓ nạp ${ok}/${todo.length} ảnh` + (errs.length ? ` · lỗi ${errs.length}:` : ''),
)
if (errs.length) console.log('  ' + errs.slice(0, 20).join('\n  '))
