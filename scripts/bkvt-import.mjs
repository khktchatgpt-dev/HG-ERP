// NẠP ĐỊNH MỨC PHỤ KIỆN từ sheet BKVT (2 file "THEO DÕI VẬT TƯ" + "LSX 04 +
// BẢNG KÊ VT") vào technical_product_parts — nhóm NGU_KIM, phục vụ panel nhu
// cầu của form đặt hàng (needs view đếm dòng có material_code × SL đơn).
//
//   node scripts/bkvt-import.mjs             # dry-run
//   node scripts/bkvt-import.mjs --apply     # ghi thật
//
// Phạm vi cố ý hẹp (user duyệt 09/08/2026): CHỈ SP đang có 0 dòng BOM trong hệ
// — không đè bảng ai đã nhập tay. Dòng không khớp được mã vật tư vẫn ghi
// (material_code null) để hồ sơ đủ định mức; needs chỉ đếm dòng có mã, Kỹ thuật
// gắn mã dần bằng chính cảnh báo của màn BOM.
//
// Khớp vật tư bằng ĐÚNG bộ khoá server chặn trùng (material-key.ts): mức chắc
// (sureKey, 1 ứng viên) tự gắn; mờ (namesAlike, duy nhất 1) tự gắn có đánh dấu;
// còn lại để trống + in ra.

import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'
import { sureKey, namesAlike, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const APPLY = process.argv.includes('--apply')
const DL = 'C:/Users/HP/Downloads'
const FILES = [
  `${DL}/THEO DÕI  VẬT TƯ - LSX 01.26.xlsx`,
  `${DL}/THEO DÕI VẬT TƯ - LSX 02.26.xlsx`,
  `${DL}/LSX 04 + BẢNG KÊ VT.xlsx`,
]

const s = (v) => (v == null ? '' : String(v).trim())
const oneLine = (v) => s(v).replace(/\s*\n\s*/g, ' ')
const numOf = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ── Đọc các sheet BKVT ──────────────────────────────────────────────────────
// Cấu trúc (dò theo header, cột có thể xê dịch giữa file):
//   Mã SP | Tên SP | TÊN VẬT TƯ | ĐVT | Đm/sp | SL/ĐH | VTRL/ghi chú | ...
// Mã SP/Tên SP bị merge dọc → fill-down.

const rows = [] // {legacy, productName, material, unit, dm, note, src}
for (const file of FILES) {
  const wb = XLSX.readFile(file)
  for (const sheetName of wb.SheetNames) {
    if (!/^bkvt$/i.test(sheetName.trim())) continue
    const ws = wb.Sheets[sheetName]
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    let cols = null
    let cur = { legacy: '', productName: '' }
    for (const row of grid) {
      if (!row) continue
      if (!cols) {
        const find = (re) => row.findIndex((v) => re.test(oneLine(v)))
        const material = find(/tên vật tư/i)
        const dm = find(/^đm\s*\/?\s*sp/i)
        if (material < 0 || dm < 0) continue
        cols = {
          legacy: find(/mã sp/i),
          productName: find(/tên sp/i),
          material,
          unit: find(/^đvt$/i),
          dm,
          note: find(/vtrl|ghi chú/i),
        }
        continue
      }
      const material = oneLine(row[cols.material])
      if (!material) continue
      const legacy = s(row[cols.legacy])
      const productName = oneLine(row[cols.productName])
      if (legacy) cur = { legacy, productName: productName || cur.productName }
      else if (productName) cur = { ...cur, productName }
      const dm = numOf(row[cols.dm])
      if (!cur.legacy || dm == null || dm <= 0) continue
      rows.push({
        legacy: cur.legacy,
        productName: cur.productName,
        material,
        unit: cols.unit >= 0 ? s(row[cols.unit]) : '',
        dm,
        note: cols.note >= 0 ? oneLine(row[cols.note]) : '',
        src: `${sheetName} — ${file.split('/').pop()}`,
      })
    }
  }
}
console.log(`Đọc được ${rows.length} dòng định mức từ các sheet BKVT.`)

// ── Khớp SP + vật tư ────────────────────────────────────────────────────────

const db = await client(import.meta.url)

async function allRows(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

const products = await allRows('technical_products', 'id, code, code_legacy, name')
const productById = new Map(products.map((p) => [p.id, p]))

/*
 * MÃ TRONG BKVT là MÃ KHÁCH MERXX (22024-217) — SP trong hệ mang mã HG
 * (TB0182HG-AL). Cầu nối tin được là DÒNG LỆNH SX (production_order_lines):
 * mỗi dòng mang customer_item_code + product_id, phạm vi hẹp theo lệnh đang
 * chạy nên không dính nhiễu trùng mã của cả danh mục (một mã khách trong
 * technical_products đang gắn 2-3 SP khác nhau — dữ liệu cũ).
 *
 * Suffix mã khách là MÀU (22024-209 vs -217): BKVT hay ghi biến thể khác màu
 * với dòng lệnh nhưng CÙNG phần cứng — khớp đúng mã trước, trượt thì khớp theo
 * 5 SỐ GỐC khi chỉ ra một SP duy nhất.
 */
const lsxLines = await allRows(
  'production_order_lines',
  'customer_item_code, product_id, production_orders!inner(status)',
)
const activeLines = lsxLines.filter(
  (l) =>
    l.product_id &&
    /^\d{5}-\d{3}/.test(s(l.customer_item_code)) &&
    ['approved', 'in_progress'].includes(
      (Array.isArray(l.production_orders) ? l.production_orders[0] : l.production_orders)
        ?.status,
    ),
)
const byExact = new Map()
const byPrefix = new Map()
for (const l of activeLines) {
  const code = s(l.customer_item_code).toUpperCase()
  ;(byExact.get(code) ?? byExact.set(code, new Set()).get(code)).add(l.product_id)
  const pre = code.slice(0, 5)
  ;(byPrefix.get(pre) ?? byPrefix.set(pre, new Set()).get(pre)).add(l.product_id)
}
const uniq = (set) => (set && set.size === 1 ? [...set][0] : null)
function matchProduct(legacy) {
  const code = legacy.toUpperCase()
  const exact = uniq(byExact.get(code))
  if (exact) return productById.get(exact)
  const pre = uniq(byPrefix.get(code.slice(0, 5)))
  if (pre) return productById.get(pre)
  return null
}

const { data: partRows, error: pe } = await db
  .from('technical_product_parts')
  .select('product_id')
  .limit(20000)
if (pe) throw new Error(pe.message)
const hasParts = new Set((partRows ?? []).map((r) => r.product_id))

const mats = await allRows('warehouse_materials', 'id, code, name')
const matByKey = new Map()
for (const m of mats) {
  const k = sureKey(m.name)
  if (k.length < MIN_KEY_LEN) continue
  ;(matByKey.get(k) ?? matByKey.set(k, []).get(k)).push(m)
}
function matchMaterial(name) {
  const k = sureKey(name)
  if (k.length < MIN_KEY_LEN) return null
  const sure = matByKey.get(k)
  if (sure?.length === 1) return { code: sure[0].code, how: 'chắc' }
  if (sure?.length > 1) return null // trùng chéo nhóm — người rà
  const alike = mats.filter((m) => namesAlike(name, m.name))
  if (alike.length === 1) return { code: alike[0].code, how: 'mờ' }
  return null
}

// Gom theo SP; SP nào chưa có dòng BOM nào mới nạp. Trùng (SP, vật tư) trong
// nhiều file → giữ bản gặp sau (file mới hơn nằm cuối danh sách FILES).
const byProduct = new Map()
const unmatchedProducts = new Set()
for (const r of rows) {
  const p = matchProduct(r.legacy)
  if (!p) {
    unmatchedProducts.add(`${r.legacy} — ${r.productName}`)
    continue
  }
  if (hasParts.has(p.id)) continue
  const list = byProduct.get(p.id) ?? { product: p, items: new Map() }
  list.items.set(sureKey(r.material) || r.material, r)
  byProduct.set(p.id, list)
}

let matched = 0
let fuzzy = 0
let noCode = 0
const inserts = []
for (const { product, items } of byProduct.values()) {
  let order = 1
  for (const r of items.values()) {
    const hit = matchMaterial(r.material)
    if (hit?.how === 'chắc') matched++
    else if (hit?.how === 'mờ') fuzzy++
    else noCode++
    inserts.push({
      product_id: product.id,
      group_code: 'NGU_KIM',
      part_no: order,
      part_name: r.material,
      material_code: hit?.code ?? null,
      material_kind: null,
      qty: r.dm,
      unit: r.unit || null,
      note: r.note || null,
      material_note:
        hit?.how === 'mờ' ? 'khớp mờ — nạp máy BKVT 09/08/2026, rà lại mã' : null,
      section_title: 'BKVT (nạp máy 09/08/2026)',
      sort_order: order++,
    })
  }
}

console.log(`SP sẽ nạp        : ${byProduct.size} (chỉ SP đang 0 dòng BOM)`)
console.log(
  `Dòng sẽ ghi      : ${inserts.length} — mã chắc ${matched} · mã mờ ${fuzzy} · chưa gắn mã ${noCode}`,
)
console.log(`Mã SP không có trong hệ (${unmatchedProducts.size}):`)
for (const u of unmatchedProducts) console.log(`  ? ${u}`)
for (const { product, items } of [...byProduct.values()].slice(0, 3)) {
  console.log(
    `\n  ${product.code_legacy ?? product.code} — ${product.name}: ${items.size} dòng`,
  )
  for (const r of [...items.values()].slice(0, 4)) {
    const hit = matchMaterial(r.material)
    console.log(
      `    · ${r.material} — đm ${r.dm} ${r.unit} → ${hit ? `${hit.code} [${hit.how}]` : '(chưa gắn mã)'}`,
    )
  }
}

if (!APPLY) {
  console.log('\n(dry-run) Chạy lại với --apply để ghi.')
  process.exit(0)
}
for (let i = 0; i < inserts.length; i += 100) {
  const { error } = await db
    .from('technical_product_parts')
    .insert(inserts.slice(i, i + 100))
  if (error) throw new Error(error.message)
}
console.log(`\n✓ Đã ghi ${inserts.length} dòng BOM cho ${byProduct.size} SP.`)
