/**
 * Gán NGƯỜI TẠO cho đơn hàng + lệnh sản xuất nhập trước khi có tính năng.
 *
 *   node scripts/backfill-sales-owner.mjs            # chỉ in kế hoạch, KHÔNG ghi
 *   node scripts/backfill-sales-owner.mjs --apply    # ghi thật
 *
 * Vì sao cần: 20 đơn + 7 lệnh thật đều nhập bằng script import 05/08/2026, không
 * đi qua app, nên `sales_orders.created_by` và `production_orders.created_by`
 * đều trống. Script import KHÔNG lưu người chạy nên dữ liệu không tự suy ra
 * được — bảng phân công dưới đây do chủ dự án chốt (07/08/2026) theo KHÁCH HÀNG:
 *
 *   MERXX HANDELS GMBH → sale2  (Nguyễn Phạm Thanh Phương)
 *   LAURA              → sale2
 *   YOTRIO GROUP       → sale1  (Nguyễn T.Minh Hằng)
 *   ROSCO              → sale1
 *
 * Đồng thời set `sales_customers.owner_id` cho khớp — trước đây MERXX/YOTRIO
 * đang treo "Quản trị viên", ROSCO/LAURA chưa gán ai.
 *
 * CHỈ ĐIỀN CHỖ TRỐNG: bản ghi nào đã có người tạo thì giữ nguyên, không đè.
 * Chạy lại vô hại.
 */
import { readFileSync } from 'node:fs'
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

const APPLY = process.argv.includes('--apply')

/** Khách → email tài khoản sale phụ trách (chủ dự án chốt 07/08/2026). */
const OWNER_BY_CUSTOMER = {
  'MERXX HANDELS GMBH': 'sale2@hoanggia.de',
  LAURA: 'sale2@hoanggia.de',
  'YOTRIO GROUP': 'sale1@hoanggia.de',
  ROSCO: 'sale1@hoanggia.de',
}

function die(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function sel(table, cols, apply = (q) => q) {
  const { data, error } = await apply(sb.from(table).select(cols))
  if (error) die(`${table}: ${error.message}`)
  return data
}

// ── 1. Tra tài khoản sale ──────────────────────────────────────────────────
const emails = [...new Set(Object.values(OWNER_BY_CUSTOMER))]
const users = await sel('users', 'id, email, name, is_active', (q) =>
  q.in('email', emails),
)
const userByEmail = new Map(users.map((u) => [u.email, u]))
for (const e of emails) {
  const u = userByEmail.get(e)
  if (!u) die(`Không tìm thấy tài khoản ${e}`)
  if (!u.is_active) die(`Tài khoản ${e} đang bị khoá`)
}

// ── 2. Khách hàng ──────────────────────────────────────────────────────────
const customers = await sel('sales_customers', 'id, name, owner_id')
const unmapped = customers.filter((c) => !(c.name in OWNER_BY_CUSTOMER))
if (unmapped.length) {
  die(
    `Có khách chưa nằm trong bảng phân công: ${unmapped.map((c) => c.name).join(', ')}.\n` +
      `  Bổ sung vào OWNER_BY_CUSTOMER rồi chạy lại — thà dừng còn hơn gán nhầm chủ.`,
  )
}
const ownerIdOf = (customerId) => {
  const c = customers.find((x) => x.id === customerId)
  return userByEmail.get(OWNER_BY_CUSTOMER[c.name]).id
}

// ── 3. Gom việc ────────────────────────────────────────────────────────────
const orders = await sel('sales_orders', 'id, code, customer_id, created_by')
const lsx = await sel('production_orders', 'id, code, customer_id, created_by')

const plan = {
  customers: customers
    .filter((c) => c.owner_id !== userByEmail.get(OWNER_BY_CUSTOMER[c.name]).id)
    .map((c) => ({
      id: c.id,
      label: c.name,
      to: userByEmail.get(OWNER_BY_CUSTOMER[c.name]),
    })),
  // Đơn/lệnh: CHỈ điền chỗ trống, không đè người tạo có sẵn.
  orders: orders
    .filter((o) => !o.created_by)
    .map((o) => ({
      id: o.id,
      label: o.code,
      to: users.find((u) => u.id === ownerIdOf(o.customer_id)),
    })),
  lsx: lsx
    .filter((p) => !p.created_by)
    .map((p) => ({
      id: p.id,
      label: p.code,
      to: users.find((u) => u.id === ownerIdOf(p.customer_id)),
    })),
}

const byOwner = (rows) => {
  const m = new Map()
  for (const r of rows) m.set(r.to.name, (m.get(r.to.name) ?? 0) + 1)
  return [...m.entries()].map(([n, c]) => `${n}: ${c}`).join(' · ') || '—'
}

console.log(`Phụ trách khách hàng cần đặt lại (${plan.customers.length}):`)
for (const c of plan.customers) console.log(`  ${c.label.padEnd(22)} → ${c.to.name}`)
console.log(
  `\nĐơn hàng còn trống người tạo (${plan.orders.length}) — ${byOwner(plan.orders)}`,
)
for (const o of plan.orders) console.log(`  ${o.label.padEnd(22)} → ${o.to.name}`)
console.log(`\nLệnh SX còn trống người lập (${plan.lsx.length}) — ${byOwner(plan.lsx)}`)
for (const p of plan.lsx) console.log(`  ${p.label.padEnd(22)} → ${p.to.name}`)

const skippedOrders = orders.length - plan.orders.length
const skippedLsx = lsx.length - plan.lsx.length
if (skippedOrders || skippedLsx) {
  console.log(`\nGiữ nguyên (đã có người tạo): ${skippedOrders} đơn · ${skippedLsx} lệnh`)
}

if (!APPLY) {
  console.log('\n(chưa ghi — chạy lại với --apply để thực hiện)')
  process.exit(0)
}

// ── 4. Ghi ─────────────────────────────────────────────────────────────────
async function patch(table, column, rows, label) {
  if (!rows.length) return
  let n = 0
  for (const r of rows) {
    const { error } = await sb
      .from(table)
      .update({ [column]: r.to.id })
      .eq('id', r.id)
    if (error) die(`${label} ${r.label}: ${error.message}`)
    n += 1
  }
  console.log(`✓ ${label}: ${n} bản ghi`)
}

console.log('')
await patch('sales_customers', 'owner_id', plan.customers, 'Phụ trách khách hàng')
await patch('sales_orders', 'created_by', plan.orders, 'Người tạo đơn')
await patch('production_orders', 'created_by', plan.lsx, 'Người lập lệnh')
