// NẠP ĐƠN BÌ NHỰA HÀ BÍCH — LỆNH 06/26-27 - MX — 30/09/2026.
//
//   node scripts/po-import-habich-lsx0626-0930.mjs                  # dò khô
//   node scripts/po-import-habich-lsx0626-0930.mjs --apply          # tạo / cập nhật đơn NHÁP
//   node scripts/po-import-habich-lsx0626-0930.mjs --apply --da-gui # + ghi hộ đã ký duyệt & gửi NCC
//
// Tờ ảnh "Số ĐH: 1/2026- HG/HB · LSX 6.26.27 (HG - MERXX)", Nhựa PE dày 3.5 dem,
// 8 dòng giá 43.000 đ/kg, tiền hàng 8.428.000, VAT 8% → 9.102.240. Chị Nga báo
// HÀNG ĐÃ VỀ (30/09).
//
// ĐƠN VỊ: tờ có hai cột "SL đặt (BÌ)" và "SL đặt (Kg)"; tiền = Kg × giá → dòng đơn
// ghi Kg (danh mục bì nhựa cũng tính Kg). Số bì + số SP vào ghi chú dòng.
// MÃ: 4 cỡ có sẵn (so cả hai chiều, tờ ghi 135x58 = mã 58x135); 4 cỡ khai mới.
//
// "HÀNG ĐÃ VỀ" KHÔNG do script ghi: dòng vật tư kho chỉ "đã nhận" khi Kho lập
// PHIẾU NHẬP theo đơn (BR-08) — phiếu đó ghi tăng tồn theo số cân thật, app tự
// chuyển đơn sang đã về. Script chỉ đưa đơn tới "đã gửi NCC" để Kho chọn được.
// Ghi hộ ký duyệt: Vũ Phương Thảo (người ký các đơn gần đây), lý do nói rõ ghi hộ.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const DA_GUI = process.argv.includes('--da-gui')
const sb = await client(import.meta.url)

const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const APPROVER_EMAIL = 'ketoan2@hoanggia.de' // Vũ Phương Thảo
const LSX_CODE = '06/26-27 - MX'
const SUP_CODE = 'HB'
const SUP_ADDRESS = '596/8 TRẦN HƯNG ĐẠO, P.QUY NHƠN, T. GIA LAI'
const DOC_NO = '1/2026- HG/HB'
const GRADE = 'Nhựa PE dày 3.5 dem'
const GROUP = 'Bao bì - đóng gói - tem nhãn'
const PRICE = 43_000
const PAPER = { subtotal: 8_428_000, total: 9_102_240 }
const EXPECTED = '2026-09-30' // hàng đã về hôm nay — tờ không ghi hẹn giao

// mat: mã có sẵn, hoặc { new: [a, b] } khai "Bì nhựa axb" (a ≤ b như danh mục).
const LINES = [
  {
    mat: 'BAO0522',
    spec: '50x60',
    dm: 1,
    bi: 252,
    kg: 6,
    note: '250 Ghế Ravena',
    name: 'Bì nhựa Nệm Mê Ravana',
  },
  {
    mat: 'BAO0557',
    spec: '135x58',
    dm: 1,
    bi: 1202,
    kg: 75,
    note: '1200 nệm 5 bậc Tilos; 120 nệm Tilos có pen',
    name: 'Bì nhựa Nệm ghế 5 bậc Tilos',
  },
  {
    mat: 'BAO0550',
    spec: '82x56',
    dm: 6,
    bi: 602,
    kg: 27,
    note: '100 bộ Sofa góc kufu',
    name: 'Bì nhựa Tựa Sofa góc',
  },
  {
    mat: { new: [73, 85] },
    spec: '85x73',
    dm: 5,
    bi: 502,
    kg: 23,
    note: '100 bộ Sofa góc kufu',
    name: 'Bì nhựa Mê Sofa góc',
  },
  {
    mat: 'BAO0591',
    spec: '76x224',
    dm: 1,
    bi: 132,
    kg: 17,
    note: '130 GTN Navara',
    name: 'Bì nhựa GTN Navara',
  },
  {
    mat: { new: [69, 73] },
    spec: '69x73',
    dm: 2,
    bi: 402,
    kg: 16,
    note: '200 bộ Lindoset',
    name: 'Bì nhựa Mê Lindoset',
  },
  {
    mat: { new: [57, 76] },
    spec: '76x57',
    dm: 2,
    bi: 402,
    kg: 16,
    note: '200 bộ Lindoset',
    name: 'Bì nhựa đôn Lindoset',
  },
  {
    mat: { new: [67, 77] },
    spec: '67x77',
    dm: 2,
    bi: 402,
    kg: 16,
    note: '200 bộ Lindoset',
    name: 'Bì nhựa gối Lindoset',
  },
]

const fmt = (n) => n.toLocaleString('vi-VN')
async function every(table, cols) {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(f, f + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}
const [mats, { data: users }, { data: aps }, { data: lsxs }, { data: sups }] =
  await Promise.all([
    every('warehouse_materials', 'id, code, name'),
    sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
    sb.from('users').select('id, name').eq('email', APPROVER_EMAIL),
    sb.from('production_orders').select('id, code').eq('code', LSX_CODE),
    sb
      .from('supply_suppliers')
      .select('id, code, name, address, currency')
      .eq('code', SUP_CODE),
  ])
const owner = users?.[0]
const ap = aps?.[0]
const lsx = lsxs?.[0]
const sup = sups?.[0]
if (!owner || !ap || !lsx || !sup)
  throw new Error('thiếu người phụ trách / người duyệt / lệnh / NCC')
const matBy = new Map(mats.map((m) => [m.code, m]))
const newName = ([a, b]) => `Bì nhựa ${a}x${b}`

// ĐƠN ĐÃ CÓ (cùng NCC + số ĐH) → cập nhật lại khi còn nháp, không tạo đơn thứ hai.
const { data: dup } = await sb
  .from('supply_purchase_orders')
  .select('id, code, status')
  .eq('supplier_id', sup.id)
  .eq('supplier_doc_no', DOC_NO)
if ((dup?.length ?? 0) > 1)
  throw new Error(`Có ${dup.length} đơn cùng số ${DOC_NO} — gộp tay trước`)
const existing = dup?.[0] ?? null
if (existing && existing.status !== 'draft') {
  console.log(`Đơn ${existing.code} đã ở "${existing.status}" — không sửa bằng script.`)
  process.exit(0)
}

const sub = LINES.reduce((s, l) => s + l.kg * PRICE, 0)
const vat = Math.round(sub * 0.08)
console.log(
  `${sup.name} · ${DOC_NO} · lệnh ${lsx.code} · ${owner.name}${existing ? ` · CẬP NHẬT ${existing.code}` : ''}`,
)
for (const l of LINES) {
  const label =
    typeof l.mat === 'string'
      ? `${l.mat} ${matBy.get(l.mat)?.name}`
      : `+ ${newName(l.mat.new)}`
  console.log(
    `  ${l.name.padEnd(28)} → ${label.padEnd(24)} ${String(l.kg).padStart(3)} kg (${l.bi} bì) = ${fmt(l.kg * PRICE).padStart(9)}`,
  )
}
console.log(
  `Tiền hàng ${fmt(sub)} (tờ ${fmt(PAPER.subtotal)}) · VAT 8% ${fmt(vat)} · tổng ${fmt(sub + vat)} (tờ ${fmt(PAPER.total)})`,
)
if (sub !== PAPER.subtotal || sub + vat !== PAPER.total)
  throw new Error('Lệch tiền với tờ — dừng')
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

let baoNo = 0
for (const m of mats) {
  const hit = String(m.code).match(/^BAO(\d+)$/)
  if (hit) baoNo = Math.max(baoNo, Number(hit[1]))
}
async function matId(ref) {
  if (typeof ref === 'string') return matBy.get(ref).id
  const name = newName(ref.new)
  const again = mats.find((m) => m.name === name)
  if (again) return again.id
  const code = `BAO${String(++baoNo).padStart(4, '0')}`
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({
      code,
      name,
      unit: 'Kg',
      group_name: GROUP,
      spec: `${ref.new[0]}×${ref.new[1]}`,
      material_grade: GRADE,
      po_template: 'simple',
      needs_review: true,
      is_active: true,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai vật tư ${name}: ${error.message}`)
  mats.push(data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return data.id
}
if (!sup.address) {
  await sb
    .from('supply_suppliers')
    .update({ address: SUP_ADDRESS })
    .eq('id', sup.id)
    .is('address', null)
  console.log('  + địa chỉ NCC theo tờ đơn')
}
const note = [
  'Nạp từ ảnh tờ đơn 30/09/2026. Tờ ghi "LSX 6.26.27 (HG - MERXX)".',
  'Số lượng đặt theo Kg (cột tính tiền); số bì từng dòng ở ghi chú dòng.',
  'Ảnh không có ngày, điều khoản, hẹn giao — điều khoản mặc định; hẹn giao = 30/09 (ngày hàng về).',
].join(' ')
const header = {
  production_order_id: lsx.id,
  template: 'accessory',
  currency: sup.currency ?? 'VND',
  vat_rate: 8,
  price_includes_vat: false,
  expected_at: EXPECTED,
  note,
  terms_quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng.',
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Thanh toán công nợ cuối tháng',
  terms_invoice: 'Hóa đơn GTGT',
  signer_role: 'NGƯỜI LẬP',
  assigned_to: owner.id,
}
let po
if (existing) {
  const { data, error } = await sb
    .from('supply_purchase_orders')
    .update(header)
    .eq('id', existing.id)
    .eq('status', 'draft')
    .select('id, code, status')
    .single()
  if (error) throw new Error(`cập nhật đơn: ${error.message}`)
  po = data
} else {
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const { data, error } = await sb
    .from('supply_purchase_orders')
    .insert({
      ...header,
      code,
      supplier_id: sup.id,
      status: 'draft',
      supplier_doc_no: DOC_NO,
      created_by: owner.id,
    })
    .select('id, code, status')
    .single()
  if (error) throw new Error(`tạo đơn: ${error.message}`)
  po = data
}
const payload = []
for (const [i, l] of LINES.entries())
  payload.push({
    po_id: po.id,
    material_id: await matId(l.mat),
    qty_ordered: l.kg,
    unit_price: PRICE,
    sort_order: i,
    qty_basis: 'manual',
    price_basis: 'unit',
    spec: `${l.spec} cm`,
    material_grade: GRADE,
    dm_per_sp: l.dm,
    note: `${l.name} · ${l.bi} bì · ${l.note}`,
  })
const { data: oldLines } = await sb
  .from('supply_purchase_order_lines')
  .select('*')
  .eq('po_id', po.id)
if (oldLines?.length)
  await sb.from('supply_purchase_order_lines').delete().eq('po_id', po.id)
const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
if (le) {
  if (existing) await sb.from('supply_purchase_order_lines').insert(oldLines)
  else await sb.from('supply_purchase_orders').delete().eq('id', po.id)
  throw new Error(`dòng đơn: ${le.message} — đã hoàn nguyên`)
}
console.log(
  `\n✓ ${po.code} ${existing ? 'đã cập nhật' : 'đã tạo'} (nháp) — ${payload.length} dòng · ${fmt(sub)} đ`,
)

if (DA_GUI) {
  const now = Date.now()
  const at = (m) => new Date(now + m * 60_000).toISOString()
  const reason =
    'Ghi hộ 30/09/2026: đơn đã ký và gửi NCC ngoài hệ thống, hàng đã về. Ngày ký thật không ghi được nên mốc là lúc ghi hộ.'
  const { error: ee } = await sb.from('approval_events').insert([
    {
      entity_type: 'po',
      entity_id: po.id,
      entity_code: po.code,
      action: 'submitted',
      actor_id: owner.id,
      created_at: at(0),
      reason: 'Ghi hộ 30/09/2026 — đơn đã trình ký ngoài hệ thống.',
    },
    {
      entity_type: 'po',
      entity_id: po.id,
      entity_code: po.code,
      action: 'approved',
      actor_id: ap.id,
      created_at: at(1),
      reason,
    },
  ])
  if (ee) throw new Error(`nhật ký: ${ee.message}`)
  const { error: ue } = await sb
    .from('supply_purchase_orders')
    .update({
      status: 'ordered',
      approved_by: ap.id,
      approved_at: at(1),
      ordered_at: at(2),
    })
    .eq('id', po.id)
    .eq('status', 'draft')
  if (ue) throw new Error(`cập nhật trạng thái: ${ue.message}`)
  console.log(
    `✓ ${po.code} → đã ký duyệt (${ap.name}) · đã gửi NCC. Kho lập phiếu nhập theo đơn để ghi hàng về.`,
  )
}
