// XOÁ TOÀN BỘ ĐỊNH MỨC sản phẩm (`technical_product_parts`) — và CHỈ bảng đó.
//
//   node scripts/parts-reset.mjs            # dry-run: chỉ đếm, KHÔNG xoá
//   node scripts/parts-reset.mjs --apply    # xoá thật (có sao lưu trước)
//
// KHÁC `products-reset.mjs`: script kia xoá sạch cả hồ sơ SP, file, đóng gói.
// Script này giữ nguyên mọi thứ khác — hồ sơ sản phẩm, món trong bộ, phương án
// đóng gói, file bản vẽ/BOM đính kèm, và cả cờ `bom_status`.
//
// Trước khi xoá luôn ghi một bản sao JSON ra `backup/` để còn nạp lại được nếu
// xoá nhầm — xoá 6.900+ dòng nạp từ file BOM gốc mà không có bản lưu thì hỏng.

import { writeFileSync, mkdirSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)

/** Lấy hết dòng theo trang — Supabase trả tối đa 1000 dòng/lần. */
async function allRows(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

console.log(
  `\n=== XOÁ ĐỊNH MỨC SẢN PHẨM — ${APPLY ? '**APPLY (xoá thật)**' : 'DRY-RUN'} ===\n`,
)

const rows = await allRows('technical_product_parts', '*')
const products = new Set(rows.map((r) => r.product_id))
console.log(`technical_product_parts : ${rows.length} dòng / ${products.size} sản phẩm`)

if (rows.length === 0) {
  console.log('\nKhông có gì để xoá.')
  process.exit(0)
}

if (!APPLY) {
  console.log('\nDRY-RUN — chưa xoá gì. Chạy lại với --apply để xoá thật.')
  process.exit(0)
}

// ── Sao lưu trước khi xoá ──────────────────────────────────────────────────
mkdirSync(new URL('../backup/', import.meta.url), { recursive: true })
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
const file = new URL(`../backup/product-parts-${stamp}.json`, import.meta.url)
writeFileSync(file, JSON.stringify(rows, null, 1), 'utf8')
console.log(`\nĐã sao lưu ${rows.length} dòng → backup/product-parts-${stamp}.json`)

// ── Xoá theo lô id ─────────────────────────────────────────────────────────
let deleted = 0
for (const ids of chunk(
  rows.map((r) => r.id),
  500,
)) {
  const { error } = await sb.from('technical_product_parts').delete().in('id', ids)
  if (error) throw new Error(`xoá lỗi: ${error.message}`)
  deleted += ids.length
  process.stdout.write(`\r  đã xoá ${deleted}/${rows.length}`)
}
console.log('')

const { count } = await sb
  .from('technical_product_parts')
  .select('id', { count: 'exact', head: true })
console.log(`\nCòn lại trong bảng: ${count} dòng`)
