// NẠP ĐƠN VÍT/BULON MINH THẮNG — LỆNH 01/26-27 - JAWOLL — 30/09/2026.
//
//   node scripts/po-import-minhthang-jawoll-0930.mjs            # dò khô
//   node scripts/po-import-minhthang-jawoll-0930.mjs --apply    # ghi; đơn đã có mà còn nháp → cập nhật lại
//
// Tờ đơn ảnh chụp "Số ĐH: 1/2026- HG/MT · LSX 1 . JAWOOL", 557 ghế bank 2
// Iawool, vật liệu Sắt xi đen, VAT 8%, tổng 3.289.637 đ. Nạp thành đơn NHÁP
// giao Đặng Thị Thanh Nga — cùng khuôn po-import-vt-rosco2.mjs.
//
// CHỌN MÃ (dò danh mục 30/09, regex có ranh giới số):
//   · "tai côn lục giác" 6x50 / 6x25: danh mục KHÔNG có mã "tai côn" nào → khai mới.
//   · Vít 4x30 xi đen: mã duy nhất là SAT0697 "Vít ĐẦU DÙ 4x30" — tờ không ghi
//     đầu dù, in lên phiếu NCC sẽ sai chữ → khai mới.
//   · Bulon 6x25x13: BUL0298 "Bulong 6x25x13" đúng tên (mã trơn), xi đen ghi ở cột Vật liệu.
//   · Bulon 6x45x13 (dòng 4): SL cần đặt 0 vì tồn kho 2.500 đủ; hệ thống không nhận
//     dòng SL 0 → BỎ, ghi vào note đơn.
// Điều khoản: ảnh không chụp phần điều khoản → lấy điều khoản các đơn Minh Thắng
// trước (PO-2026-0041/0051), ghi rõ trong note để chị Nga soát.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)

const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const LSX_CODE = '01/26-27 - JAWOLL'
const SUP_CODE = 'MT'
const DOC_NO = '1/2026- HG/MT'
const GRADE = 'Sắt xi đen'
const GROUP = 'Bu lông - vít - đinh - liên kết'
const PAPER = { subtotal: 3_045_960, total: 3_289_637 }
const NOTE_SP = '1/ 557 ghế bank 2 Iawool'

const NEW_MATS = {
  VIT430: { name: 'Vít 4x30 sắt xi đen', spec: '4×30' },
  VIT650: { name: 'Vít 6x50 tai côn lục giác, sắt xi đen', spec: '6×50' },
  VIT625: { name: 'Vít 6x25 tai côn lục giác, sắt xi đen', spec: '6×25' },
}
const LINES = [
  { mat: { new: 'VIT430' }, spec: '4x30', dm: 20, qty: 11_240, price: 120, why: 'khai mới — mã xi đen duy nhất SAT0697 là "đầu dù", tờ không ghi' },
  { mat: { new: 'VIT650' }, spec: '6x50', dm: 4, qty: 2_328, price: 400, why: 'khai mới — danh mục không có mã "tai côn lục giác"' },
  { mat: { new: 'VIT625' }, spec: '6x25', dm: 4, qty: 2_328, price: 250, why: 'khai mới — danh mục không có mã "tai côn lục giác"' },
  { mat: 'BUL0298', spec: '6x25x13', dm: 1, qty: 657, price: 280, why: 'BUL0298 "Bulong 6x25x13" đúng tên; xi đen ghi ở cột Vật liệu' },
]
const SP = 557

const fmt = (n) => n.toLocaleString('vi-VN')
async function every(table, cols) {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(f, f + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}
const [mats, { data: users }, { data: lsxs }, { data: sups }] = await Promise.all([
  every('warehouse_materials', 'id, code, name'),
  sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
  sb.from('production_orders').select('id, code').eq('code', LSX_CODE),
  sb.from('supply_suppliers').select('id, code, name, currency').eq('code', SUP_CODE),
])
const owner = users?.[0], lsx = lsxs?.[0], sup = sups?.[0]
if (!owner || !lsx || !sup) throw new Error('thiếu người phụ trách / lệnh / NCC')
const matBy = new Map(mats.map((m) => [m.code, m]))

// ĐƠN ĐÃ CÓ (cùng NCC + số ĐH) → CẬP NHẬT LẠI thay vì tạo đơn thứ hai. Chỉ khi
// còn NHÁP: đơn đã gửi duyệt/gửi NCC thì sửa phải qua app.
const { data: dup } = await sb
  .from('supply_purchase_orders')
  .select('id, code, status')
  .eq('supplier_id', sup.id)
  .eq('supplier_doc_no', DOC_NO)
if ((dup?.length ?? 0) > 1) throw new Error(`Có ${dup.length} đơn cùng số ${DOC_NO} — gộp tay trước`)
const existing = dup?.[0] ?? null
if (existing && existing.status !== 'draft') {
  console.log(`Đơn ${existing.code} đã ở "${existing.status}" — không cập nhật bằng script, sửa trên app.`)
  process.exit(0)
}
if (existing) console.log(`Đã có ${existing.code} (nháp) → sẽ CẬP NHẬT LẠI đầu đơn + dòng (giữ số PO, hẹn giao).`)

const sub = LINES.reduce((s, l) => s + l.qty * l.price, 0)
const vat = Math.round(sub * 0.08)
console.log(`${sup.name} · ${DOC_NO} · lệnh ${lsx.code} · ${owner.name}`)
for (const l of LINES) {
  const label = typeof l.mat === 'string' ? `${l.mat} ${matBy.get(l.mat)?.name}` : `+ ${NEW_MATS[l.mat.new].name}`
  console.log(`  ${label.padEnd(44)} ${fmt(l.qty).padStart(7)} × ${fmt(l.price).padStart(4)} = ${fmt(l.qty * l.price).padStart(10)}  — ${l.why}`)
}
console.log(`Tiền hàng ${fmt(sub)} (tờ ${fmt(PAPER.subtotal)}) · VAT 8% ${fmt(vat)} · tổng ${fmt(sub + vat)} (tờ ${fmt(PAPER.total)})`)
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

let vitNo = 0
for (const m of mats) {
  const hit = String(m.code).match(/^VIT(\d+)$/)
  if (hit) vitNo = Math.max(vitNo, Number(hit[1]))
}
async function matId(ref) {
  if (typeof ref === 'string') return matBy.get(ref).id
  const spec = NEW_MATS[ref.new]
  const again = mats.find((m) => m.name === spec.name)
  if (again) return again.id
  const code = `VIT${String(++vitNo).padStart(4, '0')}`
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({ code, name: spec.name, unit: 'Con', group_name: GROUP, spec: spec.spec, material_grade: GRADE, po_template: 'accessory', needs_review: true, is_active: true })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai vật tư ${spec.name}: ${error.message}`)
  mats.push(data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return data.id
}

const note = [
  'Nạp từ ảnh tờ đơn 30/09/2026. Tờ ghi "LSX 1 . JAWOOL".',
  'Dòng 4 "Bulon 6x45x13" (557 SP × 4 con/sp, tồn kho 2.500) có SL cần đặt 0 nên không đưa vào đơn.',
  'Ảnh không có ngày và điều khoản — điều khoản lấy theo các đơn Minh Thắng trước, soát lại trước khi trình ký.',
].join(' ')
const header = {
  production_order_id: lsx.id,
  template: 'accessory',
  currency: sup.currency ?? 'VND',
  vat_rate: 8,
  price_includes_vat: false,
  note,
  terms_quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng.',
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Thanh toán công nợ cuối tháng',
  terms_invoice: 'Hóa đơn GTGT',
  terms_lead_time: 'Từ 7 đến 10 ngày kể ngày xác nhận đơn đặt hàng ( không tính ngày lễ và Chủ nhật)',
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
    .select('id, code')
    .single()
  if (error) throw new Error(`cập nhật đơn: ${error.message}`)
  po = data
} else {
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const { data, error } = await sb
    .from('supply_purchase_orders')
    .insert({ ...header, code, supplier_id: sup.id, status: 'draft', supplier_doc_no: DOC_NO, created_by: owner.id })
    .select('id, code')
    .single()
  if (error) throw new Error(`tạo đơn: ${error.message}`)
  po = data
}
const payload = []
for (const [i, l] of LINES.entries())
  payload.push({
    po_id: po.id,
    material_id: await matId(l.mat),
    qty_ordered: l.qty,
    unit_price: l.price,
    sort_order: i,
    qty_basis: 'manual',
    price_basis: 'unit',
    spec: l.spec,
    material_grade: GRADE,
    dm_per_sp: l.dm,
    qty_demand: SP * l.dm,
    note: `${NOTE_SP} · Chọn mã: ${l.why}`,
  })
const { data: oldLines, error: oe } = await sb
  .from('supply_purchase_order_lines')
  .select('*')
  .eq('po_id', po.id)
if (oe) throw oe
if (oldLines.length) {
  const { error: de } = await sb.from('supply_purchase_order_lines').delete().eq('po_id', po.id)
  if (de) throw new Error(`xoá dòng cũ: ${de.message}`)
}
const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
if (le) {
  // Trả lại dòng cũ (đơn cập nhật) hoặc gỡ đầu đơn mồ côi (đơn mới).
  if (existing) await sb.from('supply_purchase_order_lines').insert(oldLines)
  else await sb.from('supply_purchase_orders').delete().eq('id', po.id)
  throw new Error(`dòng đơn: ${le.message} — đã hoàn nguyên`)
}
console.log(`
✓ ${po.code} ${existing ? 'đã cập nhật' : 'đã tạo'} — ${payload.length} dòng · ${fmt(sub)} đ`)
