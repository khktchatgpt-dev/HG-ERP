// XỬ LÝ CHẤT LƯỢNG ảnh mặt cắt khuôn rồi nạp đè lên hồ sơ.
//
//   node scripts/khuon-images-enhance.mjs "C:/.../QUAN LY KHUON NHOM - HOP NHAT_5.xlsx"
//   node scripts/khuon-images-enhance.mjs <file.xlsx> --apply
//   node scripts/khuon-images-enhance.mjs <file.xlsx> --apply --force   # làm lại cả ảnh đã xử lý
//   node scripts/khuon-images-enhance.mjs <file.xlsx> --sample out.png  # chỉ xuất tờ so sánh
//
// ⚠️ KHÔNG THÊM ĐƯỢC NÉT MÀ BẢN GỐC KHÔNG CÓ. Ảnh nhúng trong file của Kỹ thuật
// là 150×103 px (trung vị, đo trên 167 tấm). Việc ở đây KHÔNG phải "làm nét" —
// mà là sửa hai thứ HỎNG THẬT, đo được:
//
//  1. NÉT VẼ KHÔNG PHẢI MÀU ĐEN. Đo 13/09/2026: có ảnh 0.0% điểm tối, toàn xám
//     nhạt; 130–256 mức xám khác nhau. Đó là vì ảnh bị thu nhỏ rồi nén, mực bị
//     hoà vào giấy. Kéo giãn mức xám (`normalise`) đưa mực về đen và giấy về
//     trắng — đây là chỗ ăn tiền nhất, nhìn bằng mắt thấy ngay.
//  2. TRÌNH DUYỆT PHẢI TỰ PHÓNG. Lưu sẵn bản ×3 thì nó không phải nội suy nữa.
//
// CỬA CHẶN (đã trả giá khi thử): vài tấm là ảnh NỀN TỐI (nét trắng trên nền đen
// hoặc ảnh chụp có nền chuyển màu). `normalise` trên những tấm đó kéo ngược tương
// phản thành một khối đen đặc — hỏng hẳn. Nên chỉ xử lý ảnh có nền SÁNG; còn lại
// giữ nguyên bản gốc và nói ra ở bản kê.
//
// Bản gốc KHÔNG bị xoá: ảnh xử lý là một file MỚI, `image_file_id` trỏ sang nó.
// Muốn lùi thì trỏ lại file cũ — vẫn còn nguyên trên Storage.

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { client, chunk } from './products-lib.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const APPLY = args.includes('--apply')
const FORCE = args.includes('--force')
const samplePath = args.includes('--sample') ? args[args.indexOf('--sample') + 1] : null

const BUCKET = 'attachments'
const SCALE = 3
/** Hậu tố đánh dấu bản đã xử lý — cũng là cách nhận ra để không làm lại. */
const SUFFIX = '-x3'

if (!file) {
  console.error('✗ thiếu đường dẫn file .xlsx')
  process.exit(1)
}

const norm = (s) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const safeName = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')

/**
 * Ảnh này có xử lý được không.
 *
 * Điều kiện: nền SÁNG (trung vị ≥ 200) và có mực thật (≥0,3% điểm dưới ngưỡng).
 * Nền tối thì `normalise` làm hỏng; không có mực thì chẳng có gì để kéo.
 */
async function judge(buf) {
  const { data } = await sharp(buf)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const sorted = Uint8Array.from(data).sort()
  const median = sorted[Math.floor(sorted.length / 2)]
  let ink = 0
  for (const v of data) if (v < 160) ink++
  const inkPct = (ink / data.length) * 100
  if (median < 200)
    return { ok: false, why: `nền tối (trung vị ${median})`, median, inkPct }
  if (inkPct < 0.3)
    return {
      ok: false,
      why: `gần như không có nét (${inkPct.toFixed(2)}%)`,
      median,
      inkPct,
    }
  return { ok: true, why: '', median, inkPct }
}

/**
 * Kéo giãn mức xám rồi phóng ×3 bằng lanczos3.
 *
 * KHÔNG nhị phân hoá (`threshold`): thử rồi — nét mảnh 1px bị đứt thành chấm, và
 * chữ số kích thước (cao 5–6px) dính lại thành cục. KHÔNG `sharpen` sau khi
 * phóng: làm viền nét sáng lên, tổng thể nhạt đi chứ không sắc thêm.
 */
async function enhance(buf) {
  const md = await sharp(buf).metadata()
  return sharp(buf)
    .greyscale()
    .normalise()
    .resize(md.width * SCALE, md.height * SCALE, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// ── Bóc ảnh theo dòng, ghép với mã khuôn ──────────────────────────────────

const wb = new ExcelJS.Workbook()
await wb.xlsx.load(readFileSync(file))
const ws = wb.getWorksheet('DANH MỤC KHUÔN')

const txt = (cell) => {
  const v = cell?.value
  if (v == null) return ''
  if (typeof v === 'object')
    return v.richText
      ? v.richText
          .map((r) => r.text)
          .join('')
          .trim()
      : String(v.result ?? v.text ?? '').trim()
  return String(v).trim()
}

const codeByRow = new Map()
ws.eachRow((row, n) => {
  if (n < 4) return
  const c = txt(row.getCell(2))
  if (c) codeByRow.set(n, c)
})

const byRow = new Map()
for (const img of ws.getImages()) {
  const r = Math.round(img.range?.tl?.nativeRow ?? -1) + 1
  const media = wb.model.media?.[img.imageId] ?? wb.getImage(Number(img.imageId))
  if (r <= 0 || !media?.buffer) continue
  const prev = byRow.get(r)
  if (!prev || media.buffer.byteLength > prev.byteLength)
    byRow.set(r, Buffer.from(media.buffer))
}

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

// Ảnh nào đang gắn vào hồ sơ, tên file là gì — để biết đã xử lý chưa.
const currentIds = dies.map((d) => d.image_file_id).filter(Boolean)
const currentName = new Map()
for (const part of chunk(currentIds, 200)) {
  const { data } = await sb.from('files').select('id, filename').in('id', part)
  for (const f of data ?? []) currentName.set(f.id, f.filename)
}

const todo = []
const skipped = []
for (const [rowNo, buf] of byRow) {
  const code = codeByRow.get(rowNo)
  const die = code ? byCode.get(norm(code)) : null
  if (!die) continue
  const already =
    die.image_file_id && (currentName.get(die.image_file_id) ?? '').includes(SUFFIX)
  if (already && !FORCE) {
    skipped.push({ code, why: 'đã xử lý rồi' })
    continue
  }
  const verdict = await judge(buf)
  if (!verdict.ok) {
    skipped.push({ code, why: verdict.why })
    continue
  }
  todo.push({ die, code, buf })
}

console.log(`Ảnh ghép được với hồ sơ : ${todo.length + skipped.length}`)
console.log(`  sẽ xử lý + nạp đè     : ${todo.length}`)
console.log(`  bỏ qua                : ${skipped.length}`)
for (const s of skipped.slice(0, 20)) console.log(`      ${s.code}: ${s.why}`)

// ── Tờ so sánh trước/sau, để người duyệt nhìn trước khi ghi ────────────────
if (samplePath) {
  const picks = todo.slice(0, 4)
  const rows = []
  for (const t of picks) {
    const md = await sharp(t.buf).metadata()
    const before = await sharp(t.buf)
      .resize(md.width * SCALE, md.height * SCALE, { kernel: 'nearest' })
      .png()
      .toBuffer()
    const after = await enhance(t.buf)
    const [mb, ma] = await Promise.all([
      sharp(before).metadata(),
      sharp(after).metadata(),
    ])
    rows.push(
      await sharp({
        create: {
          width: mb.width + ma.width + 16,
          height: Math.max(mb.height, ma.height),
          channels: 3,
          background: '#ffffff',
        },
      })
        .composite([
          { input: before, left: 0, top: 0 },
          { input: after, left: mb.width + 16, top: 0 },
        ])
        .png()
        .toBuffer(),
    )
  }
  const metas = await Promise.all(rows.map((r) => sharp(r).metadata()))
  let y = 0
  const comps = rows.map((r, i) => {
    const c = { input: r, left: 0, top: y }
    y += metas[i].height + 18
    return c
  })
  await sharp({
    create: {
      width: Math.max(...metas.map((m) => m.width)),
      height: y,
      channels: 3,
      background: '#eef0f4',
    },
  })
    .composite(comps)
    .png()
    .toFile(samplePath)
  console.log(`\n→ tờ so sánh (trái = gốc, phải = đã xử lý): ${samplePath}`)
}

if (!APPLY) {
  console.log('\n✓ chạy khô — chưa ghi gì. Thêm --apply để nạp đè.')
  process.exit(0)
}

// ── Xử lý + nạp ───────────────────────────────────────────────────────────

let ok = 0
const errs = []

async function one(item) {
  const out = await enhance(item.buf)
  const filename = `${safeName(item.code)}${SUFFIX}.png`
  const path = `die/${item.die.id}/${randomUUID()}-${filename}`

  const up = await sb.storage
    .from(BUCKET)
    .upload(path, out, { contentType: 'image/png', upsert: false })
  if (up.error) return `storage: ${up.error.message}`

  const ins = await sb
    .from('files')
    .insert({
      bucket: BUCKET,
      path,
      filename,
      mime_type: 'image/png',
      size_bytes: out.byteLength,
      die_id: item.die.id,
      doc_type: 'image',
      note: 'Bản xử lý: kéo giãn mức xám + phóng ×3. Bản gốc vẫn còn.',
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
  if (upd.error) return `gắn image_file_id: ${upd.error.message}`
  return null
}

for (const batch of chunk(todo, 5)) {
  const rs = await Promise.all(batch.map(one))
  rs.forEach((why, i) => {
    if (why) errs.push(`${batch[i].code}: ${why}`)
    else ok++
  })
}

console.log(
  `\n✓ xử lý + nạp ${ok}/${todo.length} ảnh` +
    (errs.length ? ` · lỗi ${errs.length}:` : ''),
)
if (errs.length) console.log('  ' + errs.slice(0, 20).join('\n  '))
