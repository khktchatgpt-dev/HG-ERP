// XOÁ 3 ĐƠN MUA NHÁP — theo lệnh chủ dự án 27/09/2026, CÓ SAO LƯU.
//
//   node scripts/po-xoa-nhap-rong-trung-0927.mjs            # dò khô: in những gì sẽ xoá
//   node scripts/po-xoa-nhap-rong-trung-0927.mjs --apply    # sao lưu JSON rồi xoá
//
// · PO-2026-0042, PO-2026-0060 — nháp RỖNG (0 dòng), NCC Cơ khí Hoài Thương,
//   nạp 03/09 từ file giấy "Khớp nối chân nhôm Siena" SL 300 / 200 mà chưa chọn
//   được mã. Chủ dự án chọn xoá.
// · 01HG/MĐ — gia công Minh Đạt, TRÙNG y hệt ĐH01HGMĐ (13 dòng, cùng SL, cùng
//   giá; hai file nguồn khác nhau). Giữ ĐH01HGMĐ (có hẹn giao 25/06).
//
// Hàng rào: chỉ xoá đơn còn NHÁP và KHÔNG có phiếu nhập / thanh toán / hoá đơn
// / phân bổ chi phí nào trỏ tới — có là dừng cả lượt, không xoá gì.
// Bản sao lưu: backups/po-xoa-0927.json (mọi dòng liên quan, đủ để khôi phục).
import fs from 'node:fs'
import path from 'node:path'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const CODES = ['PO-2026-0042', 'PO-2026-0060', '01HG/MĐ']
const KEEP = 'ĐH01HGMĐ'
const sb = await client(import.meta.url)

const q = async (table, col, ids) => {
  if (ids.length === 0) return []
  const { data, error } = await sb.from(table).select('*').in(col, ids)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

const { data: pos, error } = await sb
  .from('supply_purchase_orders')
  .select('*')
  .in('code', CODES)
if (error) throw error
if (pos.length !== CODES.length)
  throw new Error(`Chỉ tìm thấy ${pos.length}/${CODES.length} đơn — dừng.`)
for (const p of pos)
  if (p.status !== 'draft')
    throw new Error(`${p.code} không còn nháp (${p.status}) — dừng.`)
const { data: keep } = await sb
  .from('supply_purchase_orders')
  .select('id, code, status')
  .eq('code', KEEP)
if (keep?.length !== 1) throw new Error(`Không thấy đơn giữ lại ${KEEP} — dừng.`)

const ids = pos.map((p) => p.id)
const lines = await q('supply_purchase_order_lines', 'po_id', ids)
const lineIds = lines.map((l) => l.id)
const b = {
  at: new Date().toISOString(),
  reason:
    'Chủ dự án 27/09/2026: xoá 2 nháp rỗng Hoài Thương + đơn trùng 01HG/MĐ (giữ ĐH01HGMĐ)',
  purchase_orders: pos,
  lines,
  extra_lsx: await q('supply_po_extra_lsx', 'po_id', ids),
  shipments: await q('supply_po_shipments', 'po_id', ids),
  shipment_lines: await q('supply_po_shipment_lines', 'po_line_id', lineIds),
  line_lsx: await q('supply_po_line_lsx', 'line_id', lineIds),
  adjustments: await q('supply_po_adjustments', 'po_id', ids),
  commit_log: await q('supply_po_commit_log', 'po_id', ids),
  issues: await q('supply_po_issues', 'po_id', ids),
  files: await q('files', 'purchase_order_id', ids),
  doc_notes: (await q('doc_notes', 'doc_id', ids)).filter((n) => n.doc_type === 'po'),
  material_plan_refs: await q('supply_lsx_material_plan', 'po_line_id', lineIds),
  children: await q('supply_purchase_orders', 'source_po_id', ids),
}
// Hàng rào — những thứ này có nghĩa là đơn đã đi vào sổ sách.
const blockers = {
  movements: await q('warehouse_movements', 'po_line_id', lineIds),
  payments: await q('accounting_supplier_payments', 'po_id', ids),
  invoice_lines: await q('accounting_supplier_invoice_lines', 'po_line_id', lineIds),
  cost_allocations: await q('supply_po_cost_allocations', 'po_id', ids),
}

for (const p of pos)
  console.log(
    `${p.code} · ${p.status} · ${lines.filter((l) => l.po_id === p.id).length} dòng`,
  )
console.log(`Đơn giữ lại: ${keep[0].code} (${keep[0].status})`)
for (const [k, v] of Object.entries(b))
  if (Array.isArray(v)) console.log(`  ${k}: ${v.length}`)
const blocked = Object.entries(blockers).filter(([, v]) => v.length > 0)
for (const [k, v] of Object.entries(blockers)) console.log(`  [chặn] ${k}: ${v.length}`)
if (blocked.length)
  throw new Error(`Có ${blocked.map(([k]) => k).join(', ')} trỏ tới — KHÔNG xoá.`)
if (b.files.length) throw new Error('Đơn có file đính kèm — xoá đơn sẽ mồ côi file trên Storage, dừng để xử lý tay.') // prettier-ignore

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để sao lưu rồi xoá)')
  process.exit(0)
}

const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'backups', 'po-xoa-0927.json') // prettier-ignore
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(b, null, 2))
console.log(`\nĐã sao lưu: ${out}`)

// Ghi chú Trao đổi không có khoá ngoại → xoá tay; phần còn lại theo cascade.
if (b.doc_notes.length) {
  const { error: e1 } = await sb
    .from('doc_notes')
    .delete()
    .in(
      'id',
      b.doc_notes.map((n) => n.id),
    )
  if (e1) throw e1
}
const { error: e2 } = await sb
  .from('supply_purchase_orders')
  .delete()
  .in('id', ids)
  .eq('status', 'draft')
if (e2) throw e2
const { data: left } = await sb
  .from('supply_purchase_orders')
  .select('code')
  .in('id', ids)
console.log(`Đã xoá ${ids.length - (left?.length ?? 0)}/${ids.length} đơn.`, left?.length ? `Còn: ${left.map((x) => x.code)}` : '') // prettier-ignore
