// NẠP ĐƠN THANH V HIỆP HƯNG 04-2026 HG/HH (lệnh Ibiza) CHO CHỊ NGA — 01/10/2026.
//
//   node scripts/po-import-baobi-hiephung-04.mjs            # dò khô
//   node scripts/po-import-baobi-hiephung-04.mjs --apply    # ghi
//
// Nguồn: bản scan "Adobe Scan 1 Oct 2026 (5).pdf" — tờ ĐƠN ĐẶT HÀNG ngày
// 01/10/2026, Số ĐH 04-2026 HG/HH, "LSX 02.2026 - ROSCO IBIZA" → lệnh
// 02/26-27 - ROSCO. Năm dòng Thanh V dày 5mm, 4.800 đ/m, cho ba thùng SOLE 5 lớp
// (Arm Chair · Sofa + Coffee Table · Swivel Chair). Scan không có ô công thức nên
// số GÕ TAY từ tờ — dò khô so từng dòng với ô THÀNH TIỀN và tổng của tờ.
//
// Hai chỗ tờ in lạ, giữ số tiền đúng tờ và ghi chú lại:
//   · dòng 5 in "1980x5x5" nhưng m = 1,98 và 1,98 × 4.800 = 9.500 → 198x5x5 cm.
//   · dòng 5 in SP/Crt = 1 nhưng SL đặt 7.800 = 1.950 × 4 → pcs_per_ctn 4.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga — người lập trên tờ
const SUPPLIER_TAX = '4200500423' // CÔNG TY TNHH HIỆP HƯNG
const GROUP = 'Bao bì - đóng gói - tem nhãn'
const DOC_NO = '04-2026 HG/HH'
const LSX = '02/26-27 - ROSCO'
const PAPER_SUBTOTAL = 173_514_000
const PAPER_TOTAL = 187_395_120
// "5 đến 7 ngày kể từ ngày gởi đơn (không tính lễ & CN)": 01/10 (thứ Năm) + 7
// ngày làm việc trừ CN = 09/10/2026 — lấy mốc xa như đơn 01/02-2026.
const EXPECTED_AT = '2026-10-09'
const TERMS = {
  terms_quality:
    'Đúng định lượng, Đúng quy cách, Thùng vuông góc, không rách móp ẩm mốc, in rõ đúng nội dung.',
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Công nợ cuối tháng.',
  terms_invoice: 'Hóa đơn GTGT',
  terms_lead_time:
    'Giao hàng từ 5 đến 7 ngày kể từ ngày gởi đơn hàng. (không tính ngày lễ & chủ nhật.)',
}

const ARM = { code: '2723875', box: 'Thùng SOLE 5 lớp Arm Chair, tai 12cm KTLL' }
const SOFA = {
  code: '2723876',
  box: 'Thùng SOLE 5 lớp Sofa + Coffee Table, 2 tai hông 45cm - KTLL',
}
const SWIVEL = { code: '2722875', box: 'Thùng SOLE 5 lớp Swivel Chair, tai 12cm' }
// [STT tờ, SP, SL ĐH, SP/Crt, SL đặt, kích thước cm, m, đơn giá, thành tiền tờ, ghi chú thêm]
const ROWS = [
  [2, ARM, 2814, 2, 5628, '77.5x5x5', 0.775, 3720, 20_936_160],
  [3, ARM, 2814, 2, 5628, '74.5x5x5', 0.745, 3580, 20_148_240],
  [
    5,
    SOFA,
    1950,
    4,
    7800,
    '198x5x5',
    1.98,
    9500,
    74_100_000,
    'tờ in KT "1980x5x5" và SP/Crt 1 — theo m 1,98 và SL đặt 7.800 = 1.950 × 4',
  ],
  [7, SWIVEL, 4480, 2, 8960, '72x5x5', 0.72, 3460, 31_001_600],
  [8, SWIVEL, 4480, 2, 8960, '63.5x5x5', 0.635, 3050, 27_328_000, 'tờ in m 0,64'],
]
const PER_M = 4800

const lines = ROWS.map(
  ([stt, sp, demand, per, qty, dims, m, price, paperAmount, extra]) => ({
    stt,
    matName: `Thanh V ${dims}cm dày 5mm`,
    spec: `${dims} cm · dày 5mm · ${String(m).replace('.', ',')} m × ${PER_M.toLocaleString('vi-VN')} đ/m`,
    qty,
    price,
    paperAmount,
    product_code: sp.code,
    qty_demand: demand,
    pcs_per_ctn: per,
    note: [`STT ${stt} tờ`, `cho ${sp.box}`, extra].filter(Boolean).join(' · '),
  }),
)

const fmt = (n) => Math.round(n).toLocaleString('vi-VN')
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
const [mats, { data: sups }, { data: users }, { data: lsxs }, { data: done }] =
  await Promise.all([
    every('warehouse_materials', 'id, code, name'),
    sb.from('supply_suppliers').select('id, name, currency').eq('tax_no', SUPPLIER_TAX),
    sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
    sb.from('production_orders').select('id, code').eq('code', LSX),
    sb.from('supply_purchase_orders').select('code').eq('supplier_doc_no', DOC_NO),
  ])
const owner = users?.[0]
const sup = sups?.[0]
const lsx = lsxs?.[0]
if (!owner) throw new Error('không thấy chị Nga')
if (sups?.length !== 1)
  throw new Error(`NCC MST ${SUPPLIER_TAX}: thấy ${sups?.length ?? 0}`)
if (!lsx) throw new Error(`không thấy lệnh ${LSX}`)
if (done?.length) {
  console.log(`ĐÃ NẠP ${DOC_NO} → ${done.map((d) => d.code).join(', ')} — dừng.`)
  process.exit(0)
}
const norm = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
const matByName = new Map(mats.map((m) => [norm(m.name), m]))

let bad = false
console.log(`=== ${DOC_NO} · lệnh ${lsx.code} · ${sup.name} · ${owner.name}`)
for (const l of lines) {
  const a = l.qty * l.price
  const m = matByName.get(norm(l.matName))
  const off = Math.abs(a - l.paperAmount) > 0.5
  if (off) bad = true
  console.log(
    `  ${String(l.stt).padStart(2)} ${(m ? m.code : '+ mới').padEnd(8)} ${l.matName.padEnd(30)} ${l.product_code} ${fmt(l.qty_demand).padStart(6)}×${l.pcs_per_ctn} = ${fmt(l.qty).padStart(6)} × ${fmt(l.price).padStart(6)} = ${fmt(a).padStart(12)}${off ? ` ⚠ tờ ${fmt(l.paperAmount)}` : ''}`,
  )
  if (l.qty_demand * l.pcs_per_ctn !== l.qty) {
    bad = true
    console.log('     ⚠ SL ĐH × SP/Crt ≠ SL đặt')
  }
}
const sub = lines.reduce((s, l) => s + l.qty * l.price, 0)
const vat = Math.round(sub * 0.08)
if (sub !== PAPER_SUBTOTAL || sub + vat !== PAPER_TOTAL) bad = true
console.log(
  `  Tiền hàng ${fmt(sub)} (tờ ${fmt(PAPER_SUBTOTAL)}) · VAT 8% ${fmt(vat)} · tổng ${fmt(sub + vat)} (tờ ${fmt(PAPER_TOTAL)})`,
)
if (bad) throw new Error('lệch tờ — dừng')
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ---------------------------------------------------------------- ghi -----
let no = 0
for (const m of mats) {
  const hit = String(m.code).match(/^BAO(\d+)$/)
  if (hit) no = Math.max(no, Number(hit[1]))
}
async function matId(l) {
  const had = matByName.get(norm(l.matName))
  if (had) return had.id
  const code = `BAO${String(++no).padStart(4, '0')}`
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({
      code,
      name: l.matName,
      unit: 'Thanh',
      group_name: GROUP,
      spec: l.spec,
      po_template: 'carton',
      needs_review: true,
      is_active: true,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai vật tư ${l.matName}: ${error.message}`)
  matByName.set(norm(data.name), data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return data.id
}

const ids = []
for (const l of lines) ids.push(await matId(l))
const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
const note = [
  'Nạp từ bản scan "Adobe Scan 1 Oct 2026 (5).pdf" ngày 01/10/2026 (tờ có chữ ký người lập + giám đốc, đóng dấu).',
  'Ngày trên đơn: 01/10/2026. Ghi trên đơn: LSX 02.2026 - ROSCO IBIZA. Người liên hệ NCC: Ms Thu Hà - 0986 864 627.',
  `Tiền hàng ${fmt(sub)} đ khớp tờ; đơn giá = ô ĐƠN GIÁ của tờ (m × 4.800 đ/m làm tròn chục đồng).`,
  'Hẹn giao 09/10/2026 = mốc xa của "5–7 ngày kể từ ngày gởi đơn, không tính lễ & CN".',
].join(' ')
const { data: po, error: pe } = await sb
  .from('supply_purchase_orders')
  .insert({
    code,
    production_order_id: lsx.id,
    supplier_id: sup.id,
    status: 'draft',
    template: 'carton',
    currency: sup.currency ?? 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    supplier_doc_no: DOC_NO,
    expected_at: EXPECTED_AT,
    note,
    ...TERMS,
    signer_role: 'NGƯỜI LẬP',
    created_by: owner.id,
    assigned_to: owner.id,
  })
  .select('id, code')
  .single()
if (pe) throw new Error(`tạo đơn: ${pe.message}`)
const payload = lines.map((l, i) => ({
  po_id: po.id,
  material_id: ids[i],
  qty_ordered: l.qty,
  unit_price: l.price,
  sort_order: i,
  price_basis: 'unit',
  qty_basis: 'manual',
  carton_basis: 'ctn',
  product_code: l.product_code,
  qty_demand: l.qty_demand,
  pcs_per_ctn: l.pcs_per_ctn,
  spec: l.spec,
  note: l.note,
}))
const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
if (le) {
  await sb.from('supply_purchase_orders').delete().eq('id', po.id)
  throw new Error(`dòng đơn: ${le.message} — đã gỡ đầu đơn`)
}
console.log(`  ✓ ${po.code} (${DOC_NO}) — ${payload.length} dòng · ${fmt(sub)} đ`)
