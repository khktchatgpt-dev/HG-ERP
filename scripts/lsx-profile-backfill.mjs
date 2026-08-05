// BỔ SUNG HỒ SƠ SẢN PHẨM từ dòng lệnh sản xuất đã import (08/2026).
//
//   node scripts/lsx-profile-backfill.mjs            (xem thử)
//   node scripts/lsx-profile-backfill.mjs --apply    (ghi thật)
//
// Vì sao: LSX phát MỚI trong app nạp thông số dòng TỪ HỒ SƠ SP
// (`draftFromOrders` đọc tech_spec/packing/barcode/name_foreign) — hồ sơ trống
// thì lệnh sau này trống theo. 78 SP nằm trong 7 lệnh vừa import phần lớn mới
// tạo từ chính file LSX nên hồ sơ mỏng, trong khi dữ liệu thật đã nằm ngay
// trên dòng lệnh. Đổ ngược lại cho khép vòng:
//
//   dòng lệnh (Excel)                  → hồ sơ SP (chỉ điền Ô TRỐNG)
//   specs Mây / Mây/Vải                → tech_spec.machine
//   specs Nệm · Sơn · Kính · Gỗ        → tech_spec.cushion/paint/glass/wood
//   specs FINISH (ROSCO)               → material (chất liệu catalogue)
//   name_foreign (cắt mã lặp ở đầu)    → name_foreign
//   barcode (MERXX)                    → barcode
//   "2 cái/thùng" · "25c/pallet"       → packing.qty_per_carton + pack_unit_label
//
// Nguyên tắc an toàn:
//   · KHÔNG ghi đè — hồ sơ đã có giá trị thì giữ nguyên.
//   · Giá trị giữ chỗ ("xác nhận sau", "Thông báo sau", "Theo mẫu…") là chuyện
//     của TỪNG ĐƠN, không phải thông số SP — bỏ, không cho vào hồ sơ.
//   · Cùng SP mà các dòng nói hai giá trị khác nhau (một SP hai màu dây ở hai
//     đơn) → KHÔNG điền, in ra cho người soát. Thà trống còn hơn sai.
//   · Đóng gói chỉ nhận mẫu chắc ("N cái/thùng", "N c/pallet", "1 pc/ctn");
//     kiểu "1 bộ/ 2 thùng", "Bench trái+đôn /thùng 1…" người khai tay sau.
//
// Idempotent: chạy lại chỉ còn ô trống thì mới điền.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)
const die = (m, e) => {
  console.error('✗', m, e?.message ?? '')
  process.exit(1)
}
const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ')
const PLACEHOLDER = /xác nhận sau|thông báo sau|theo mẫu|đợi thông tin/i

/** "2 cái/thùng" · "25c/pallet" · "1 pc/ctn" → packing chuẩn. Mẫu lạ → null. */
function parsePacking(text) {
  const t = norm(text).toLowerCase()
  const m = /^(\d+)\s*(?:cái|c|pc|pcs|chiếc)?\s*\/\s*(thùng|ctn|carton|pallet)$/.exec(t)
  if (!m) return null
  return {
    qty_per_carton: Number(m[1]),
    pack_unit_label: m[2] === 'pallet' ? 'pallet' : 'thùng',
  }
}

// ── Nạp dòng lệnh import + hồ sơ SP ─────────────────────────────────────────
const { data: pos, error: poErr } = await db
  .from('production_orders')
  .select('id, code')
  .like('code', '0%/26-27%')
if (poErr) die('đọc production_orders', poErr)

const { data: lines, error: lErr } = await db
  .from('production_order_lines')
  .select('product_id, name_foreign, barcode, packing, specs')
  .in(
    'production_order_id',
    pos.map((p) => p.id),
  )
  .not('product_id', 'is', null)
if (lErr) die('đọc production_order_lines', lErr)

const ids = [...new Set(lines.map((l) => l.product_id))]
const { data: products, error: pErr } = await db
  .from('technical_products')
  .select('id, code, name, material, name_foreign, barcode, tech_spec, packing')
  .in('id', ids)
if (pErr) die('đọc technical_products', pErr)

// ── Gom giá trị ứng viên theo SP ────────────────────────────────────────────
const SPEC_MAP = [
  ['machine', ['Mây', 'Mây/Vải']],
  ['cushion', ['Nệm']],
  ['paint', ['Sơn']],
  ['glass', ['Kính']],
  ['wood', ['Gỗ']],
]

const candidates = new Map() // product_id → { field → Set(giá trị) }
function addCand(pid, field, value) {
  const v = norm(value)
  if (!v || PLACEHOLDER.test(v)) return
  if (!candidates.has(pid)) candidates.set(pid, new Map())
  const fields = candidates.get(pid)
  if (!fields.has(field)) fields.set(field, new Set())
  fields.get(field).add(v)
}

for (const l of lines) {
  const specs = l.specs ?? {}
  for (const [field, keys] of SPEC_MAP) {
    for (const k of keys) addCand(l.product_id, `spec:${field}`, specs[k])
  }
  addCand(l.product_id, 'material', specs['FINISH'])
  // Tên nước ngoài: cắt mã lặp ở đầu ("1708674 Halston…" → "Halston…").
  addCand(
    l.product_id,
    'name_foreign',
    (l.name_foreign ?? '').replace(/^\d{6,9}(?:\.\d{1,3})?\s+/, ''),
  )
  addCand(l.product_id, 'barcode', l.barcode)
  const pk = parsePacking(l.packing)
  if (pk) addCand(l.product_id, 'packing', JSON.stringify(pk))
}

// ── Điền ô trống, báo ô nhập nhằng ──────────────────────────────────────────
let filled = 0
let conflicts = 0
const stats = {}

for (const p of products) {
  const fields = candidates.get(p.id)
  if (!fields) continue
  const patch = {}
  const ts = { ...(p.tech_spec ?? {}) }
  let tsChanged = false

  for (const [field, values] of fields) {
    if (values.size > 1) {
      conflicts++
      console.log(
        `  ! ${p.code} ${field}: ${values.size} giá trị khác nhau — bỏ, soát tay: ${[
          ...values,
        ]
          .map((v) => `"${v.slice(0, 40)}"`)
          .join(' · ')}`,
      )
      continue
    }
    const v = [...values][0]
    if (field.startsWith('spec:')) {
      const key = field.slice(5)
      if (norm(ts[key])) continue // hồ sơ đã có — giữ
      ts[key] = v
      tsChanged = true
    } else if (field === 'packing') {
      const cur = p.packing ?? {}
      if (cur.qty_per_carton || cur.pack_unit_label) continue
      patch.packing = { ...cur, ...JSON.parse(v) }
    } else {
      if (norm(p[field])) continue
      patch[field] = v
    }
    stats[field] = (stats[field] ?? 0) + 1
  }
  if (tsChanged) patch.tech_spec = ts
  if (Object.keys(patch).length === 0) continue

  filled++
  console.log(`+ ${p.code} ← ${Object.keys(patch).join(', ')}`)
  if (!APPLY) continue
  const { error } = await db.from('technical_products').update(patch).eq('id', p.id)
  if (error) die(`ghi hồ sơ ${p.code}`, error)
}

console.log(`\n== THEO TRƯỜNG ==`)
for (const [f, n] of Object.entries(stats)) console.log(`  ${f}: ${n} SP`)
console.log(
  `\n${APPLY ? 'ĐÃ GHI' : 'XEM THỬ (chưa ghi — thêm --apply)'} · bổ sung ${filled}/${products.length} SP · ${conflicts} ô nhập nhằng bỏ lại`,
)
