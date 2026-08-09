// GẮN FILE BKQC từ thư mục "All Bom" vào hồ sơ SP CHƯA CÓ FILE BOM nào.
//
//   node scripts/bom-files-attach-allbom.mjs             # dry-run
//   node scripts/bom-files-attach-allbom.mjs --apply     # upload thật
//
// Khác products-bom-files.mjs (nguồn Drive, khớp qua CSV): nguồn này KHÔNG có
// CSV — khớp bằng MÃ NẰM TRONG TÊN FILE (mã cũ 21600-217 / mã HG C0005HG-AL),
// cùng luật với scripts/bom-gap-report.mjs. Chính sách giữ nguyên như script cũ
// (user chốt 26/07/2026): mỗi SP một bản riêng, file dùng chung nhiều SP thì
// upload lặp cho từng SP; chỉ đụng SP đang có 0 file BOM — SP đã có file từ đợt
// Drive thì để yên, không chồng bản.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SRC = 'C:/Users/HP/Downloads/All Bom'
const BUCKET = 'attachments'
const LIMIT = 10 * 1024 * 1024 // trần doc_type 'bom' (src/lib/file-limits.ts)
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const sb = await client(import.meta.url)

const safeName = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')

const codesOf = (f) => [
  ...(f.match(/\b\d{5}-\d{3}\b/g) ?? []),
  ...(f.match(/\b[A-Z]\d{4}HG-[A-Z]{2}\b/gi) ?? []).map((c) => c.toUpperCase()),
]

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

console.log(`\n=== GẮN FILE BKQC (All Bom) — ${APPLY ? '**APPLY**' : 'DRY-RUN'} ===\n`)

const files = readdirSync(SRC).filter((f) => /\.(xlsx|xls)$/i.test(f))
const fileByCode = new Map()
for (const f of files) {
  for (const c of codesOf(f)) {
    if (!fileByCode.has(c)) fileByCode.set(c, [])
    fileByCode.get(c).push(f)
  }
}

const products = await allRows('technical_products', 'id, code, code_legacy')
const existing = await allRows('files', 'product_id', (q) =>
  q.eq('doc_type', 'bom').is('deleted_at', null).not('product_id', 'is', null),
)
const hasBomFile = new Set(existing.map((f) => f.product_id))

const todo = []
let already = 0
for (const p of products) {
  if (hasBomFile.has(p.id)) {
    already++
    continue
  }
  const codes = [p.code, p.code_legacy].filter(Boolean).map((c) => c.toUpperCase())
  const matched = [...new Set(codes.flatMap((c) => fileByCode.get(c) ?? []))]
  for (const name of matched) {
    const full = join(SRC, name)
    const size = statSync(full).size
    if (size > LIMIT) continue
    todo.push({ ...p, name, full, size })
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1)
console.log(`SP trong hệ                 : ${products.length}`)
console.log(`SP đã có file BOM (để yên)  : ${already}`)
console.log(
  `Sẽ gắn                      : ${todo.length} file cho ${new Set(todo.map((t) => t.id)).size} SP · ${mb(todo.reduce((s, x) => s + x.size, 0))} MB`,
)
for (const t of todo.slice(0, 15)) console.log(`  + ${t.code} ← ${t.name}`)
if (todo.length > 15) console.log(`  … và ${todo.length - 15} file nữa`)

if (!APPLY) {
  console.log('\n(dry-run) Chạy lại với --apply để upload thật.')
  process.exit(0)
}

let ok = 0
const errors = []
async function one(item) {
  const path = `product/${item.id}/${randomUUID()}-${safeName(item.name)}`
  const body = readFileSync(item.full)
  const up = await sb.storage
    .from(BUCKET)
    .upload(path, body, { contentType: MIME_XLSX, upsert: false })
  if (up.error) return `storage: ${up.error.message}`
  const ins = await sb.from('files').insert({
    bucket: BUCKET,
    path,
    filename: item.name,
    mime_type: MIME_XLSX,
    size_bytes: item.size,
    product_id: item.id,
    doc_type: 'bom',
    finalized_at: new Date().toISOString(),
  })
  if (ins.error) {
    await sb.storage.from(BUCKET).remove([path])
    return `db: ${ins.error.message}`
  }
  return null
}
for (const batch of chunk(todo, 4)) {
  const rs = await Promise.all(batch.map(one))
  rs.forEach((why, i) => {
    if (why) errors.push(`${batch[i].code} ${batch[i].name}: ${why}`)
    else ok++
  })
}
console.log(
  `\n✓ Gắn được ${ok}/${todo.length} file` +
    (errors.length ? ` · lỗi ${errors.length}:` : ''),
)
for (const e of errors.slice(0, 10)) console.log('  ✗ ' + e)
