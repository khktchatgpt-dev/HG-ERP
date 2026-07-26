// XOÁ TOÀN BỘ dữ liệu sản phẩm kỹ thuật trên Supabase, để nạp lại từ file BOM.
//
//   node scripts/products-reset.mjs            # dry-run: chỉ đếm, KHÔNG xoá
//   node scripts/products-reset.mjs --apply    # xoá thật
//   node scripts/products-reset.mjs --apply --keep-files   # giữ file đính kèm
//
// Thứ tự xoá đi từ bảng con lên bảng cha để không vướng khoá ngoại:
//   files (+ object trong Storage) → technical_packages → technical_packing_options
//   → technical_product_set_items → technical_product_parts → technical_bom_lines
//   → technical_products
//
// SẢN PHẨM ĐANG ĐƯỢC CHỨNG TỪ THAM CHIẾU THÌ GIỮ LẠI (user chốt 26/07/2026):
// sales_quote_lines, sales_order_lines, technical_samples đều khoá ngoại
// RESTRICT — xoá sẽ hỏng chứng từ. Script tự dò, bỏ qua và in danh sách. Phần hồ
// sơ + định mức của chính những SP đó vẫn bị xoá sạch, nên lần nạp lại vẫn ghi
// đè được (products-import.mjs upsert theo code).

import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const KEEP_FILES = process.argv.includes('--keep-files')
const sb = await client(import.meta.url)

const count = async (table, filter) => {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count: c, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  return c ?? 0
}

/** Lấy hết id theo trang — Supabase trả tối đa 1000 dòng/lần. */
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

console.log(
  `\n=== XOÁ DỮ LIỆU SẢN PHẨM — ${APPLY ? '**APPLY (xoá thật)**' : 'DRY-RUN'} ===\n`,
)

// ── 1. Sản phẩm bị chứng từ giữ lại ────────────────────────────────────────
const blocked = new Map() // product_id -> [lý do]
for (const [table, col, label] of [
  ['sales_quote_lines', 'product_id', 'báo giá'],
  ['sales_order_lines', 'product_id', 'đơn hàng'],
  ['technical_samples', 'product_id', 'mẫu'],
  ['technical_product_set_items', 'item_product_id', 'là món trong bộ khác'],
]) {
  const rows = await allRows(table, col, (q) => q.not(col, 'is', null))
  for (const r of rows) {
    const id = r[col]
    if (!id) continue
    const cur = blocked.get(id) ?? []
    if (!cur.includes(label)) cur.push(label)
    blocked.set(id, cur)
  }
}

const products = await allRows('technical_products', 'id, code, code_legacy, name')
const keep = products.filter((p) => blocked.has(p.id))
const drop = products.filter((p) => !blocked.has(p.id))

console.log(
  `Sản phẩm: ${products.length} — xoá ${drop.length}, giữ ${keep.length} (bị chứng từ tham chiếu)`,
)
if (keep.length) {
  for (const p of keep.slice(0, 40))
    console.log(
      `   giữ: ${p.code}${p.code_legacy ? ` (${p.code_legacy})` : ''} — ${blocked.get(p.id).join(', ')}`,
    )
  if (keep.length > 40) console.log(`   … và ${keep.length - 40} SP nữa`)
}

// ── 2. Đếm dữ liệu con ─────────────────────────────────────────────────────
const parts = await count('technical_product_parts')
const setItems = await count('technical_product_set_items')
const packOpts = await count('technical_packing_options')
const packages = await count('technical_packages')
const bomLines = await count('technical_bom_lines')
const fileRows = await allRows('files', 'id, bucket, path', (q) =>
  q.not('product_id', 'is', null),
)

console.log(
  `Định mức ${parts} · món trong bộ ${setItems} · phương án đóng gói ${packOpts} · kiện ${packages} · BOM kho ${bomLines}`,
)
console.log(
  `File gắn sản phẩm: ${fileRows.length}${KEEP_FILES ? ' (GIỮ LẠI theo --keep-files)' : ' — xoá cả object trong Storage'}`,
)

if (!APPLY) {
  console.log('\n(dry-run) Chạy lại với --apply để xoá thật.')
  process.exit(0)
}

// ── 3. Xoá ─────────────────────────────────────────────────────────────────
const del = async (table, col, ids) => {
  let n = 0
  for (const part of chunk(ids, 200)) {
    const { error, count: c } = await sb
      .from(table)
      .delete({ count: 'exact' })
      .in(col, part)
    if (error) throw new Error(`${table}: ${error.message}`)
    n += c ?? 0
  }
  return n
}

// Ảnh đại diện trỏ vào files (on delete set null) — gỡ trước cho sạch, không
// để lần nạp sau nhìn thấy id đã chết.
if (!KEEP_FILES) {
  const { error } = await sb
    .from('technical_products')
    .update({ image_file_id: null })
    .not('image_file_id', 'is', null)
  if (error) console.error(`  ! gỡ image_file_id: ${error.message}`)
}

if (!KEEP_FILES && fileRows.length) {
  const byBucket = new Map()
  for (const f of fileRows)
    byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path])
  for (const [bucket, paths] of byBucket) {
    for (const part of chunk(paths, 100)) {
      const { error } = await sb.storage.from(bucket).remove(part)
      if (error) console.error(`  ! Storage ${bucket}: ${error.message}`)
    }
  }
  console.log(`✓ Storage: đã xoá ${fileRows.length} object`)
  console.log(
    `✓ files: ${await del(
      'files',
      'id',
      fileRows.map((f) => f.id),
    )} dòng`,
  )
}

const allIds = products.map((p) => p.id)
console.log(
  `✓ technical_packages: ${await del(
    'technical_packages',
    'option_id',
    (await allRows('technical_packing_options', 'id')).map((o) => o.id),
  )} dòng`,
)
console.log(
  `✓ technical_packing_options: ${await del('technical_packing_options', 'product_id', allIds)} dòng`,
)
console.log(
  `✓ technical_product_set_items: ${await del('technical_product_set_items', 'set_product_id', allIds)} dòng`,
)
console.log(
  `✓ technical_product_parts: ${await del('technical_product_parts', 'product_id', allIds)} dòng`,
)
console.log(
  `✓ technical_bom_lines: ${await del('technical_bom_lines', 'product_id', allIds)} dòng`,
)
console.log(
  `✓ technical_products: ${await del(
    'technical_products',
    'id',
    drop.map((p) => p.id),
  )} sản phẩm`,
)

console.log(
  `\nXONG. Còn lại ${keep.length} sản phẩm bị chứng từ giữ (đã sạch hồ sơ + định mức).` +
    `\nBước tiếp: node scripts/products-import.mjs --src "<đường dẫn DATABASE_SP>" --apply`,
)
