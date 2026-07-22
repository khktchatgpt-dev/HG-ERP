// Import thư viện SP cũ (Hoanggia) -> Supabase technical_products + files/Storage.
// Dry-run mặc định (KHÔNG ghi). Thêm --apply để ghi thật.
//
//   node scripts/import-products.mjs --manifest <path>            # dry-run
//   node scripts/import-products.mjs --manifest <path> --apply    # ghi thật
//   node scripts/import-products.mjs --manifest <path> --apply --only C0113HG-AL,C0170HG-AL
//
// Quy tắc: code = mã HG. Gộp bản trùng thật về mã HG. Idempotent theo code +
// tên file (chạy lại không nhân đôi). Đọc NEXT_PUBLIC_SUPABASE_URL +
// SUPABASE_SECRET_KEY từ env hoặc .env.local (bypass RLS bằng secret key).

import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const arg = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const MANIFEST = arg('--manifest')
const ONLY = arg('--only') ? new Set(arg('--only').split(',')) : null
if (!MANIFEST) {
  console.error('✗ cần --manifest <đường dẫn product-import-manifest.json>')
  process.exit(1)
}

const BUCKET = 'attachments'
// Gộp thủ công 2 bản trùng thật (mã KH cũ -> mã HG). Xem quy tắc mã SP.
const MERGE_OLD_CODE = { 'C0170HG-AL': '22014-307', 'C0176HG-AL': '22060-217' }

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.dwg': 'application/acad',
  '.dxf': 'application/dxf',
  '.skp': 'application/octet-stream',
  '.layout': 'application/octet-stream',
}
const mimeOf = (name) => MIME[extname(name).toLowerCase()] || 'application/octet-stream'
const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('✗ thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

function toRow(p) {
  return {
    code: p.code,
    name: p.name,
    category: p.name_kh || null, // thư viện quản như thư mục
    customer_id: null, // KHÔNG gắn khách trong thư viện
    customer_item_code: p.customer_item_code || null,
    description_en: p.description_en || null,
    notes: p.notes || null,
    material: p.material || null,
    unit: 'cai',
    packing: p.packing || {},
    bom_status: p.bom_status || 'none',
  }
}

function filesOf(p) {
  const out = []
  if (!p.files) return out
  if (p.files.image) out.push({ ...p.files.image, doc_type: 'image', role: 'image' })
  for (const d of p.files.drawings)
    out.push({ ...d, doc_type: 'drawing', role: 'drawing' })
  for (const b of p.files.bom) out.push({ ...b, doc_type: 'bom', role: 'bom' })
  // BỎ nhóm "others": lẫn file rác (exe/pptx/crdownload). Chỉ import ảnh+vẽ+BOM.
  return out
}

async function main() {
  const { data: existing, error } = await sb
    .from('technical_products')
    .select('id, code, customer_item_code, name, category, image_file_id')
  if (error) throw error
  const byCode = new Map(existing.map((e) => [e.code, e]))

  const plan = []
  for (const p of manifest) {
    if (ONLY && !ONLY.has(p.code)) continue
    let action = 'create',
      target = null
    if (byCode.has(p.code)) {
      action = 'update'
      target = byCode.get(p.code)
    } else if (MERGE_OLD_CODE[p.code] && byCode.has(MERGE_OLD_CODE[p.code])) {
      action = 'merge'
      target = byCode.get(MERGE_OLD_CODE[p.code])
    }
    plan.push({ p, action, target, files: filesOf(p) })
  }

  const c = { create: 0, update: 0, merge: 0, files: 0, bytes: 0 }
  for (const it of plan) {
    c[it.action]++
    c.files += it.files.length
    for (const f of it.files) c.bytes += f.size || 0
  }

  console.log(
    `\n=== IMPORT ${APPLY ? '**APPLY (ghi thật)**' : 'DRY-RUN (không ghi)'} ===`,
  )
  console.log(
    `SP: create=${c.create} update=${c.update} merge=${c.merge} (tổng ${plan.length})`,
  )
  console.log(`File dự kiến: ${c.files} (~${(c.bytes / 1048576).toFixed(1)} MB)`)
  console.log(
    `Merge: ${
      plan
        .filter((x) => x.action === 'merge')
        .map((x) => x.p.code + '←' + x.target.code)
        .join(', ') || '(không)'
    }`,
  )

  if (!APPLY) {
    console.log('\n(dry-run) 8 SP đầu:')
    for (const it of plan.slice(0, 8)) {
      const r = toRow(it.p)
      console.log(
        `  [${it.action}] ${r.code} — ${r.name.slice(0, 34)} | cat=${r.category} | ${it.files.length} file`,
      )
    }
    console.log('\nChạy lại với --apply để ghi thật.')
    return
  }

  let okP = 0,
    okF = 0,
    skipF = 0,
    failF = 0
  for (const it of plan) {
    const row = toRow(it.p)
    let productId
    try {
      if (it.action === 'create') {
        const { data, error } = await sb
          .from('technical_products')
          .insert(row)
          .select('id')
          .single()
        if (error) throw error
        productId = data.id
      } else {
        productId = it.target.id
        const patch = {
          code: row.code,
          category: row.category,
          bom_status: row.bom_status,
        }
        for (const k of ['customer_item_code', 'description_en', 'notes', 'material']) {
          if (row[k] && !it.target[k]) patch[k] = row[k]
        }
        if (row.packing && Object.keys(row.packing).length) patch.packing = row.packing
        const { error } = await sb
          .from('technical_products')
          .update(patch)
          .eq('id', productId)
        if (error) throw error
      }
      okP++
    } catch (e) {
      console.error(`✗ SP ${row.code}: ${e.message}`)
      continue
    }

    const { data: had } = await sb
      .from('files')
      .select('id, filename')
      .eq('product_id', productId)
      .is('deleted_at', null)
    const haveNames = new Set((had || []).map((f) => f.filename))
    let imageFileId = it.target?.image_file_id || null

    for (const f of it.files) {
      if (haveNames.has(f.filename)) {
        if (f.role === 'image' && !imageFileId)
          imageFileId =
            (had.find((x) => x.filename === f.filename) || {}).id || imageFileId
        skipF++
        continue
      }
      try {
        const buf = readFileSync(f.path)
        const path = `product/${productId}/${randomUUID()}-${sanitize(f.filename)}`
        const up = await sb.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: mimeOf(f.filename), upsert: false })
        if (up.error) throw up.error
        const { data: frow, error: ferr } = await sb
          .from('files')
          .insert({
            bucket: BUCKET,
            path,
            filename: f.filename,
            mime_type: mimeOf(f.filename),
            size_bytes: buf.length,
            owner_id: null,
            doc_type: f.doc_type,
            product_id: productId,
            finalized_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        if (ferr) throw ferr
        if (f.role === 'image' && !imageFileId) imageFileId = frow.id
        okF++
      } catch (e) {
        console.error(`  ✗ file ${f.filename} (${row.code}): ${e.message}`)
        failF++
      }
    }

    if (imageFileId && !it.target?.image_file_id) {
      await sb
        .from('technical_products')
        .update({ image_file_id: imageFileId })
        .eq('id', productId)
    }
    console.log(`✓ [${it.action}] ${row.code} (${it.files.length} file)`)
  }
  console.log(`\nXONG: SP ok=${okP} | file upload=${okF} skip=${skipF} fail=${failF}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
