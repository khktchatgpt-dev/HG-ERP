// HOÀN THIỆN LỆNH 06/26-27 - MX: gắn ảnh bóc từ file .xls + rà ô còn trống.
//
//   node scripts/lsx-0626-fill.mjs           # chạy thử
//   node scripts/lsx-0626-fill.mjs --apply   # ghi
//
// Rà theo ĐÚNG bộ trường app coi là "đủ" cho phiếu lệnh (`productGaps` trong
// src/modules/dept/production/lsx-line-fill.ts): tên nước ngoài · barcode ·
// mây/nệm/sơn/kính/gỗ · đóng gói · CBM. Ghi vào HỒ SƠ SP chứ không vào dòng
// lệnh, vì dòng lệnh lấy số từ hồ sơ (`profileSnapshot`) — sửa dòng là sửa cái
// bóng, lần phát lệnh sau lại trống.
//
// Ảnh: file LSX .xls mang ảnh nhúng neo theo dòng (xem scripts/xls-images.mjs).
// CHỈ gắn cho SP đang THIẾU ảnh; SP đã có ảnh thì chỉ ĐỐI CHIẾU và báo lệch —
// đè ảnh hàng loạt là cách nhanh nhất để chôn ảnh đúng bằng ảnh sai.
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
const XLSX = createRequire(import.meta.url)('xlsx')
import { client } from './products-lib.mjs'
import { readXlsImages } from './xls-images.mjs'

const APPLY = process.argv.includes('--apply')
const FI = process.argv.indexOf('--file')
const FILE =
  (FI >= 0 ? process.argv[FI + 1] : null) ??
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/d8ab4111-9746-40bb-bd3b-53602b313719/scratchpad/lsx.xls'
const LSX_CODE = '06/26-27 - MX'
const BUCKET = 'attachments'
const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif' }

// ── Ảnh trong file, khoá theo MÃ SP đọc từ chính dòng neo ───────────────────
const ws = XLSX.readFile(FILE).Sheets['Sheet1']
const cellAt = (col, row0) => {
  const c = ws[`${col}${row0 + 1}`]
  return c ? String(c.v).trim() : ''
}
/**
 * ĐỘ LỆCH DÒNG NEO → DÒNG SP = +1 trên file này.
 *
 * Ảnh dán trồi lên nên mép trên rơi vào dòng phía trên sản phẩm. Kiểm bằng NỘI
 * DUNG chứ không đoán: ảnh neo ở dòng 26443-219 in hẳn caption "Msp 26441-217";
 * ảnh neo ở dòng "Bộ Sofa góc" là tấm 2 ghế + 2 đôn = "Bộ Lindos" ở dòng dưới;
 * ảnh neo ở dòng "Bàn tròn Delos" là ghế 5 bậc tay gỗ = "Thasos" dòng dưới.
 * Ghép theo dòng neo (lệch 0) thì CẢ 12 ảnh đều gắn nhầm sang SP liền trước.
 */
const ROW_OFFSET = 1

const imgByCode = new Map()
for (const img of readXlsImages(FILE)) {
  const code = cellAt('C', img.row + ROW_OFFSET) // cột "Mã SP" của dòng SP thật
  if (!code || !/^\d{4,6}-\d{3}$/.test(code)) continue // bỏ logo đầu phiếu + chữ ký cuối
  const cur = imgByCode.get(code)
  if (!cur || img.buffer.length > cur.buffer.length) imgByCode.set(code, img)
}
console.log(`Ảnh SP bóc được từ file: ${imgByCode.size} (lệch dòng neo +${ROW_OFFSET})`)

// ── Dòng lệnh + hồ sơ SP ────────────────────────────────────────────────────
const db = await client(import.meta.url)
const { data: lsx } = await db
  .from('production_orders')
  .select('id, code, status')
  .eq('code', LSX_CODE)
  .single()
const { data: lns } = await db
  .from('production_order_lines')
  .select('id, sort_order, product_id, product_code, customer_item_code, qty, unit')
  .eq('production_order_id', lsx.id)
  .order('sort_order')
const { data: ps } = await db
  .from('technical_products')
  .select('id, code, name_foreign, barcode, packing, tech_spec, image_file_id')
  .in(
    'id',
    lns.map((l) => l.product_id),
  )
const byId = new Map(ps.map((p) => [p.id, p]))

const { data: imgFiles } = await db
  .from('files')
  .select('id, size_bytes, filename')
  .in('id', ps.map((p) => p.image_file_id).filter(Boolean))
const fileById = new Map((imgFiles ?? []).map((f) => [f.id, f]))

// ── Việc phải làm với ảnh ───────────────────────────────────────────────────
/**
 * SP có ảnh trong hồ sơ nhưng ảnh đó ĐANG DÙNG CHUNG với SP khác (đo 20/08:
 * CH0242 "Ghế Delos" và TB0251 "Bàn Delos" cùng một tấm 9.995 byte — một ghế
 * và một bàn không thể cùng ảnh). Ảnh trong file LSX neo theo ĐÚNG DÒNG nên
 * đáng tin hơn; thay cho hai mã này. Bản ghi `files` cũ giữ nguyên, chỉ trỏ
 * `image_file_id` sang ảnh mới.
 */
const REPLACE = new Set(['TB0251HG-IR'])

const toUpload = []
const mismatch = []
for (const l of lns) {
  const p = byId.get(l.product_id)
  const img = imgByCode.get(l.customer_item_code)
  if (!img) continue
  // REPLACE chỉ nổ khi ảnh hồ sơ THỰC SỰ khác ảnh trong file — không thì mỗi
  // lần chạy lại là thêm một bản sao y hệt vào Storage.
  const already = fileById.get(p.image_file_id)?.size_bytes === img.buffer.length
  if (!p.image_file_id || (REPLACE.has(p.code) && !already))
    toUpload.push({ line: l, product: p, img })
  else {
    const cur = fileById.get(p.image_file_id)
    if (cur && Math.abs((cur.size_bytes ?? 0) - img.buffer.length) > 64)
      mismatch.push({
        code: p.code,
        ma: l.customer_item_code,
        db: cur.size_bytes,
        file: img.buffer.length,
      })
  }
}

// ── Ô còn trống theo luật của app ───────────────────────────────────────────
const gapsOf = (p) => {
  const g = []
  if (!p.name_foreign?.trim()) g.push('tên nước ngoài')
  if (!p.barcode?.trim()) g.push('barcode')
  if (!p.packing?.qty_per_carton) g.push('đóng gói')
  const k = p.packing ?? {}
  const hasDims = k.carton_l_cm != null && k.carton_w_cm != null && k.carton_h_cm != null
  if (k.cbm == null && !hasDims) g.push('CBM')
  if (!p.image_file_id) g.push('ảnh')
  return g
}

console.log(
  `\n${APPLY ? '⚙ GHI THẬT' : '🔍 CHẠY THỬ'} — lệnh ${lsx.code} (${lsx.status}), ${lns.length} dòng`,
)
console.log(
  `Sẽ gắn ảnh: ${toUpload.length} · ảnh trong file KHÁC ảnh hồ sơ: ${mismatch.length}`,
)
for (const m of mismatch)
  console.log(`   ⚠ ${m.code} (${m.ma}) hồ sơ ${m.db} byte ≠ file ${m.file} byte`)

if (APPLY) {
  for (const j of toUpload) {
    const name = `LSX0626-${j.line.customer_item_code}.${j.img.ext}`
    const path = `product/${j.product.id}/${randomUUID()}-${name}`
    const up = await db.storage
      .from(BUCKET)
      .upload(path, j.img.buffer, { contentType: MIME[j.img.ext], upsert: false })
    if (up.error) {
      console.error(`   ✗ ${j.product.code}: ${up.error.message}`)
      continue
    }
    const { data: f, error: fe } = await db
      .from('files')
      .insert({
        bucket: BUCKET,
        path,
        filename: name,
        mime_type: MIME[j.img.ext],
        size_bytes: j.img.buffer.length,
        doc_type: 'image',
        product_id: j.product.id,
        finalized_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (fe) {
      console.error(`   ✗ ${j.product.code}: ${fe.message}`)
      continue
    }
    await db
      .from('technical_products')
      .update({ image_file_id: f.id })
      .eq('id', j.product.id)
    await db
      .from('production_order_lines')
      .update({ image_file_id: f.id })
      .eq('id', j.line.id)
    j.product.image_file_id = f.id
    console.log(
      `   + ảnh ${j.product.code} ← ${j.line.customer_item_code} (${j.img.buffer.length} byte)`,
    )
  }
} else {
  for (const j of toUpload)
    console.log(
      `   + ảnh ${j.product.code} ← ${j.line.customer_item_code} (${j.img.buffer.length} byte)`,
    )
}

// ── Báo cáo ô còn trống ─────────────────────────────────────────────────────
console.log('\nÔ CÒN TRỐNG (theo bộ trường phiếu lệnh cần):')
const tally = {}
for (const l of lns) {
  const g = gapsOf(byId.get(l.product_id))
  for (const x of g) tally[x] = (tally[x] ?? 0) + 1
  if (g.length)
    console.log(
      `  ${String(l.sort_order + 1).padStart(2)} ${l.product_code.padEnd(14)} ${g.join(', ')}`,
    )
}
console.log(
  '\nTổng: ' +
    Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(' · '),
)
console.log(APPLY ? '\n✓ Xong.' : '\nThêm --apply để ghi.')
