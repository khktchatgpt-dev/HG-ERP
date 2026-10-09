// XOÁ thư viện sản phẩm, CHỈ GIỮ sản phẩm có mặt trên lệnh sản xuất (08/10/2026).
//
//   node scripts/products-prune-theo-lenh-1008.mjs                 # dry-run: đếm, KHÔNG xoá
//   node scripts/products-prune-theo-lenh-1008.mjs --apply         # xoá thật (sao lưu JSON trước)
//
// Cờ tuỳ chọn:
//   --only-active    chỉ coi lệnh CHƯA hoàn thành (approved/in_progress…) là "hiện tại";
//                    mặc định giữ SP của MỌI lệnh, kể cả lệnh completed.
//   --drop-blocked   SP bị báo giá / đơn bán / mẫu giữ (FK RESTRICT) thì XOÁ LUÔN
//                    dòng báo giá + mẫu đó; mặc định GIỮ SP ấy lại và in danh sách.
//   --delete-files   xoá cả dòng `files` + object trên Storage của SP bị xoá;
//                    mặc định để nguyên (FK set null → file mồ côi, còn khôi phục được).
//
// "Liên quan lệnh" = có trong production_order_lines (theo product_id HOẶC product_code /
// code_legacy), supply_lsx_material_plan, production_order_boms. SP là món trong bộ được
// giữ (hoặc bộ chứa món được giữ) cũng giữ theo.
//
// Sao lưu: backups/products-prune-1008-<ts>.json — mọi cột của SP bị xoá + parts, clusters,
// packing_options (+ packages), set_items, revisions, files (dòng). Nạp lại bằng cách
// insert ngược thứ tự. Storage object KHÔNG có trong backup — vì vậy --delete-files mặc
// định tắt.

import { writeFileSync, mkdirSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const ONLY_ACTIVE = argv.includes('--only-active')
const DROP_BLOCKED = argv.includes('--drop-blocked')
const DELETE_FILES = argv.includes('--delete-files')
const sb = await client(import.meta.url)

async function all(table, cols, filter) {
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
const inIds = (table, col, ids, cols = '*') =>
  Promise.all(
    chunk(ids, 200).map((part) => all(table, cols, (q) => q.in(col, part))),
  ).then((r) => r.flat())
async function del(table, col, ids) {
  let n = 0
  for (const part of chunk(ids, 200)) {
    const { error, count } = await sb.from(table).delete({ count: 'exact' }).in(col, part)
    if (error) throw new Error(`${table}: ${error.message}`)
    n += count ?? 0
  }
  return n
}

console.log(
  `\n=== XOÁ THƯ VIỆN SP, GIỮ SP TRÊN LỆNH — ${APPLY ? '**APPLY (xoá thật)**' : 'DRY-RUN'} ===`,
)
console.log(
  `   lệnh tính: ${ONLY_ACTIVE ? 'CHƯA hoàn thành' : 'TẤT CẢ (kể cả completed)'} · SP bị chứng từ giữ: ${
    DROP_BLOCKED ? 'XOÁ cả chứng từ' : 'GIỮ lại'
  } · file đính kèm: ${DELETE_FILES ? 'XOÁ + Storage' : 'giữ nguyên'}\n`,
)

// ── 1. Tập giữ ──────────────────────────────────────────────────────────────
const products = await all('technical_products', '*')
const byId = new Map(products.map((p) => [p.id, p]))
const byCode = new Map(products.map((p) => [p.code, p]))
for (const p of products) if (p.code_legacy) byCode.set(p.code_legacy, p)

const lsxAll = await all('production_orders', 'id, code, status')
const lsx = ONLY_ACTIVE
  ? lsxAll.filter((l) => !['completed', 'cancelled', 'rejected'].includes(l.status))
  : lsxAll
const lsxIds = new Set(lsx.map((l) => l.id))
const lsxById = new Map(lsx.map((l) => [l.id, l]))

const keep = new Map() // product_id -> Set(lý do)
const add = (pid, code, lsxId) => {
  if (!lsxIds.has(lsxId)) return
  let p = pid ? byId.get(pid) : null
  if (!p && code) p = byCode.get(code.trim())
  if (!p) return
  const s = keep.get(p.id) ?? new Set()
  s.add(lsxById.get(lsxId).code)
  keep.set(p.id, s)
}
for (const r of await all(
  'production_order_lines',
  'production_order_id, product_id, product_code',
))
  add(r.product_id, r.product_code, r.production_order_id)
for (const r of await all(
  'supply_lsx_material_plan',
  'production_order_id, product_id, product_code',
))
  add(r.product_id, r.product_code, r.production_order_id)
for (const r of await all('production_order_boms', 'production_order_id, product_id'))
  add(r.product_id, null, r.production_order_id)

const setItems = await all('technical_product_set_items', '*', (q) =>
  q.not('item_product_id', 'is', null),
)
for (const s of setItems) {
  if (keep.has(s.set_product_id) && !keep.has(s.item_product_id))
    keep.set(s.item_product_id, new Set(['món của bộ đang giữ']))
  if (keep.has(s.item_product_id) && !keep.has(s.set_product_id))
    keep.set(s.set_product_id, new Set(['bộ chứa món đang giữ']))
}

// ── 2. SP bị chứng từ khác giữ (FK RESTRICT) ────────────────────────────────
const RESTRICT = [
  ['sales_quote_lines', 'product_id', 'báo giá'],
  ['sales_order_lines', 'product_id', 'đơn bán'],
  ['technical_samples', 'product_id', 'mẫu'],
]
const blocked = new Map()
for (const [t, col, label] of RESTRICT) {
  for (const r of await all(t, `id, ${col}`, (q) => q.not(col, 'is', null))) {
    const s = blocked.get(r[col]) ?? []
    s.push({ table: t, id: r.id, label })
    blocked.set(r[col], s)
  }
}

let drop = products.filter((p) => !keep.has(p.id))
const dropBlocked = drop.filter((p) => blocked.has(p.id))
if (!DROP_BLOCKED) {
  for (const p of dropBlocked)
    keep.set(p.id, new Set(blocked.get(p.id).map((b) => b.label)))
  drop = drop.filter((p) => !blocked.has(p.id))
}
const kept = products.filter((p) => keep.has(p.id))

console.log(`Lệnh SX tính: ${lsx.length}/${lsxAll.length}`)
console.log(`SP: ${products.length} — GIỮ ${kept.length} · XOÁ ${drop.length}`)
if (dropBlocked.length) {
  console.log(
    `SP bị báo giá/đơn bán/mẫu giữ: ${dropBlocked.length} → ${DROP_BLOCKED ? 'XOÁ cả chứng từ' : 'GIỮ lại'}`,
  )
  for (const p of dropBlocked)
    console.log(
      `   ${p.code} — ${p.name} — ${[...new Set(blocked.get(p.id).map((b) => b.label))].join(', ')}`,
    )
}

// ── 3. Dữ liệu con của SP xoá ───────────────────────────────────────────────
const dropIds = drop.map((p) => p.id)
const parts = await inIds('technical_product_parts', 'product_id', dropIds)
const clusters = await inIds('technical_product_clusters', 'product_id', dropIds)
const packOpts = await inIds('technical_packing_options', 'product_id', dropIds)
const packages = await inIds(
  'technical_packages',
  'option_id',
  packOpts.map((o) => o.id),
)
const sets = await inIds('technical_product_set_items', 'set_product_id', dropIds)
const revisions = await inIds('technical_product_revisions', 'product_id', dropIds)
const files = await inIds('files', 'product_id', dropIds)
const bomLines = await inIds('technical_bom_lines', 'product_id', dropIds).catch(() => [])
const blockedRows = DROP_BLOCKED ? dropBlocked.flatMap((p) => blocked.get(p.id)) : []

console.log(
  `Con mất theo: định mức ${parts.length} · cụm ${clusters.length} · đóng gói ${packOpts.length}/${packages.length} kiện · món trong bộ ${sets.length} · revision ${revisions.length} · BOM kho cũ ${bomLines.length}`,
)
console.log(
  `File gắn SP xoá: ${files.length} ${DELETE_FILES ? '→ XOÁ dòng + Storage' : '→ giữ, product_id về null'}`,
)
if (blockedRows.length) console.log(`Dòng báo giá/mẫu xoá kèm: ${blockedRows.length}`)

if (!APPLY) {
  console.log('\n(dry-run) Chạy lại với --apply để xoá thật.')
  process.exit(0)
}

// ── 4. Sao lưu ──────────────────────────────────────────────────────────────
mkdirSync('backups', { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = `backups/products-prune-1008-${stamp}.json`
writeFileSync(
  out,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      flags: { ONLY_ACTIVE, DROP_BLOCKED, DELETE_FILES },
      kept: kept.map((p) => ({ id: p.id, code: p.code, why: [...keep.get(p.id)] })),
      technical_products: drop,
      technical_product_parts: parts,
      technical_product_clusters: clusters,
      technical_packing_options: packOpts,
      technical_packages: packages,
      technical_product_set_items: sets,
      technical_product_revisions: revisions,
      technical_bom_lines: bomLines,
      files,
      blocked_rows: blockedRows,
    },
    null,
    1,
  ),
  'utf8',
)
console.log(`\n✓ sao lưu: ${out}`)

// ── 5. Xoá, con trước cha ───────────────────────────────────────────────────
if (DROP_BLOCKED && blockedRows.length) {
  for (const [t] of RESTRICT) {
    const ids = blockedRows.filter((b) => b.table === t).map((b) => b.id)
    if (!ids.length) continue
    // Mẫu có sổ mượn/trả (FK restrict) → xoá sổ trước; events + files của mẫu cascade.
    if (t === 'technical_samples')
      console.log(
        `✓ technical_sample_loans: ${await del('technical_sample_loans', 'sample_id', ids)} dòng`,
      )
    console.log(`✓ ${t}: ${await del(t, 'id', ids)} dòng`)
  }
}
if (files.length) {
  const { error } = await sb
    .from('technical_products')
    .update({ image_file_id: null })
    .in('id', dropIds)
  if (error) console.error(`  ! gỡ image_file_id: ${error.message}`)
  if (DELETE_FILES) {
    const byBucket = new Map()
    for (const f of files)
      byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path])
    for (const [bucket, paths] of byBucket)
      for (const part of chunk(paths, 100)) {
        const { error } = await sb.storage.from(bucket).remove(part)
        if (error) console.error(`  ! Storage ${bucket}: ${error.message}`)
      }
    console.log(
      `✓ files: ${await del(
        'files',
        'id',
        files.map((f) => f.id),
      )} dòng (+ Storage)`,
    )
  }
}
console.log(
  `✓ technical_packages: ${await del(
    'technical_packages',
    'id',
    packages.map((r) => r.id),
  )}`,
)
console.log(
  `✓ technical_packing_options: ${await del('technical_packing_options', 'product_id', dropIds)}`,
)
console.log(
  `✓ technical_product_set_items: ${await del('technical_product_set_items', 'set_product_id', dropIds)}`,
)
console.log(
  `✓ technical_product_parts: ${await del('technical_product_parts', 'product_id', dropIds)}`,
)
console.log(
  `✓ technical_product_clusters: ${await del('technical_product_clusters', 'product_id', dropIds)}`,
)
console.log(
  `✓ technical_product_revisions: ${await del('technical_product_revisions', 'product_id', dropIds)}`,
)
if (bomLines.length)
  console.log(
    `✓ technical_bom_lines: ${await del('technical_bom_lines', 'product_id', dropIds)}`,
  )
console.log(
  `✓ technical_products: ${await del('technical_products', 'id', dropIds)} sản phẩm`,
)

const { count } = await sb
  .from('technical_products')
  .select('*', { count: 'exact', head: true })
console.log(`\nXONG. Thư viện còn ${count} sản phẩm.`)
