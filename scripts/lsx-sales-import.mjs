// NẠP KHÁCH HÀNG + ĐƠN HÀNG + LỆNH SẢN XUẤT từ 8 file LSX thật của Sales (08/2026).
//
//   node scripts/lsx-sales-import.mjs --plan <lsx-plan.json>            (xem thử)
//   node scripts/lsx-sales-import.mjs --plan <lsx-plan.json> --apply    (ghi thật)
//
// Plan do bước parse Excel sinh ra (4 layout LAURA/ROSCO/YOTRIO/MERXX — xem
// docs/lsx-redesign.md §1). Script này:
//   1. Khách hàng  — upsert theo TÊN (LAURA, ROSCO; YOTRIO/MERXX đã có sẵn).
//   2. Đơn hàng    — sales_orders theo số PO của khách (PT-138-…, 17976 HG-MX,
//                    S27YG…); dòng đơn khớp SP qua `customer_item_code` rồi tới
//                    `code`; SP KHÔNG khớp thì BỎ dòng đơn (unit_price=0 vì file
//                    LSX không mang giá) — LAURA không có số PO nên không có đơn.
//   3. Lệnh SX     — production_orders 3 cấp lệnh→nhóm→dòng (0114/0115); dòng
//                    giữ snapshot text (mã/tên/spec) nên SP chưa khớp vẫn nhập
//                    đủ; nhóm trỏ về đơn qua po_no; đơn gắn ngược
//                    production_order_id + chuyển 'lsx_issued'.
//
// Trạng thái: lệnh nhập là lệnh THẬT đã GĐ ký trên giấy → 'approved' (không bắt
// GĐ duyệt lại trên app); đơn → 'lsx_issued'.
//
// Idempotent: khách theo tên, đơn/lệnh theo `code` — đã có thì BỎ QUA (không đè),
// chạy lại vô hại.

import { readFileSync } from 'node:fs'
import { client } from './products-lib.mjs'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const planPath = argv[argv.indexOf('--plan') + 1]
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
const db = await client(import.meta.url)

const die = (msg, error) => {
  console.error('✗', msg, error?.message ?? '')
  process.exit(1)
}
const norm = (s) => (s ?? '').trim().toLowerCase()

// ── 1. Khách hàng ────────────────────────────────────────────────────────────
const { data: existingCustomers, error: ecErr } = await db
  .from('sales_customers')
  .select('id, name, code')
if (ecErr) die('đọc sales_customers', ecErr)
const customerByName = new Map(existingCustomers.map((c) => [norm(c.name), c]))
// Tên trên file ngắn ("YOTRIO GROUP", "MERXX HANDELS GMBH" khớp thẳng; LAURA/
// ROSCO là tên mới). Khớp lỏng: tên DB chứa tên plan hoặc ngược lại.
function findCustomer(name) {
  const k = norm(name)
  if (customerByName.has(k)) return customerByName.get(k)
  for (const [dbName, c] of customerByName) {
    if (dbName.includes(k) || k.includes(dbName)) return c
  }
  return null
}

for (const c of plan.customers) {
  if (findCustomer(c.name)) {
    console.log(`= KH đã có: ${c.name}`)
    continue
  }
  console.log(`+ KH mới: ${c.name} (${c.code})`)
  if (!APPLY) continue
  const { data, error } = await db
    .from('sales_customers')
    .insert({ name: c.name, code: c.code, is_active: true })
    .select('id, name')
    .single()
  if (error) die(`tạo KH ${c.name}`, error)
  customerByName.set(norm(data.name), data)
}

// ── SP để khớp dòng: ưu tiên mã khách, rồi mã HG ─────────────────────────────
const { data: products, error: pErr } = await db
  .from('technical_products')
  .select('id, code, name, customer_name, customer_item_code')
if (pErr) die('đọc technical_products', pErr)
const byCustCode = new Map()
for (const p of products) {
  if (p.customer_item_code) {
    const k = norm(p.customer_item_code)
    if (!byCustCode.has(k)) byCustCode.set(k, [])
    byCustCode.get(k).push(p)
  }
}
const byCode = new Map(products.map((p) => [norm(p.code), p]))
/**
 * Mã khách KHÔNG duy nhất toàn cục (bài học import BOM — 8/61 ca nhầm khách):
 * trùng nhiều SP thì thu hẹp theo `customer_name`, còn nhập nhằng thì đối chiếu
 * thêm TÊN trên dòng LSX (vd `21600-217` trỏ 2 SP nhưng tên "Ghế 5 bậc nhôm lưới
 * Tilos" chỉ khớp một); vẫn nhập nhằng thì bỏ khớp — thà thiếu link còn hơn dính
 * nhầm SP của khách khác.
 */
function matchProduct(custCode, customerName, lineNames = []) {
  if (!custCode) return null
  const k = norm(custCode)
  let hits = byCustCode.get(k) ?? []
  if (hits.length === 0) return byCode.get(k) ?? null
  if (hits.length > 1) {
    const cn = norm(customerName)
    const scoped = hits.filter(
      (p) => cn.includes(norm(p.customer_name)) || norm(p.customer_name).includes(cn),
    )
    if (scoped.length > 0) hits = scoped
  }
  if (hits.length === 1) return hits[0]
  const names = lineNames.map(norm).filter(Boolean)
  const byName = hits.filter((p) => names.some((n) => n === norm(p.name)))
  return byName.length === 1 ? byName[0] : null
}

// ── 2. Đơn hàng ──────────────────────────────────────────────────────────────
const { data: existingOrders, error: eoErr } = await db
  .from('sales_orders')
  .select('id, code')
if (eoErr) die('đọc sales_orders', eoErr)
const orderByCode = new Map(existingOrders.map((o) => [o.code, o]))
let unmatchedOrderLines = 0

for (const o of plan.orders) {
  if (orderByCode.has(o.code)) {
    console.log(`= Đơn đã có: ${o.code}`)
    continue
  }
  // Xem thử: KH mới chưa được tạo — dùng stub để vẫn xem được phần khớp SP.
  const cust = findCustomer(o.customer) ?? (APPLY ? null : { id: null })
  if (!cust) die(`đơn ${o.code}: không thấy KH ${o.customer}`)
  const lines = o.lines
    .map((l, i) => {
      const p = matchProduct(l.customer_item_code, o.customer, [l.name])
      if (!p) {
        unmatchedOrderLines++
        console.log(
          `  ! ${o.code}: bỏ dòng đơn "${l.customer_item_code || l.name}" — chưa khớp SP thư viện`,
        )
        return null
      }
      // File LSX không mang giá — 0 để kế toán/Sales điền sau, không bịa số.
      return {
        product_id: p.id,
        qty: l.qty,
        unit_price: 0,
        note: l.name || null,
        sort_order: i,
      }
    })
    .filter(Boolean)
  console.log(
    `+ Đơn ${o.code} (${o.customer}) — ${lines.length}/${o.lines.length} dòng khớp SP`,
  )
  if (!APPLY) continue
  const { data: order, error } = await db
    .from('sales_orders')
    .insert({
      code: o.code,
      customer_id: cust.id,
      customer_po_no: o.customer_po_no || null,
      status: 'confirmed',
      due_date: o.due_date ?? null,
      note: o.note || null,
    })
    .select('id, code')
    .single()
  if (error) die(`tạo đơn ${o.code}`, error)
  orderByCode.set(order.code, order)
  if (lines.length > 0) {
    const { error: lErr } = await db
      .from('sales_order_lines')
      .insert(lines.map((l) => ({ ...l, order_id: order.id })))
    if (lErr) die(`dòng đơn ${o.code}`, lErr)
  }
}

// ── 3. Lệnh sản xuất 3 cấp ───────────────────────────────────────────────────
const { data: existingLsx, error: elErr } = await db
  .from('production_orders')
  .select('id, code')
if (elErr) die('đọc production_orders', elErr)
const lsxByCode = new Map(existingLsx.map((l) => [l.code, l]))
let unmatchedLsxLines = 0

for (const l of plan.lsx) {
  if (lsxByCode.has(l.code)) {
    console.log(`= LSX đã có: ${l.code}`)
    continue
  }
  const cust = findCustomer(l.customer) ?? (APPLY ? null : { id: null })
  if (!cust) die(`LSX ${l.code}: không thấy KH ${l.customer}`)
  const totalLines = l.groups.reduce((s, g) => s + g.lines.length, 0)
  console.log(
    `+ LSX ${l.code} (${l.customer}) — ${l.groups.length} nhóm · ${totalLines} dòng`,
  )
  if (!APPLY) continue

  const { data: po, error } = await db
    .from('production_orders')
    .insert({
      code: l.code,
      customer_id: cust.id,
      status: 'approved', // lệnh thật, GĐ đã ký trên giấy — không bắt duyệt lại
      issued_at: l.issued_date ? `${l.issued_date}T00:00:00+07:00` : null,
      note: l.note || null,
      revision: l.revision ?? 0,
      revision_note: l.revision_note || null,
      revised_at: l.revision ? new Date().toISOString() : null,
    })
    .select('id, code')
    .single()
  if (error) die(`tạo LSX ${l.code}`, error)
  lsxByCode.set(po.code, po)

  const linkedOrderIds = new Set()
  for (const [gi, g] of l.groups.entries()) {
    const order = g.po_no
      ? (orderByCode.get(g.po_no) ?? orderByCode.get(`${g.po_no} HG-MX`) ?? null)
      : null
    if (order) linkedOrderIds.add(order.id)
    const { data: group, error: gErr } = await db
      .from('production_order_groups')
      .insert({
        production_order_id: po.id,
        sales_order_id: order?.id ?? null,
        title: g.title || null,
        buyer_name: g.buyer_name || null,
        po_no: g.po_no || null,
        ship_date: g.ship_date ?? null,
        ship_label: g.ship_label || null,
        note: g.note || null,
        sort_order: gi,
      })
      .select('id')
      .single()
    if (gErr) die(`nhóm ${l.code}/${g.title}`, gErr)

    const lineRows = g.lines.map((ln, i) => {
      const p = matchProduct(ln.customer_item_code, l.customer, [
        ln.name_vi,
        ln.name_foreign,
      ])
      if (!p && ln.customer_item_code) unmatchedLsxLines++
      return {
        production_order_id: po.id,
        group_id: group.id,
        product_id: p?.id ?? null, // FK mềm — mã lạ vẫn nhập, khớp SP sau
        // Snapshot bắt buộc (NOT NULL): chưa khớp thư viện thì in đúng chữ trên
        // phiếu gốc — kể cả "Thông báo sau" (docs/lsx-redesign.md §2.6).
        product_code: p?.code ?? ln.customer_item_code ?? '—',
        customer_item_code: ln.customer_item_code || null,
        name_foreign: ln.name_foreign || null,
        name_vi: ln.name_vi || null,
        name_customs: ln.name_customs || null,
        barcode: ln.barcode || null,
        unit: ln.unit || 'cái',
        qty: ln.qty,
        packing: ln.packing || null,
        cbm: ln.cbm ?? null,
        ship_date: ln.ship_date ?? null,
        ship_label: ln.ship_label || null,
        specs: ln.specs ?? {},
        checks: ln.checks ?? {},
        note: ln.note || null,
        important_note: ln.important_note || null,
        sort_order: i,
      }
    })
    if (lineRows.length > 0) {
      const { error: lnErr } = await db.from('production_order_lines').insert(lineRows)
      if (lnErr) die(`dòng ${l.code}/${g.title}`, lnErr)
    }
  }

  // Đơn trong lệnh: gắn ngược + chuyển 'lsx_issued' (đã phát lệnh).
  if (linkedOrderIds.size > 0) {
    const { error: uErr } = await db
      .from('sales_orders')
      .update({ production_order_id: po.id, status: 'lsx_issued' })
      .in('id', [...linkedOrderIds])
    if (uErr) die(`gắn đơn vào ${l.code}`, uErr)
  }
}

console.log(
  `\n${APPLY ? 'ĐÃ GHI' : 'XEM THỬ (chưa ghi — thêm --apply)'} · dòng đơn bỏ vì chưa khớp SP: ${unmatchedOrderLines} · dòng lệnh chưa khớp SP (vẫn nhập, thiếu link): ${unmatchedLsxLines}`,
)
