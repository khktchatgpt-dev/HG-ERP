// NỐI DÒNG LỆNH SẢN XUẤT CÒN TRỐNG SẢN PHẨM về thư viện SP (08/2026).
//
//   node scripts/lsx-lines-link.mjs            (xem thử)
//   node scripts/lsx-lines-link.mjs --apply    (ghi thật)
//
// Sau `lsx-sales-import.mjs`, một số dòng lệnh không nối được `product_id` —
// dòng vẫn in ra phiếu đủ (snapshot text) nhưng không kéo được BOM/định mức.
// Script này xử lý bốn nhóm nguyên nhân, theo thứ tự an toàn giảm dần:
//
//   1. MÃ ẨN TRONG TÊN — Sales gõ "Thông báo sau" ở cột Mã SP nhưng mã thật
//      nằm ngay đầu cột tên ("1708674 Halston 213x213cm Corner Sofa Set").
//      Trích ra, ghi vào customer_item_code của dòng rồi khớp lại.
//   2. MÃ LỆCH Ở THƯ VIỆN — SP có thật, chỉ mang mã khách sai/thiếu. Chỉ sửa
//      khi TÊN KHỚP CHÍNH XÁC, ghi rõ từng ca ở bảng FIX_CODE bên dưới.
//   3. TẠO SP MỚI — mã khách chưa từng có. Mã HG sinh theo quy ước
//      (`src/lib/product-code.ts`): loại + serial 4 số + HG + vật liệu khung.
//   4. Nối lại `product_id`/`product_code` cho dòng lệnh, và bù dòng đơn hàng
//      bị bỏ lúc import (dòng đơn cần product_id NOT NULL nên trước đó phải bỏ).
//
// KHÔNG đoán bừa: mã khách không duy nhất toàn cục (bài học import BOM — 8/61 ca
// dính nhầm khách), nên chỉ gán khi mã khớp sau khi làm sạch, hoặc tên khớp
// tuyệt đối trong phạm vi cùng khách. Còn lại tạo SP mới — thà hai SP chờ gộp
// còn hơn một SP mang số của hai đơn khác nhau.
//
// Idempotent: chạy lại chỉ xử lý dòng còn thiếu; SP nhận diện theo `code`.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)
const die = (m, e) => {
  console.error('✗', m, e?.message ?? '')
  process.exit(1)
}
const norm = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Mã khách nằm ở ĐẦU tên nước ngoài — dạng số hàng LAURA (`1708674 Halston…`,
 * `1708402.11 Amelia…`). Chỉ nhận chuỗi số (có thể kèm `.11`) theo sau là chữ,
 * để không nuốt nhầm kích thước ("213x213cm") hay mã dạng khác.
 */
function codeFromName(name) {
  const m = /^(\d{6,9}(?:\.\d{1,3})?)\s+\p{L}/u.exec((name ?? '').trim())
  return m ? m[1] : null
}

/** Mã trên LSX có chú thích trong ngoặc — "26300-309 ( có 1 mẫu màu bạc )". */
function cleanCode(code) {
  return (code ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

/**
 * SP ĐÃ CÓ trong thư viện nhưng mang mã khách sai/thiếu — soát tay từng ca,
 * đối chiếu tên trùng khớp tuyệt đối. Không để script tự suy: hai bàn
 * "150x90" chỉ khác nước sơn thì tên gần giống nhau tới mức đoán là hỏng.
 */
const FIX_CODE = [
  {
    product_code: 'TB0167HG-AL',
    expect_name: 'Bàn CN nhôm gỗ keo 150x90 cm , sơn bạc',
    set_customer_item_code: '22002-219',
    // TB0166 (graphit) và TB0167 (bạc) cùng đeo mã 22002-217; LSX 17976 cho
    // thấy bản sơn bạc là 22002-219. Gán lại đúng bản bạc.
    why: 'hai SP cùng đeo 22002-217; LSX ghi bản sơn bạc là 22002-219',
  },
]

// ── Nạp dữ liệu ─────────────────────────────────────────────────────────────
const { data: products, error: pErr } = await db
  .from('technical_products')
  .select(
    'id, code, name, customer_name, customer_item_code, product_type, frame_material',
  )
if (pErr) die('đọc technical_products', pErr)

const { data: lines, error: lErr } = await db
  .from('production_order_lines')
  .select(
    'id, production_order_id, customer_item_code, product_code, name_foreign, name_vi, unit, qty, specs, sales_order_line_id, group_id',
  )
  .is('product_id', null)
if (lErr) die('đọc production_order_lines', lErr)

const { data: pos, error: poErr } = await db
  .from('production_orders')
  .select('id, code, customer_id')
if (poErr) die('đọc production_orders', poErr)
const poById = new Map(pos.map((p) => [p.id, p]))

const { data: customers, error: cErr } = await db
  .from('sales_customers')
  .select('id, name')
if (cErr) die('đọc sales_customers', cErr)
const custById = new Map(customers.map((c) => [c.id, c.name]))

if (lines.length === 0) {
  console.log('✓ Mọi dòng lệnh đã nối được sản phẩm — không có gì để làm.')
  process.exit(0)
}

// ── Bước 1+2: mã ẩn trong tên · sửa mã lệch ở thư viện ──────────────────────
const byCustCode = new Map()
for (const p of products) {
  if (!p.customer_item_code) continue
  const k = norm(p.customer_item_code)
  if (!byCustCode.has(k)) byCustCode.set(k, [])
  byCustCode.get(k).push(p)
}

for (const fix of FIX_CODE) {
  const p = products.find((x) => x.code === fix.product_code)
  if (!p) {
    console.log(`  ~ bỏ qua ${fix.product_code} — không còn trong thư viện`)
    continue
  }
  if (norm(p.name) !== norm(fix.expect_name)) {
    console.log(
      `  ! ${fix.product_code}: tên đã đổi ("${p.name}") — KHÔNG sửa mã, soát tay`,
    )
    continue
  }
  if (p.customer_item_code === fix.set_customer_item_code) continue
  console.log(
    `~ Sửa mã khách ${fix.product_code}: "${p.customer_item_code}" → "${fix.set_customer_item_code}" (${fix.why})`,
  )
  if (APPLY) {
    const { error } = await db
      .from('technical_products')
      .update({ customer_item_code: fix.set_customer_item_code })
      .eq('id', p.id)
    if (error) die(`sửa mã ${fix.product_code}`, error)
  }
  // Cập nhật bản đồ NGAY CẢ khi xem thử — nếu không, bản xem thử sẽ báo "tạo SP
  // mới" cho đúng mã vừa gán, tức nói sai việc sẽ làm.
  p.customer_item_code = fix.set_customer_item_code
  const k = norm(fix.set_customer_item_code)
  if (!byCustCode.has(k)) byCustCode.set(k, [])
  byCustCode.get(k).push(p)
}

/** Khớp SP: theo mã khách (thu hẹp theo khách), rồi mã HG. */
function matchProduct(code, customerName, names = []) {
  if (!code) return null
  const k = norm(code)
  let hits = byCustCode.get(k) ?? []
  if (hits.length === 0) {
    return products.find((p) => norm(p.code) === k) ?? null
  }
  if (hits.length > 1) {
    const cn = norm(customerName)
    const scoped = hits.filter(
      (p) => cn.includes(norm(p.customer_name)) || norm(p.customer_name).includes(cn),
    )
    if (scoped.length > 0) hits = scoped
  }
  if (hits.length === 1) return hits[0]
  const ns = names.map(norm).filter(Boolean)
  const byName = hits.filter((p) => ns.includes(norm(p.name)))
  return byName.length === 1 ? byName[0] : null
}

// ── Bước 3: gom SP cần tạo ───────────────────────────────────────────────────
/**
 * Phân loại + vật liệu khung suy từ TÊN TIẾNG VIỆT (chuẩn đặt tên của Kỹ thuật),
 * lùi về tên nước ngoài khi dòng không có tên Việt (mẫu ROSCO).
 */
function classify(name, specs = {}) {
  const t = norm(name)
  // Vật liệu khung nhiều khi KHÔNG nằm trong tên (mẫu ROSCO chỉ có tên tiếng
  // Anh) — cột spec của chính dòng đó mới nói: FINISH "Aluminium Frame/…".
  const specText = norm(Object.values(specs ?? {}).join(' '))
  const t2 = `${t} ${specText}`
  const type = /giường tắm nắng|sun ?lounger/.test(t)
    ? 'SL'
    : /^bộ |corner sofa set|dining set/.test(t)
      ? 'ST'
      : /bank|băng ghế|bench/.test(t)
        ? 'BN'
        : /ghế|chair|armchair|stool|đôn/.test(t)
          ? 'CH'
          : /bàn|table|chân bàn|mặt bàn/.test(t)
            ? 'TB'
            : 'OT'
  // Thứ tự có chủ đích: khung là thứ chịu lực, "đan mây" thắng "khung sắt" chỉ
  // khi tên nói rõ đan mây (SP Aria của LAURA đều là khung sắt bọc mây → RA).
  const material = /đan mây|rattan|weave/.test(t2)
    ? 'RA'
    : /khung sắt|metal frame|iron/.test(t2)
      ? 'IR'
      : /nhôm|alumini?um|alu\b/.test(t2)
        ? 'AL'
        : /gỗ|wood|akazie|acacia/.test(t2)
          ? 'WD'
          : 'XX'
  return { type, material }
}

/**
 * VẬT LIỆU KHUNG THEO SP ANH EM — chính xác hơn đoán chữ.
 *
 * Đoán từ mô tả sai cả hai chiều: ROSCO ghi "Aluminium Frame/Full & Halfround
 * Weave" (khung nhôm, bọc mây) mà bắt chữ "Weave" thì ra mây; MERXX ghi tay gỗ
 * "Acacia" mà bắt chữ "gỗ" thì ra gỗ. Trong khi thư viện đã có SP cùng dòng của
 * chính khách đó — "New Chelsea Bistro Table Top" là AL, "Ghế 5 bậc Paxos" là
 * AL, các SP Aria của LAURA đều RA. Lấy theo anh em thì mã mới nằm đúng cụm với
 * mã cũ, và không cần đoán.
 *
 * Chỉ nhận khi mọi anh em tìm được ĐỒNG THUẬN một vật liệu; lệch nhau thì trả
 * null để rơi về suy từ chữ.
 */
function siblingMaterial(name, customerName) {
  const t = norm(name)
  if (t.length < 8) return null
  const cn = norm(customerName)
  const sameCustomer = products.filter((p) => {
    const pc = norm(p.customer_name)
    return pc && (cn.includes(pc) || pc.includes(cn)) && p.frame_material
  })
  const kin = sameCustomer.filter((p) => {
    const pn = norm(p.name)
    return pn.length >= 8 && (t.includes(pn) || pn.includes(t))
  })
  if (kin.length === 0) return null
  const mats = new Set(kin.map((p) => p.frame_material))
  return mats.size === 1 ? [...mats][0] : null
}

const nextSerial = new Map()
for (const p of products) {
  const m = /^([A-Z]{2})(\d{4,6})HG-[A-Z]{2}$/.exec(p.code ?? '')
  if (!m) continue
  const cur = nextSerial.get(m[1]) ?? 0
  if (Number(m[2]) > cur) nextSerial.set(m[1], Number(m[2]))
}

const toCreate = new Map() // key mã khách → thông tin SP mới
const lineFixes = [] // { id, customer_item_code?, key }

for (const l of lines) {
  const po = poById.get(l.production_order_id)
  const customerName = custById.get(po?.customer_id) ?? ''
  // 1. mã ẩn trong tên khi cột mã là "Thông báo sau" / trống
  const rawCode = cleanCode(l.customer_item_code)
  const looksMissing = !rawCode || /^(thông báo sau|chưa có|xác nhận sau)$/i.test(rawCode)
  const code = looksMissing ? codeFromName(l.name_foreign) : rawCode
  if (!code) {
    console.log(
      `  ! ${po?.code}: "${l.name_foreign?.slice(0, 45)}" — không tìm ra mã, bỏ qua`,
    )
    continue
  }
  const hit = matchProduct(code, customerName, [l.name_vi, l.name_foreign])
  const fix = { id: l.id, key: code, customerName }
  if (rawCode !== code) fix.customer_item_code = code
  if (hit) {
    fix.product = hit
  } else {
    /*
     * Tên SP: dùng TÊN TIẾNG VIỆT nguyên vẹn (chuẩn đặt tên của Kỹ thuật).
     * Chỉ khi dòng không có tên Việt (mẫu ROSCO) mới lấy tên nước ngoài, và
     * lúc đó cắt phần mã lặp ở đầu ("1708674 Halston…" → "Halston…").
     * Tên trong ô Excel hay xuống dòng — gộp về một dòng cho danh mục.
     */
    const raw = l.name_vi?.trim()
      ? l.name_vi
      : (l.name_foreign ?? '').replace(/^\d{6,9}(?:\.\d{1,3})?\s+/, '')
    const name = raw.replace(/\s+/g, ' ').trim()
    if (!toCreate.has(code)) {
      const { type, material: guessed } = classify(l.name_vi || l.name_foreign, l.specs)
      const material = siblingMaterial(name, customerName) ?? guessed
      const serial = (nextSerial.get(type) ?? 0) + 1
      nextSerial.set(type, serial)
      toCreate.set(code, {
        code: `${type}${String(serial).padStart(4, '0')}HG-${material}`,
        name: name.trim() || code,
        customer_name: customerName,
        customer_item_code: code,
        product_type: type,
        frame_material: material,
        unit: l.unit || 'cai',
        is_set: type === 'ST',
      })
    }
    fix.createKey = code
  }
  lineFixes.push(fix)
}

console.log(`\n== SP TẠO MỚI (${toCreate.size}) ==`)
for (const [k, p] of toCreate) {
  console.log(
    `+ ${p.code}  ${p.name.slice(0, 46).padEnd(46)} | KH ${p.customer_name} | mã khách ${k}`,
  )
}

if (APPLY && toCreate.size > 0) {
  const rows = [...toCreate.values()]
  const { data: created, error } = await db
    .from('technical_products')
    .insert(rows)
    .select('id, code, customer_item_code, name, customer_name')
  if (error) die('tạo SP mới', error)
  for (const p of created) {
    products.push(p)
    const k = norm(p.customer_item_code)
    if (!byCustCode.has(k)) byCustCode.set(k, [])
    byCustCode.get(k).push(p)
  }
}

// ── Bước 4: nối dòng lệnh + bù dòng đơn hàng ────────────────────────────────
let linked = 0
for (const f of lineFixes) {
  const p = f.product ?? matchProduct(f.key, f.customerName)
  if (!p) continue
  linked++
  if (!APPLY) continue
  const patch = { product_id: p.id, product_code: p.code }
  if (f.customer_item_code) patch.customer_item_code = f.customer_item_code
  const { error } = await db.from('production_order_lines').update(patch).eq('id', f.id)
  if (error) die(`nối dòng ${f.id}`, error)
}

// ── Bước 5: bù dòng ĐƠN HÀNG bị bỏ lúc import ───────────────────────────────
/*
 * `sales_order_lines.product_id` là NOT NULL nên lúc import, dòng đơn của SP
 * chưa có trong thư viện buộc phải bỏ — đơn thiếu dòng so với file gốc. Giờ SP
 * đã có, bù lại: lấy đúng dòng lệnh vừa nối, tra đơn qua nhóm của nó.
 * Đơn giá để 0 như các dòng khác (file LSX không mang giá).
 */
const { data: groups, error: gErr } = await db
  .from('production_order_groups')
  .select('id, sales_order_id')
if (gErr) die('đọc production_order_groups', gErr)
const orderOfGroup = new Map(groups.map((g) => [g.id, g.sales_order_id]))

const { data: orderLines, error: olErr } = await db
  .from('sales_order_lines')
  .select('order_id, product_id, sort_order')
if (olErr) die('đọc sales_order_lines', olErr)
const hasOrderLine = new Set(orderLines.map((l) => `${l.order_id}|${l.product_id}`))
const maxSort = new Map()
for (const l of orderLines) {
  maxSort.set(l.order_id, Math.max(maxSort.get(l.order_id) ?? -1, l.sort_order))
}

const newOrderLines = []
for (const f of lineFixes) {
  const p = f.product ?? matchProduct(f.key, f.customerName)
  const line = lines.find((x) => x.id === f.id)
  const orderId = line ? orderOfGroup.get(line.group_id) : null
  if (!p || !orderId) continue // LAURA không có đơn — nhóm theo bộ sưu tập
  const key = `${orderId}|${p.id}`
  if (hasOrderLine.has(key)) continue
  hasOrderLine.add(key)
  const sort = (maxSort.get(orderId) ?? -1) + 1
  maxSort.set(orderId, sort)
  newOrderLines.push({
    order_id: orderId,
    product_id: p.id,
    qty: line.qty,
    unit_price: 0,
    note: line.name_vi || line.name_foreign || null,
    sort_order: sort,
  })
}

if (newOrderLines.length > 0) {
  console.log(`\n== BÙ DÒNG ĐƠN HÀNG (${newOrderLines.length}) ==`)
  if (APPLY) {
    const { error } = await db.from('sales_order_lines').insert(newOrderLines)
    if (error) die('bù dòng đơn hàng', error)
  }
}

console.log(
  `\n${APPLY ? 'ĐÃ GHI' : 'XEM THỬ (chưa ghi — thêm --apply)'} · nối ${linked}/${lines.length} dòng lệnh · bù ${newOrderLines.length} dòng đơn`,
)
