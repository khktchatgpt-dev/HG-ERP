/**
 * Dump toàn bộ `technical_product_parts` ra file trước khi xoá làm lại theo cấu
 * trúc BOM mới (kế hoạch: docs/dinh-muc-redesign-plan.md, quyết định D1).
 *
 *   node scripts/backup-product-parts.mjs
 *
 * Xuất 2 file vào supabase/backups/:
 *   - <ts>_technical_product_parts.json  nguyên bản mọi cột (để nạp lại nếu cần)
 *   - <ts>_technical_product_parts.csv   để mở bằng Excel mà tra tay
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

/** Kéo hết bảng theo trang 1000 dòng — `select()` mặc định chặn ở 1000. */
async function fetchAll(table, order = 'id') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order(order)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) return out
  }
}

const parts = await fetchAll('technical_product_parts')
const products = await fetchAll('technical_products', 'code')

// Gắn kèm mã + tên SP để file backup đọc được mà không cần join lại.
const byId = new Map(products.map((p) => [p.id, p]))
const rows = parts.map((p) => ({
  product_code: byId.get(p.product_id)?.code ?? null,
  product_name: byId.get(p.product_id)?.name ?? null,
  ...p,
}))

mkdirSync('supabase/backups', { recursive: true })
const stamp = new Date().toISOString().slice(0, 10)
const base = `supabase/backups/${stamp}_technical_product_parts`

writeFileSync(`${base}.json`, JSON.stringify(rows, null, 2), 'utf8')

const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
const esc = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
writeFileSync(
  `${base}.csv`,
  ['﻿' + cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join(
    '\n',
  ),
  'utf8',
)

const productIds = new Set(parts.map((p) => p.product_id))
console.log(`parts   : ${rows.length} dòng / ${productIds.size} SP`)
console.log(`cột     : ${cols.length}`)
console.log(`đã ghi  : ${base}.json`)
console.log(`          ${base}.csv`)
