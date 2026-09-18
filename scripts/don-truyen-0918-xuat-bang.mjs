// Đọc NGƯỢC 11 đơn đã nạp từ DB ra bang-da-nap.json, để dựng bảng đối chiếu cho
// anh Truyền soát. Chỉ đọc, không ghi gì.
//
//   node scripts/don-truyen-0918-xuat-bang.mjs
import { writeFileSync } from 'node:fs'
import { client } from './products-lib.mjs'

const CODES = [
  'PO-2026-0068',
  'PO-2026-0073',
  'PO-2026-0074',
  'PO-2026-0075',
  'PO-2026-0076',
  'PO-2026-0077',
  'PO-2026-0078',
  'PO-2026-0079',
  'PO-2026-0080',
  'PO-2026-0081',
  'PO-2026-0082',
]

const db = await client(import.meta.url)
const { data: pos } = await db
  .from('supply_purchase_orders')
  .select('id, code, status, vat_rate, note, supplier_id, production_order_id')
  .in('code', CODES)
const { data: sup } = await db.from('supply_suppliers').select('id, name')
const { data: lsx } = await db.from('production_orders').select('id, code')
const { data: extra } = await db
  .from('supply_po_extra_lsx')
  .select('po_id, production_order_id')
const S = new Map(sup.map((s) => [s.id, s.name]))
const L = new Map(lsx.map((l) => [l.id, l.code]))

const out = []
for (const p of pos.sort((a, b) => a.code.localeCompare(b.code))) {
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select(
      'sort_order, line_name, line_unit, spec, qty_ordered, unit_price, weight_per_unit, material_id, note',
    )
    .eq('po_id', p.id)
    .order('sort_order')
  const { data: mm } = await db
    .from('warehouse_materials')
    .select('id, code, name, needs_review')
    .in('id', [...new Set(ln.map((l) => l.material_id))])
  const M = new Map(mm.map((m) => [m.id, m]))
  const tien = ln.reduce((a, b) => a + Number(b.qty_ordered) * Number(b.unit_price), 0)
  out.push({
    code: p.code,
    ncc: S.get(p.supplier_id),
    status: p.status,
    vat: Number(p.vat_rate),
    lsx: L.get(p.production_order_id) ?? null,
    lsx_them: extra
      .filter((e) => e.po_id === p.id)
      .map((e) => L.get(e.production_order_id)),
    tien_hang: Math.round(tien),
    tong_tt: Math.round(tien * (1 + Number(p.vat_rate) / 100)),
    note: p.note,
    lines: ln.map((l) => ({
      stt: l.sort_order + 1,
      ten: l.line_name,
      dvt: l.line_unit,
      spec: l.spec,
      sl: Number(l.qty_ordered),
      gia: Number(l.unit_price),
      tt: Math.round(Number(l.qty_ordered) * Number(l.unit_price)),
      kg_don_vi: l.weight_per_unit != null ? Number(l.weight_per_unit) : null,
      vt_code: M.get(l.material_id)?.code ?? null,
      vt_ten: M.get(l.material_id)?.name ?? null,
      vt_moi: !!M.get(l.material_id)?.needs_review,
      ghi: l.note || null,
    })),
  })
}
writeFileSync('bang-da-nap.json', JSON.stringify(out, null, 1), 'utf8')
console.log(
  `✓ ${out.length} đơn, ${out.reduce((a, b) => a + b.lines.length, 0)} dòng → bang-da-nap.json`,
)
