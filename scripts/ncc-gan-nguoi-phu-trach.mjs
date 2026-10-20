// ĐIỀN SẴN NGƯỜI PHỤ TRÁCH NCC (buyer_id) THEO LỊCH SỬ ĐƠN — 27/09/2026.
//
//   node scripts/ncc-gan-nguoi-phu-trach.mjs            # dò khô, in bảng
//   node scripts/ncc-gan-nguoi-phu-trach.mjs --apply    # ghi
//
// Chủ dự án chốt (Q3, cá nhân hoá Cung ứng): cột `supply_suppliers.buyer_id` có
// sẵn từ 0046 nhưng 0/174 NCC được điền và không màn nào dùng; trong khi việc
// tách theo NCC rất rõ — 45/46 NCC từng có đơn chỉ MỘT người đặt. Điền sẵn một
// lần theo lịch sử, từ đó người mua sửa ở hồ sơ NCC.
//
// Luật (CÙNG hàm `inferSupplierBuyer` của app, lib/supply-scope): người có
// NHIỀU đơn nhất với NCC, hoà thì người đặt gần nhất. Chỉ điền NCC đang TRỐNG
// — không bao giờ ghi đè một lần gán tay. Người được gán phải còn làm việc.
import { createJiti } from 'jiti'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const jiti = createJiti(import.meta.url, { alias: { '@': new URL('../src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') } }) // prettier-ignore
const { inferSupplierBuyer } = await jiti.import('../src/lib/supply-scope.ts')

async function every(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}
const [sups, pos, users] = await Promise.all([
  every('supply_suppliers', 'id, code, name, buyer_id'),
  every(
    'supply_purchase_orders',
    'supplier_id, assigned_to, created_by, created_at, status',
  ),
  every('users', 'id, name, is_active, deleted_at'),
])
const alive = new Map(
  users.filter((u) => u.is_active && !u.deleted_at).map((u) => [u.id, u.name]),
)
const guess = inferSupplierBuyer(pos.filter((p) => p.status !== 'cancelled'))

const plan = []
let skipGone = 0
for (const s of sups) {
  if (s.buyer_id) continue
  const who = guess.get(s.id)
  if (!who) continue
  if (!alive.has(who)) {
    skipGone++
    continue
  }
  plan.push({ s, who })
}
const byWho = {}
for (const p of plan) byWho[alive.get(p.who)] = (byWho[alive.get(p.who)] ?? 0) + 1
console.log(
  `NCC đã gán sẵn: ${sups.filter((s) => s.buyer_id).length} · sẽ điền: ${plan.length} · bỏ qua (người đặt đã nghỉ): ${skipGone}`,
)
console.log('Theo người:', byWho)
for (const p of plan.slice(0, 60))
  console.log(
    `  ${(p.s.code ?? '—').padEnd(8)} ${p.s.name.slice(0, 50).padEnd(50)} → ${alive.get(p.who)}`,
  )
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}
let n = 0
for (const p of plan) {
  const { error } = await sb
    .from('supply_suppliers')
    .update({ buyer_id: p.who })
    .eq('id', p.s.id)
    .is('buyer_id', null)
  if (error) throw new Error(`${p.s.name}: ${error.message}`)
  n++
}
console.log(`\nĐã điền ${n} NCC.`)
