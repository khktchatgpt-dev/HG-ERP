// HOÀN THIỆN LỆNH 02/26-27 - LAURA: gắn ảnh SP bóc từ file .xls + bù quy cách.
//
//   node scripts/lsx-laura02-anh.mjs --file <LSX 02.26-27 HG-LAURA.xls>           # chạy thử
//   node scripts/lsx-laura02-anh.mjs --file <LSX 02.26-27 HG-LAURA.xls> --apply   # ghi
//
// Lệnh đã nạp từ 15/09/2026 (6 khối PO, 22 dòng) và khớp file từng dòng — chỉ
// thiếu ẢNH: lượt nạp trước bóc được 28 neo, toàn ảnh rác dán chồng ở đầu phiếu,
// vì file này vượt ~8KB bản vẽ nên Excel ghi neo các hình sau vào CONTINUE sau
// OBJ (đã vá ở scripts/xls-images.mjs).
//
// Ghép ảnh → SP: ở file này ảnh neo ĐÚNG dòng SP (lệch 0) — kiểm bằng việc mỗi
// mã SP lặp ở 2–3 khối PO đều mang CÙNG MỘT ảnh, và soi mắt 9/9 ảnh đúng dáng
// (bàn Hali, sofa góc Halston, bộ Aria đan mây). Mã nào dính >1 ảnh khác nhau
// thì DỪNG, không đoán.
//
// Ảnh ghi vào HỒ SƠ SP (dòng lệnh thiếu ảnh tự lấy ảnh hồ sơ —
// `withProductImages` ở lsx-lines.service.ts), kèm dòng của lệnh này. SP đã có
// ảnh thì KHÔNG đè. Quy cách (mây/nệm/sơn) chỉ điền ô hồ sơ đang TRỐNG, bỏ qua
// chữ giữ chỗ "xác nhận sau".
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'
import { readXlsImages } from './xls-images.mjs'

const XLSX = createRequire(import.meta.url)('xlsx')
const APPLY = process.argv.includes('--apply')
const FI = process.argv.indexOf('--file')
const FILE = FI >= 0 ? process.argv[FI + 1] : null
if (!FILE) throw new Error('Thiếu --file <đường dẫn file .xls>')
const LSX_CODE = '02/26-27 - LAURA'
const BUCKET = 'attachments'
const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif' }
const ROW_OFFSET = 0

const n = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const usable = (v) => (v && !/xác nhận sau|thông báo sau/i.test(v) ? v : '')

// ── File: dòng SP (cột C = mã, H = số lượng) + ảnh neo trên dòng đó ─────────
const ws = XLSX.readFile(FILE).Sheets['Sheet1']
const cell = (col, row0) => n(ws[`${col}${row0 + 1}`]?.v)
const isLine = (row0) => /^\d{7}\.\d{2}$/.test(cell('C', row0)) && cell('H', row0) !== ''

const allImgs = readXlsImages(FILE)
// Ảnh rác: một tấm 11KB dán chồng 184 lần, rải cả trên dòng tiêu đề khối PO lẫn
// dòng SP (1708415.12). Ảnh nào từng neo ở dòng KHÔNG phải SP thì không phải ảnh SP.
const junk = new Set(
  allImgs.filter((i) => !isLine(i.row + ROW_OFFSET)).map((i) => i.index),
)
const imgsByCode = new Map()
for (const img of allImgs) {
  const r = img.row + ROW_OFFSET
  if (!isLine(r) || junk.has(img.index)) continue // logo, chữ ký, ảnh rác
  const code = cell('C', r)
  const m = imgsByCode.get(code) ?? new Map()
  m.set(img.index, img)
  imgsByCode.set(code, m)
}
const imgByCode = new Map()
for (const [code, m] of imgsByCode) {
  if (m.size > 1)
    throw new Error(`${code} mang ${m.size} ảnh khác nhau trong file — dừng, không đoán`)
  imgByCode.set(code, [...m.values()][0])
}

const specByCode = new Map()
for (let r = 0; r < 200; r++) {
  if (!isLine(r)) continue
  const code = cell('C', r)
  if (specByCode.has(code)) continue
  specByCode.set(code, {
    machine: usable(cell('I', r)),
    cushion: usable(cell('J', r)),
    paint: usable(cell('K', r)),
    glass: usable(cell('L', r)),
    wood: usable(cell('M', r)),
  })
}

// ── DB ──────────────────────────────────────────────────────────────────────
const db = await client(import.meta.url)
const { data: lsx, error: e0 } = await db
  .from('production_orders')
  .select('id, code, status')
  .eq('code', LSX_CODE)
  .single()
if (e0) throw new Error(e0.message)
const { data: lns } = await db
  .from('production_order_lines')
  .select('id, product_id, product_code, customer_item_code, image_file_id')
  .eq('production_order_id', lsx.id)
  .order('sort_order')
const { data: ps } = await db
  .from('technical_products')
  .select('id, code, tech_spec, image_file_id')
  .in('id', [...new Set(lns.map((l) => l.product_id))])
const byId = new Map(ps.map((p) => [p.id, p]))

const productOf = new Map() // mã khách → hồ sơ SP (theo dòng lệnh)
for (const l of lns) productOf.set(l.customer_item_code, byId.get(l.product_id))

console.log(
  `\n${APPLY ? '⚙ GHI THẬT' : '🔍 CHẠY THỬ'} — ${lsx.code} (${lsx.status}), ${lns.length} dòng, ${ps.length} SP`,
)
console.log(`Ảnh SP bóc được: ${imgByCode.size}`)

const jobs = []
for (const [code, p] of productOf) {
  const img = imgByCode.get(code)
  if (!img) {
    console.log(`  · ${p.code} (${code}): file không có ảnh`)
    continue
  }
  if (p.image_file_id) {
    console.log(`  = ${p.code} (${code}): hồ sơ đã có ảnh, không đè`)
    continue
  }
  jobs.push({ code, p, img })
  console.log(`  + ảnh ${p.code} ← ${code} (${img.ext}, ${img.buffer.length} byte)`)
}

const specJobs = []
for (const [code, p] of productOf) {
  const want = specByCode.get(code) ?? {}
  const ts = { ...(p.tech_spec ?? {}) }
  const add = []
  for (const [k, v] of Object.entries(want))
    if (v && !n(ts[k])) {
      ts[k] = v
      add.push(`${k}=${v}`)
    }
  if (add.length) {
    specJobs.push({ p, ts })
    console.log(`  ~ quy cách ${p.code}: ${add.join(' · ')}`)
  }
}

if (!APPLY) {
  console.log('\nThêm --apply để ghi.')
  process.exit(0)
}

for (const j of jobs) {
  const name = `LSX02-LAURA-${j.code}.${j.img.ext}`
  const path = `product/${j.p.id}/${randomUUID()}-${name}`
  const up = await db.storage
    .from(BUCKET)
    .upload(path, j.img.buffer, { contentType: MIME[j.img.ext], upsert: false })
  if (up.error) throw new Error(`${j.p.code}: ${up.error.message}`)
  const { data: f, error: fe } = await db
    .from('files')
    .insert({
      bucket: BUCKET,
      path,
      filename: name,
      mime_type: MIME[j.img.ext],
      size_bytes: j.img.buffer.length,
      doc_type: 'image',
      product_id: j.p.id,
      finalized_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (fe) throw new Error(`${j.p.code}: ${fe.message}`)
  const e1 = (
    await db.from('technical_products').update({ image_file_id: f.id }).eq('id', j.p.id)
  ).error
  if (e1) throw new Error(`${j.p.code}: ${e1.message}`)
  const e2 = (
    await db
      .from('production_order_lines')
      .update({ image_file_id: f.id })
      .eq('production_order_id', lsx.id)
      .eq('product_id', j.p.id)
      .is('image_file_id', null)
  ).error
  if (e2) throw new Error(`${j.p.code}: ${e2.message}`)
  console.log(`  ✓ ảnh ${j.p.code}`)
}
for (const s of specJobs) {
  const e = (
    await db.from('technical_products').update({ tech_spec: s.ts }).eq('id', s.p.id)
  ).error
  if (e) throw new Error(`${s.p.code}: ${e.message}`)
  console.log(`  ✓ quy cách ${s.p.code}`)
}
console.log('\n✓ Xong.')
