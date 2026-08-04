// NẠP THƯ VIỆN SP TỪ FILE LỆNH SẢN XUẤT của Sales (08/2026).
//
//   node scripts/lsx-products-import.mjs --plan <plan.json> --img <thư mục ảnh>
//   node scripts/lsx-products-import.mjs --plan <plan.json> --img <…> --apply
//
// Kế hoạch (`plan.json`) do bước đối chiếu sinh ra, gồm 3 phần:
//   · new         — SP chưa có trong thư viện: tạo mới, mã HG sinh theo quy ước
//                   (loại + số + HG + vật liệu khung), mã trên LSX vào
//                   `customer_item_code`.
//   · fill_code   — SP ĐÃ CÓ nhưng thiếu mã khách: chỉ điền `customer_item_code`
//                   (khớp qua TÊN nên script in ra để soát trước khi --apply).
//   · fill_image  — SP đã có mà chưa có ảnh: gắn ảnh trích từ file LSX.
//
// Ảnh lấy từ file .xlsx theo Ô NEO nên đúng dòng → đúng mã; file .xls không đọc
// được ảnh (thiếu thư viện), các SP đó tạo không ảnh, bổ sung tay sau.
//
// Idempotent: SP nhận diện theo `code`; ảnh bỏ qua nếu đã có bản cùng tên cho SP
// đó (Storage không có khoá duy nhất theo tên nên phải tự chặn).

import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { client, chunk } from './products-lib.mjs'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const arg = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const PLAN = arg('--plan')
const IMG_DIR = arg('--img')
const BUCKET = 'attachments'
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

if (!PLAN || !existsSync(PLAN)) {
  console.error('✗ thiếu --plan <đường dẫn plan.json>')
  process.exit(1)
}
const plan = JSON.parse(readFileSync(PLAN, 'utf8'))
const sanitize = (s) => s.replace(/[^A-Za-z0-9._-]+/g, '_')

const sb = await client(import.meta.url)

console.log(
  `Kế hoạch: ${plan.new.length} SP mới · ${plan.fill_code.length} điền mã khách · ` +
    `${plan.fill_image.length} bù ảnh${APPLY ? '' : '   (CHẠY THỬ — thêm --apply để ghi)'}`,
)

// ── 1. SP mới ──────────────────────────────────────────────────────────────
const codes = plan.new.map((p) => p.code)
const existing = new Set()
for (const part of chunk(codes, 200)) {
  const { data } = await sb.from('technical_products').select('code').in('code', part)
  for (const r of data ?? []) existing.add(r.code)
}

const idByCode = new Map()
let created = 0
for (const p of plan.new) {
  if (existing.has(p.code)) {
    const { data } = await sb
      .from('technical_products')
      .select('id')
      .eq('code', p.code)
      .maybeSingle()
    if (data) idByCode.set(p.code, data.id)
    continue
  }
  console.log(
    `  + ${p.code.padEnd(15)} ${String(p.customer_name).padEnd(7)} ` +
      `${String(p.customer_item_code).padEnd(28)} ${p.name.slice(0, 50)}`,
  )
  if (!APPLY) continue
  const { data, error } = await sb
    .from('technical_products')
    .insert({
      code: p.code,
      name: p.name,
      name_foreign: p.name_foreign,
      unit: p.unit || 'cái',
      barcode: p.barcode,
      customer_name: p.customer_name,
      customer_item_code: p.customer_item_code,
      product_type: p.product_type,
      frame_material: p.frame_material,
      tech_spec: p.tech_spec ?? {},
      notes: p.packing_note ? `Đóng gói theo LSX: ${p.packing_note}` : null,
      bom_status: 'none',
      is_active: true,
    })
    .select('id')
    .single()
  if (error) {
    console.error(`  ✗ ${p.code}: ${error.message}`)
    continue
  }
  idByCode.set(p.code, data.id)
  created++
}
console.log(`✓ SP mới: ${APPLY ? `${created} đã tạo` : 'chạy thử'}`)

// ── 2. Điền mã khách cho SP đã có (khớp qua TÊN — in ra để soát) ────────────
let filled = 0
for (const f of plan.fill_code) {
  console.log(
    `  ~ ${String(f.lib_code).padEnd(15)} ← mã khách ${String(f.customer_item_code).padEnd(28)}` +
      ` (khớp ${f.match} ${f.score})  ${String(f.lib_name).slice(0, 40)}`,
  )
  if (!APPLY) continue
  const { error } = await sb
    .from('technical_products')
    .update({ customer_item_code: f.customer_item_code })
    .eq('id', f.product_id)
    .is('customer_item_code', null)
  if (error) console.error(`  ✗ ${f.lib_code}: ${error.message}`)
  else filled++
}
console.log(`✓ Điền mã khách: ${APPLY ? filled : 'chạy thử'}`)

// ── 3. Ảnh ─────────────────────────────────────────────────────────────────
const imgJobs = [
  ...plan.new.filter((p) => p.image).map((p) => ({ code: p.code, image: p.image })),
  ...plan.fill_image.map((f) => ({ product_id: f.product_id, image: f.image })),
]
if (!IMG_DIR) {
  console.log('· Ảnh: bỏ qua (không truyền --img)')
} else {
  const ids = imgJobs.map((j) => j.product_id ?? idByCode.get(j.code)).filter(Boolean)
  const uploaded = new Set()
  for (const part of chunk(ids, 200)) {
    const { data } = await sb
      .from('files')
      .select('product_id, filename')
      .eq('doc_type', 'image')
      .is('deleted_at', null)
      .in('product_id', part)
    for (const f of data ?? []) uploaded.add(`${f.product_id}::${f.filename}`)
  }

  let okI = 0,
    skipI = 0,
    failI = 0
  for (const job of imgJobs) {
    const pid = job.product_id ?? idByCode.get(job.code)
    if (!pid) {
      skipI++
      continue
    }
    const src = join(IMG_DIR, job.image)
    if (!existsSync(src)) {
      skipI++
      continue
    }
    if (uploaded.has(`${pid}::${job.image}`)) {
      skipI++
      continue
    }
    if (!APPLY) {
      okI++
      continue
    }
    try {
      const buf = readFileSync(src)
      const mime = MIME[extname(job.image).toLowerCase()] ?? 'application/octet-stream'
      const path = `product/${pid}/${randomUUID()}-${sanitize(job.image)}`
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: mime, upsert: false })
      if (up.error) throw up.error
      const { data: frow, error: fe } = await sb
        .from('files')
        .insert({
          bucket: BUCKET,
          path,
          filename: job.image,
          mime_type: mime,
          size_bytes: buf.length,
          doc_type: 'image',
          product_id: pid,
          finalized_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (fe) throw fe
      await sb.from('technical_products').update({ image_file_id: frow.id }).eq('id', pid)
      okI++
    } catch (err) {
      failI++
      console.error(`  ✗ ảnh ${job.image}: ${err.message}`)
    }
  }
  console.log(
    `✓ Ảnh: ${okI} ${APPLY ? 'đã gắn' : 'sẽ gắn'}, ${skipI} bỏ qua, ${failI} lỗi`,
  )
}

console.log(APPLY ? '\nXONG.' : '\nChạy thử xong — thêm --apply để ghi thật.')
