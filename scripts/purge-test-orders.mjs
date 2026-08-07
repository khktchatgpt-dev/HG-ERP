/**
 * Dọn DỮ LIỆU TEST tầng bán hàng / sản xuất (chủ dự án chốt 07/08/2026).
 *
 *   node scripts/purge-test-orders.mjs            # chỉ DUMP + in kế hoạch, KHÔNG xoá
 *   node scripts/purge-test-orders.mjs --apply    # dump rồi xoá thật
 *
 * Phạm vi (đã chốt) — liệt kê TƯỜNG MINH từng mã, không dò theo mẫu chữ, để chạy
 * lại không bao giờ quét trúng dữ liệu mới:
 *   · 10 ĐƠN HÀNG mã chứa TEST/DEMO, cộng `DH-2026-0001` (đơn seed mẫu ban đầu).
 *   · 6 LỆNH SX chỉ phục vụ mấy đơn đó.
 *   · 1 KHÁCH HÀNG test: "Test KH Không Email".
 *
 * CHẠY LẠI ĐƯỢC: mã nào không còn trong DB thì coi như đã xoá xong và bỏ qua.
 * Ngược lại, nếu tìm thấy bản ghi mang dáng test NGOÀI danh sách thì DỪNG — dữ
 * liệu đã đổi từ lúc rà soát, phải xem lại bằng mắt trước khi xoá.
 *
 * GIỮ LẠI có chủ ý:
 *   · 20 đơn thật của lô import 05/08 (MERXX / YOTRIO / ROSCO) và 7 lệnh thật
 *     `01..04/26-27 - *`.
 *   · `LSX-2026-0001` — bị 3 đơn mua NCC (PO-2026-0001/0002/0003) bám bằng FK
 *     RESTRICT. Xoá nó phải xử 3 PO trước, mà PO thuộc tầng cung ứng nên để chủ
 *     dự án quyết riêng.
 *   · Báo giá BG-*, PO DEMO-PO-*, phiếu kho PNK/PXK, mẫu MS-*, hoá đơn
 *     NCC-2026-001, SP TEST-BANK1/2, tài khoản *.test@hg.com — NGOÀI phạm vi.
 *
 * Cascade tự lo (đã soi information_schema): sales_order_lines,
 * sales_order_changes, files theo đơn, và production_order_lines /
 * production_order_groups / jobs / entries theo lệnh. `sales_orders
 * .production_order_id` là SET NULL nên thứ tự xoá không gây lỗi; script vẫn xoá
 * ĐƠN → LỆNH → KHÁCH cho khớp chiều phụ thuộc.
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

const APPLY = process.argv.includes('--apply')

const ORDER_CODES = [
  'DEMO-DH-01',
  'DH-2026-0001',
  'HG-TEST-TERMS-01',
  'TEST-DH-SX1',
  'TEST-DH-SX2',
  'TEST-DH-SX3',
  'TEST-DH-SX4',
  'ZZTEST-DH-1',
  'ZZTEST-DH-2',
  'ZZTEST-DH-KHACKH',
]
const LSX_CODES = [
  'DEMO-LSX-01',
  'TEST-LSX-SX1',
  'TEST-LSX-SX2',
  'TEST-LSX-SX3',
  'TEST-LSX-SX4',
  'ZZTEST-LSX-1',
]
const CUSTOMER_NAMES = ['Test KH Không Email']

/** Bản ghi "dáng test" — dùng để phát hiện thứ NGOÀI danh sách, không để xoá. */
const LOOKS_TEST = /test|demo/i

function die(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function sel(table, cols, apply = (q) => q) {
  const { data, error } = await apply(sb.from(table).select(cols))
  if (error) die(`${table}: ${error.message}`)
  return data
}

/**
 * Đối chiếu danh sách mã cần xoá với thực tế. Thiếu = đã xoá xong (bỏ qua).
 * Có bản ghi dáng test ngoài danh sách = DỪNG.
 */
function reconcile(label, rows, key, wanted) {
  const found = rows.filter((r) => wanted.includes(r[key]))
  const gone = wanted.filter((w) => !rows.some((r) => r[key] === w))
  const unexpected = rows.filter(
    (r) => !wanted.includes(r[key]) && LOOKS_TEST.test(r[key]),
  )
  if (unexpected.length) {
    die(
      `${label}: có bản ghi dáng test NGOÀI danh sách đã chốt: ` +
        `${unexpected.map((r) => r[key]).join(', ')}.\n` +
        `  Xem lại bằng mắt rồi bổ sung vào danh sách trong script nếu đúng là test.`,
    )
  }
  if (gone.length) console.log(`  (${label}: ${gone.length} mã đã xoá từ trước — bỏ qua)`)
  return found
}

// ── 1. Xác định tập cần xoá ────────────────────────────────────────────────
const allOrders = await sel('sales_orders', '*', (q) => q.order('code'))
const orders = reconcile('đơn hàng', allOrders, 'code', ORDER_CODES)
const orderIds = orders.map((o) => o.id)

const allLsx = await sel('production_orders', '*', (q) => q.order('code'))
const lsx = reconcile('lệnh SX', allLsx, 'code', LSX_CODES)
const lsxIds = lsx.map((p) => p.id)

const allCustomers = await sel('sales_customers', '*', (q) => q.order('name'))
const customers = reconcile('khách hàng', allCustomers, 'name', CUSTOMER_NAMES)
const customerIds = customers.map((c) => c.id)

if (!orders.length && !lsx.length && !customers.length) {
  console.log('Không còn gì để xoá — DB đã sạch theo danh sách đã chốt.')
  process.exit(0)
}

// ── 2. Chốt an toàn ────────────────────────────────────────────────────────
// (a) Lệnh sắp xoá không được kéo theo đơn THẬT: xoá lệnh sẽ SET NULL
//     production_order_id của đơn đó, mất liên kết đơn ↔ lệnh mà không ai biết.
const strays = allOrders.filter(
  (o) =>
    o.production_order_id &&
    lsxIds.includes(o.production_order_id) &&
    !orderIds.includes(o.id),
)
if (strays.length) {
  die(
    `Lệnh test đang chứa đơn NGOÀI phạm vi xoá: ${strays.map((o) => o.code).join(', ')}.\n` +
      `  Tách các đơn này ra khỏi lệnh trước, rồi chạy lại.`,
  )
}

// (b) PO bám vào lệnh sắp xoá (FK RESTRICT) sẽ làm DELETE thất bại.
if (lsxIds.length) {
  const pos = await sel(
    'supply_purchase_orders',
    'code, status, production_order_id',
    (q) => q.in('production_order_id', lsxIds),
  )
  if (pos.length) {
    die(
      `Có ${pos.length} đơn mua NCC bám vào lệnh sắp xoá (FK RESTRICT sẽ chặn):\n` +
        pos.map((p) => `    ${p.code} (${p.status})`).join('\n'),
    )
  }
}

// (c) Khách sắp xoá phải TRỐNG: 3 FK về khách là RESTRICT (đơn / báo giá / lệnh)
//     nên còn bản ghi là DB tự chặn — kiểm trước để thông báo cho người đọc hiểu.
for (const c of customers) {
  const [orders_, quotes_, lsx_] = await Promise.all([
    sel('sales_orders', 'code', (q) => q.eq('customer_id', c.id)),
    sel('sales_quotes', 'code', (q) => q.eq('customer_id', c.id)),
    sel('production_orders', 'code', (q) => q.eq('customer_id', c.id)),
  ])
  const busy = [
    ...orders_.map((r) => `đơn ${r.code}`),
    ...quotes_.map((r) => `báo giá ${r.code}`),
    ...lsx_.map((r) => `lệnh ${r.code}`),
  ]
  if (busy.length) {
    die(
      `Khách "${c.name}" còn ${busy.length} chứng từ bám vào (FK RESTRICT sẽ chặn):\n` +
        busy.map((b) => `    ${b}`).join('\n'),
    )
  }
}

// ── 3. Dump ────────────────────────────────────────────────────────────────
const empty = async () => []
const [orderLines, orderChanges, orderFiles, lsxLines, lsxGroups, lsxFiles] =
  await Promise.all([
    orderIds.length
      ? sel('sales_order_lines', '*', (q) => q.in('order_id', orderIds))
      : empty(),
    orderIds.length
      ? sel('sales_order_changes', '*', (q) => q.in('order_id', orderIds))
      : empty(),
    orderIds.length
      ? sel('files', '*', (q) => q.in('sales_order_id', orderIds))
      : empty(),
    lsxIds.length
      ? sel('production_order_lines', '*', (q) => q.in('production_order_id', lsxIds))
      : empty(),
    lsxIds.length
      ? sel('production_order_groups', '*', (q) => q.in('production_order_id', lsxIds))
      : empty(),
    lsxIds.length
      ? sel('files', '*', (q) => q.in('production_order_id', lsxIds))
      : empty(),
  ])

const backup = {
  note:
    'Dữ liệu test tầng bán hàng/sản xuất, dump trước khi xoá (07/08/2026). ' +
    'Nạp lại theo thứ tự: sales_customers → production_orders → sales_orders → *_lines/groups/changes.',
  scope: {
    orders: orders.map((o) => o.code),
    production_orders: lsx.map((p) => p.code),
    customers: customers.map((c) => c.name),
    kept_on_purpose: {
      'LSX-2026-0001': '3 đơn mua NCC bám bằng FK RESTRICT — xử PO trước',
    },
  },
  sales_customers: customers,
  sales_orders: orders,
  sales_order_lines: orderLines,
  sales_order_changes: orderChanges,
  production_orders: lsx,
  production_order_lines: lsxLines,
  production_order_groups: lsxGroups,
  files: [...orderFiles, ...lsxFiles],
}

mkdirSync('supabase/backups', { recursive: true })
// Mỗi lần chạy ghi một file riêng theo bước, để lần chạy sau không đè bản dump
// của lần trước (bản trước là bằng chứng duy nhất của những gì đã xoá).
const stamp = orders.length ? 'orders-lsx' : customers.length ? 'customer' : 'misc'
const path = `supabase/backups/2026-08-07_purge-test-${stamp}.json`
writeFileSync(path, JSON.stringify(backup, null, 2), 'utf8')
console.log(`\nĐã dump → ${path}`)

if (orders.length) {
  console.log(`\nĐƠN sẽ xoá (${orders.length}):`)
  for (const o of orders) console.log(`  ${o.code.padEnd(18)} ${o.status}`)
}
if (lsx.length) {
  console.log(`\nLỆNH SX sẽ xoá (${lsx.length}):`)
  for (const p of lsx) console.log(`  ${p.code.padEnd(18)} ${p.status}`)
}
if (customers.length) {
  console.log(`\nKHÁCH HÀNG sẽ xoá (${customers.length}):`)
  for (const c of customers) console.log(`  ${c.name}`)
}
console.log(
  `\nCascade kéo theo: ${orderLines.length} dòng đơn · ${orderChanges.length} bản ghi sửa đơn · ` +
    `${lsxLines.length} dòng lệnh · ${lsxGroups.length} nhóm lệnh · ` +
    `${orderFiles.length + lsxFiles.length} file`,
)

if (!APPLY) {
  console.log('\n(chưa xoá — chạy lại với --apply để thực hiện)')
  process.exit(0)
}

// ── 4. Xoá ─────────────────────────────────────────────────────────────────
async function purge(table, ids, label) {
  if (!ids.length) return
  const { data, error } = await sb.from(table).delete().in('id', ids).select('id')
  if (error) die(`Xoá ${label} thất bại: ${error.message}`)
  console.log(`✓ Đã xoá ${data.length} ${label}`)
}

console.log('')
await purge('sales_orders', orderIds, 'đơn hàng')
await purge('production_orders', lsxIds, 'lệnh sản xuất')
await purge('sales_customers', customerIds, 'khách hàng')

const [{ count: ordersLeft }, { count: lsxLeft }, { count: custLeft }] =
  await Promise.all([
    sb.from('sales_orders').select('*', { count: 'exact', head: true }),
    sb.from('production_orders').select('*', { count: 'exact', head: true }),
    sb.from('sales_customers').select('*', { count: 'exact', head: true }),
  ])
console.log(
  `\nCòn lại: ${ordersLeft} đơn hàng · ${lsxLeft} lệnh sản xuất · ${custLeft} khách hàng`,
)
