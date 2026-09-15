// VÁ: 13 đơn hàng tạo ngày 15/09/2026 bị RỖNG RUỘT — có đầu đơn, không có dòng.
//
//   node scripts/lsx-va-dong-don-0915.mjs           # DRY-RUN
//   node scripts/lsx-va-dong-don-0915.mjs --apply   # ghi thật
//
// `scripts/lsx-bo-sung-0915.mjs` tạo đơn để nối chuỗi chứng từ nhưng QUÊN sinh
// `sales_order_lines`, nên đơn mở ra trống trơn và `production_order_lines.
// sales_order_line_id` cũng bỏ trống — mất đường quy số liệu sản xuất về đơn.
//
// Cách vá: mỗi dòng lệnh của nhóm gắn với đơn → một dòng đơn (1:1, đơn giá 0 vì
// file LSX không có giá), rồi trỏ ngược `sales_order_line_id`. Đúng khuôn mà
// `lsx-lines.service.ts` dùng khi nạp nháp từ đơn, chỉ chạy theo chiều ngược.
//
// Đơn nào LSX đã DUYỆT thì đẩy trạng thái sang `lsx_issued` cho bằng các đơn
// cùng khách; LSX còn NHÁP thì giữ `confirmed`.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)

const { data: orders, error } = await db
  .from('sales_orders')
  .select('id, code, status, due_date, production_order_id')
  .order('code')
if (error) throw new Error(error.message)

const { data: lsxs } = await db.from('production_orders').select('id, code, status')
const lsxById = new Map(lsxs.map((l) => [l.id, l]))

let fixedOrders = 0
let madeLines = 0
let linked = 0
let statusMoved = 0

console.log(`\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — vá dòng đơn\n`)

for (const o of orders) {
  const { count } = await db
    .from('sales_order_lines')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', o.id)
  if (count) continue

  // dòng lệnh thuộc các nhóm đang gắn với đơn này
  const { data: groups } = await db
    .from('production_order_groups')
    .select('id')
    .eq('sales_order_id', o.id)
  if (!groups?.length) {
    console.log(`  ! ${o.code}: không nhóm nào gắn với đơn — bỏ qua`)
    continue
  }
  const { data: lines } = await db
    .from('production_order_lines')
    .select('id, product_id, qty, ship_date, note, sales_order_line_id, sort_order')
    .in(
      'group_id',
      groups.map((g) => g.id),
    )
    .order('sort_order')
  if (!lines?.length) {
    console.log(`  ! ${o.code}: nhóm không có dòng nào — bỏ qua`)
    continue
  }
  const lsx = lsxById.get(o.production_order_id)
  const wantStatus =
    lsx && ['approved', 'in_progress', 'completed'].includes(lsx.status)
      ? 'lsx_issued'
      : o.status
  console.log(
    `  + ${o.code.padEnd(15)} ${String(lines.length).padStart(2)} dòng, ` +
      `${lines.reduce((a, b) => a + Number(b.qty), 0)} sp` +
      (wantStatus !== o.status ? `  · trạng thái ${o.status} → ${wantStatus}` : ''),
  )
  fixedOrders++
  madeLines += lines.length
  if (wantStatus !== o.status) statusMoved++
  if (!APPLY) continue

  const rows = lines.map((l, i) => ({
    order_id: o.id,
    product_id: l.product_id,
    qty: l.qty,
    unit_price: 0,
    ship_date: l.ship_date ?? o.due_date ?? null,
    note: null,
    sort_order: i,
  }))
  const { data: made, error: e1 } = await db
    .from('sales_order_lines')
    .insert(rows)
    .select('id, sort_order')
  if (e1) throw new Error(`${o.code}: ${e1.message}`)
  const bySort = new Map(made.map((m) => [m.sort_order, m.id]))
  for (const [i, l] of lines.entries()) {
    if (l.sales_order_line_id) continue
    const e2 = (
      await db
        .from('production_order_lines')
        .update({ sales_order_line_id: bySort.get(i) })
        .eq('id', l.id)
    ).error
    if (e2) throw new Error(`${o.code} nối dòng: ${e2.message}`)
    linked++
  }
  if (wantStatus !== o.status) {
    const e3 = (
      await db.from('sales_orders').update({ status: wantStatus }).eq('id', o.id)
    ).error
    if (e3) throw new Error(`${o.code} trạng thái: ${e3.message}`)
  }
}

console.log(
  `\n  đơn được vá: ${fixedOrders} · dòng đơn sinh ra: ${madeLines} · ` +
    `dòng lệnh nối ngược: ${APPLY ? linked : madeLines} · đổi trạng thái: ${statusMoved}`,
)
if (!APPLY) console.log('\nChạy lại với --apply để ghi.\n')
else console.log('\n✓ Xong.\n')
