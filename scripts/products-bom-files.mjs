// Upload FILE BOM GỐC (.xlsx) lên Storage và gắn vào hồ sơ tài liệu của từng SP.
//
//   node scripts/products-bom-files.mjs --src "<đường dẫn All Bom>"           # dry-run
//   node scripts/products-bom-files.mjs --src "<đường dẫn All Bom>" --apply   # upload thật
//   ... --max-mb 2      # chỉ làm file nhỏ hơn 2 MB (chạy thử từng đợt)
//
// Mỗi SP một bản riêng (user chốt 26/07/2026): file dùng cho nhiều SP sẽ upload
// lại cho từng SP. Tốn dung lượng hơn nhưng xoá tài liệu ở SP này không làm hỏng
// đính kèm của SP khác — bảng `files` chỉ có một cột product_id.
//
// CHẠY LẠI ĐƯỢC: SP nào đã có file BOM cùng tên thì bỏ qua, không upload trùng.

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { client, chunk } from './products-lib.mjs'

const arg = (name, dflt = null) => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}
const APPLY = process.argv.includes('--apply')
const SRC = arg('--src')
const MAX_MB = Number(arg('--max-mb', '0')) || 0
if (!SRC) {
  console.error('Thiếu --src "<đường dẫn thư mục All Bom>"')
  process.exit(1)
}

const BUCKET = 'attachments'
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** Giới hạn của doc_type 'bom' trong src/lib/file-limits.ts. */
const LIMIT = 10 * 1024 * 1024

const sb = await client(import.meta.url)

/** Bỏ dấu + ký tự lạ để đường dẫn Storage an toàn (giống lúc upload ảnh). */
const safeName = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')

function readCsv(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const rows = []
  let row = [],
    cur = '',
    q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else if (c !== '\r') cur += c
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  const head = rows.shift()
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

/** Cùng quy tắc chọn bản như products-import: ưu tiên không COPY/CŨ, rồi mới nhất. */
function chosenFileByProduct(csvDir) {
  const best = new Map()
  for (const r of readCsv(join(csvDir, 'san_pham.csv'))) {
    if (!r.Ma_san_pham || !r.File) continue
    const bad = /COPY|CŨ|BẢN PHỤ/i.test(r.Trang_thai_file || '') ? 1 : 0
    const d = r.Ngay_sua_file || ''
    const p = best.get(r.Ma_san_pham)
    if (!p || bad < p.bad || (bad === p.bad && d > p.d))
      best.set(r.Ma_san_pham, { file: r.File, bad, d })
  }
  return new Map([...best.entries()].map(([k, v]) => [k, v.file]))
}

async function allRows(table, cols, filter) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

console.log(`\n=== GẮN FILE BOM VÀO SẢN PHẨM — ${APPLY ? '**APPLY**' : 'DRY-RUN'} ===\n`)

const chosen = chosenFileByProduct(join(SRC, 'DATABASE_SP', 'CSV'))
const products = await allRows('technical_products', 'id, code, code_legacy', (q) =>
  q.not('code_legacy', 'is', null),
)
// Đã có file BOM nào rồi thì không upload lại (chạy lại script an toàn).
const existing = await allRows('files', 'product_id, filename', (q) =>
  q.eq('doc_type', 'bom').not('product_id', 'is', null),
)
const had = new Set(existing.map((f) => `${f.product_id}|${f.filename}`))

const todo = []
const skip = { noCsv: 0, noDisk: 0, tooBig: 0, already: 0, tooLarge: 0 }
for (const p of products) {
  const name = chosen.get(p.code_legacy)
  if (!name || name.startsWith('(')) {
    skip.noCsv++
    continue
  }
  const full = join(SRC, name)
  if (!existsSync(full)) {
    skip.noDisk++
    continue
  }
  const size = statSync(full).size
  if (size > LIMIT) {
    skip.tooLarge++
    continue
  }
  if (MAX_MB && size > MAX_MB * 1024 * 1024) {
    skip.tooBig++
    continue
  }
  if (had.has(`${p.id}|${name}`)) {
    skip.already++
    continue
  }
  todo.push({ ...p, name, full, size })
}

const mb = (b) => (b / 1024 / 1024).toFixed(1)
const bytes = todo.reduce((s, x) => s + x.size, 0)
console.log(`Sản phẩm có mã cũ        : ${products.length}`)
console.log(`Sẽ upload                : ${todo.length} file · ${mb(bytes)} MB`)
console.log(
  `Bỏ qua                   : chưa có file BOM ${skip.noCsv} · không thấy trên đĩa ${skip.noDisk}` +
    ` · đã gắn rồi ${skip.already} · quá 10 MB ${skip.tooLarge}` +
    (MAX_MB ? ` · lớn hơn ${MAX_MB} MB ${skip.tooBig}` : ''),
)

if (!APPLY) {
  console.log('\n(dry-run) Chạy lại với --apply để upload thật.')
  process.exit(0)
}

let ok = 0,
  fail = 0,
  done = 0
const errors = []

/** Upload + ghi bản ghi files. Trả 'ok' | 'fail'. */
async function one(item) {
  const path = `product/${item.id}/${randomUUID()}-${safeName(item.name)}`
  const body = readFileSync(item.full)
  const up = await sb.storage
    .from(BUCKET)
    .upload(path, body, { contentType: MIME, upsert: false })
  if (up.error) return { r: 'fail', why: `storage: ${up.error.message}` }

  const ins = await sb.from('files').insert({
    bucket: BUCKET,
    path,
    filename: item.name,
    mime_type: MIME,
    size_bytes: item.size,
    product_id: item.id,
    doc_type: 'bom',
    finalized_at: new Date().toISOString(),
  })
  if (ins.error) {
    // Ghi DB lỗi thì dọn object vừa lên, không để rác trong Storage.
    await sb.storage.from(BUCKET).remove([path])
    return { r: 'fail', why: `db: ${ins.error.message}` }
  }
  return { r: 'ok' }
}

// Chạy 4 file một lúc — nhanh hơn tuần tự mà không dồn quá nhiều vào Storage.
for (const batch of chunk(todo, 4)) {
  const res = await Promise.all(batch.map((it) => one(it).catch((e) => ({ r: 'fail', why: e.message }))))
  res.forEach((x, i) => {
    if (x.r === 'ok') ok++
    else {
      fail++
      if (errors.length < 10) errors.push(`${batch[i].code}: ${x.why}`)
    }
  })
  done += batch.length
  if (done % 20 === 0 || done === todo.length)
    console.log(`  … ${done}/${todo.length} (ok ${ok}, lỗi ${fail})`)
  // Hết hạn mức thì dừng sớm, đừng đập đầu vào tường 200 lần nữa.
  if (fail >= 5 && ok === 0) {
    console.error('\nDừng sớm: 5 file đầu đều lỗi — xem lý do bên dưới.')
    break
  }
}

console.log(`\n✓ Đã gắn ${ok} file BOM${fail ? `, lỗi ${fail}` : ''}`)
if (errors.length) {
  console.log('Lý do lỗi (tối đa 10):')
  errors.forEach((e) => console.log('  -', e))
}
