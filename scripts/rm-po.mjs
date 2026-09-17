// XOÁ HẲN MỘT ĐƠN MUA KHỎI CSDL — đường không có trên màn hình, cố ý.
//
// App chỉ cho xoá đơn NHÁP. Đơn đã gửi / đã nhận thì huỷ (`cancelled`) chứ
// không xoá, vì nó đã kéo theo phiếu kho, hoá đơn, kế hoạch vật tư — xoá là
// mấy thứ đó thành mồ côi. Script này dành cho đúng ca chủ dự án chốt bằng
// miệng: một tờ đơn gõ thử lỡ đi hết vòng đời, muốn xoá sạch vết.
//
// LUÔN CHẠY `--dry` TRƯỚC. Nó liệt kê mọi bản ghi đang trỏ tới đơn và nói rõ
// cái nào sẽ bị xoá, cái nào script từ chối động vào.
//
//   node scripts/rm-po.mjs --code PO-2026-0035 --dry
//   node scripts/rm-po.mjs --code PO-2026-0035 --yes
//
// `--yes` mới thật sự xoá, và luôn ghi backup JSON vào backups/ trước khi xoá.

import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

const args = process.argv.slice(2)
const arg = (k) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : undefined
}
const CODE = arg('--code')
const DRY = args.includes('--dry')
const YES = args.includes('--yes')
if (!CODE) {
  console.error('Thiếu --code <mã đơn>')
  process.exit(1)
}
if (!DRY && !YES) {
  console.error('Phải có --dry (chỉ xem) hoặc --yes (xoá thật)')
  process.exit(1)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

const sel = async (table, col, vals) => {
  if (!vals.length) return []
  const { data, error } = await db.from(table).select('*').in(col, vals)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

const { data: po, error: poErr } = await db
  .from('supply_purchase_orders')
  .select('*')
  .eq('code', CODE)
  .maybeSingle()
if (poErr) throw poErr
if (!po) {
  console.error(`Không có đơn nào mã ${CODE}`)
  process.exit(1)
}

const lines = await sel('supply_purchase_order_lines', 'po_id', [po.id])
const lineIds = lines.map((l) => l.id)

const movements = await sel('warehouse_movements', 'po_line_id', lineIds)
const docIds = [...new Set(movements.map((m) => m.doc_id).filter(Boolean))]
const docs = await sel('warehouse_docs', 'id', docIds)

// Phiếu kho có thể gom hàng của NHIỀU đơn. Chỉ xoá phiếu nào TOÀN BỘ dòng đều
// thuộc đơn này; phiếu dùng chung thì chỉ rút dòng của đơn ra, giữ phiếu lại.
const mvByDoc = new Map()
for (const d of docIds) mvByDoc.set(d, [])
const { data: allDocMvs } = docIds.length
  ? await db
      .from('warehouse_movements')
      .select('id, doc_id, po_line_id')
      .in('doc_id', docIds)
  : { data: [] }
for (const m of allDocMvs ?? []) mvByDoc.get(m.doc_id)?.push(m)
const ownLines = new Set(lineIds)
const docsFullyOwned = docs.filter((d) =>
  (mvByDoc.get(d.id) ?? []).every((m) => m.po_line_id && ownLines.has(m.po_line_id)),
)
const docsShared = docs.filter((d) => !docsFullyOwned.includes(d))

const shipments = await sel('supply_po_shipments', 'po_id', [po.id])
const shipmentLines = await sel(
  'supply_po_shipment_lines',
  'shipment_id',
  shipments.map((s) => s.id),
)
const extraLsx = await sel('supply_po_extra_lsx', 'po_id', [po.id])
const lineLsx = await sel('supply_po_line_lsx', 'line_id', lineIds)
const invoiceLines = await sel('accounting_supplier_invoice_lines', 'po_line_id', lineIds)
const payments = await sel('accounting_supplier_payments', 'po_id', [po.id])
const plan = await sel('supply_lsx_material_plan', 'po_line_id', lineIds)

const n = (a) => a.length
console.log(`\n${CODE} · ${po.status} · tạo ${String(po.created_at).slice(0, 10)}`)
console.log('─'.repeat(64))
console.log(`  dòng đơn                     ${n(lines)}`)
console.log(`  chuyển động kho              ${n(movements)}`)
console.log(
  `  phiếu kho XOÁ CẢ PHIẾU       ${n(docsFullyOwned)}  ${docsFullyOwned.map((d) => d.code).join(', ')}`,
)
console.log(
  `  phiếu kho DÙNG CHUNG (giữ)   ${n(docsShared)}  ${docsShared.map((d) => d.code).join(', ')}`,
)
console.log(`  đợt giao                     ${n(shipments)} (dòng: ${n(shipmentLines)})`)
console.log(`  lệnh mua chung               ${n(extraLsx)}`)
console.log(`  phân bổ dòng → lệnh          ${n(lineLsx)}`)
console.log(`  dòng hoá đơn NCC             ${n(invoiceLines)}`)
console.log(`  phiếu trả tiền               ${n(payments)}`)
console.log(`  kế hoạch vật tư của lệnh     ${n(plan)}`)
console.log('─'.repeat(64))

// HAI THỨ KHÔNG ĐƯỢC PHÉP XOÁ KÈM: hoá đơn NCC và phiếu trả tiền là sổ kế
// toán, không phải sổ mua hàng. Có chúng thì dừng — người chốt phải biết là
// mình đang định xoá một đơn đã lên sổ tiền.
if (invoiceLines.length > 0 || payments.length > 0) {
  console.error('\nDỪNG: đơn này đã có hoá đơn hoặc phiếu trả tiền. Xử ở Kế toán trước.')
  process.exit(2)
}

if (DRY) {
  console.log('\n(--dry: không xoá gì)')
  process.exit(0)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const backup = `backups/${CODE.toLowerCase()}-xoa-${stamp}.json`
writeFileSync(
  new URL(`../${backup}`, import.meta.url),
  JSON.stringify(
    { po, lines, movements, docs, shipments, shipmentLines, extraLsx, lineLsx, plan },
    null,
    2,
  ),
)
console.log(`\nĐã ghi backup: ${backup}`)

const del = async (table, col, vals, label) => {
  if (!vals.length) return
  const { error, count } = await db.from(table).delete({ count: 'exact' }).in(col, vals)
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`  xoá ${label}: ${count ?? '?'}`)
}

// Thứ tự: con trước, cha sau — không dựa vào ON DELETE CASCADE vì mỗi FK một kiểu.
await del('supply_lsx_material_plan', 'po_line_id', lineIds, 'kế hoạch vật tư')
await del('supply_po_line_lsx', 'line_id', lineIds, 'phân bổ dòng → lệnh')
await del('supply_po_extra_lsx', 'po_id', [po.id], 'lệnh mua chung')
await del('supply_po_shipment_lines', 'shipment_id', shipments.map((s) => s.id), 'dòng đợt giao') // prettier-ignore
await del('supply_po_shipments', 'po_id', [po.id], 'đợt giao')
await del('warehouse_movements', 'id', movements.map((m) => m.id), 'chuyển động kho') // prettier-ignore
await del('warehouse_docs', 'id', docsFullyOwned.map((d) => d.id), 'phiếu kho') // prettier-ignore
await del('supply_purchase_order_lines', 'po_id', [po.id], 'dòng đơn')
await del('supply_purchase_orders', 'id', [po.id], 'đơn')

console.log('\nXong.')
