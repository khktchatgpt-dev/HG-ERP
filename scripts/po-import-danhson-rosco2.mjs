// NẠP ĐƠN XỐP DANH SƠN (1/2026- HG/DS) LỆNH 02/26-27 - ROSCO TỪ ẢNH — 25/09/2026.
//
//   node scripts/po-import-danhson-rosco2.mjs            # dò khô
//   node scripts/po-import-danhson-rosco2.mjs --apply    # ghi
//
// Nguồn: ảnh tờ đơn chị Nga gửi qua chat (không có ngày, không có phần điều khoản).
//
// BA ĐIỂM PHẢI ĐỌC TRƯỚC KHI DUYỆT ĐƠN NÀY:
//  1. DÒNG 6 "Xốp hông" — tờ ghi thành tiền 982 đ cho 17.008 thanh. Công thức trên
//     tờ lấy "Tổng số khối" 0,0007 m³ = khối của MỘT thanh (485×60×25 mm =
//     0,0007275 m³), nên 982 đ thật ra là ĐƠN GIÁ MỘT THANH. Thành tiền đúng =
//     17.008 × 0,0007275 × 1.350.000 = 16.703.982 đ. Đơn ghi theo giá/m³ nên hệ
//     thống ra số đúng; tổng đơn lớn hơn tờ giấy ~16,7 triệu (+VAT ~18 triệu).
//  2. Tờ ghi "LSX 2 - ROSCO CHELSEA" nhưng mọi số lượng (2240 bàn CN Ibiza · 2126
//     bàn vuông · 1950 bàn tròn) là của lệnh 02/26-27 - ROSCO = IBIZA (khớp 6/6 SP
//     đã soát 25/09). Lệnh 01 mới là New Chelsea và không có số nào trùng.
//  3. Tên NCC trên ảnh bị cắt ở "…KỸ THUẬT DANH SƠ" — khai "DANH SƠN", cần xác nhận.
//
// "SL đơn hàng" (qty_demand) ghi theo NGHĨA CỦA HỆ THỐNG — nhu cầu vật tư cùng
// ĐVT với SL đặt (`suggestOrderQty` = đơn hàng − tồn) — không phải cột "SL Đơn
// Hàng" của tờ (số SP). Số SP và Đm/sp giữ ở `dm_per_sp` + ghi chú dòng.
import { client } from './products-lib.mjs'
// Ghi thẳng vào bảng là bỏ qua service — mà service mới là chỗ tính qty2 (tổng
// m³) + price_basis 'unit2' cho dòng xốp theo khối. Thiếu hai trường đó, màn
// chi tiết tính SL × giá/m³: lần chạy đầu (25/09) đơn này hiện 38 TỶ. Gọi đúng
// hàm service dùng.
import { deriveLine } from '../src/lib/po-template.ts'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const SRC = 'ảnh đơn đặt hàng Danh Sơn chị Nga gửi 25/09/2026'
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const LSX_CODE = '02/26-27 - ROSCO'
const GROUP = 'Mút - xốp - nệm - gòn'
const PRICE_M3 = 1_350_000

const SUP = {
  code: 'DS',
  name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ & KỸ THUẬT DANH SƠN',
  address: 'Số 109B Trần Hưng Đạo, Quy Nhơn, Gia Lai',
  contact_name: 'Chị Nhị',
  contact_phone: '0905609629',
  note: 'Khai từ ảnh tờ đơn 1/2026- HG/DS (25/09/2026). Ảnh cắt tên ở "…DANH SƠ" — xác nhận tên đầy đủ. Tờ để trống MST.',
}

// basis 'ctn' = giá theo thanh (cột "Đơn giá tấm"); 'm3' = giá theo khối.
const LINES = [
  {
    name: 'Xốp U khe 35mm 200x100x130 D20',
    dims: [200, 100, 130],
    sp: 2240,
    dm: 2,
    qty: 4_480,
    basis: 'ctn',
    price: 4_950,
    amount: 22_176_000,
    note: '1/ 2240 Bàn CN Ibiza',
  },
  {
    name: 'Xốp U khe 35mm 1200x100x130 D20',
    dims: [1200, 100, 130],
    sp: 2240,
    dm: 2,
    qty: 4_480,
    basis: 'ctn',
    price: 26_550,
    amount: 118_944_000,
    note: '1/ 2240 Bàn CN Ibiza',
  },
  {
    name: 'Xốp góc khe 35mm 200x200x130 D20',
    dims: [200, 200, 130],
    sp: 2240,
    dm: 4,
    qty: 8_960,
    basis: 'ctn',
    price: 10_000,
    amount: 89_600_000,
    note: '1/ 2240 Bàn CN Ibiza',
  },
  {
    name: 'Xốp tấm 250x250x50 D18',
    dims: [250, 250, 50],
    sp: 2240,
    dm: 3,
    qty: 6_720,
    basis: 'm3',
    price: PRICE_M3,
    amount: 28_350_000,
    note: '1/ 2240 Bàn CN Ibiza · tờ: 21 m³',
  },
  {
    name: 'Xốp mặt 555x555x20 D18',
    dims: [555, 555, 20],
    sp: 2126,
    dm: 1,
    qty: 2_126,
    basis: 'm3',
    price: PRICE_M3,
    amount: 17_681_251,
    note: '1/ 2126 bàn vuông · tờ: 13,097 m³',
  },
  {
    name: 'Xốp hông 485x60x25 D18',
    dims: [485, 60, 25],
    sp: 2126,
    dm: 8,
    qty: 17_008,
    basis: 'm3',
    price: PRICE_M3,
    amount: 982,
    note: '1/ 2126 bàn vuông · ⚠ tờ ghi thành tiền 982 đ (= giá MỘT thanh, lấy khối 0,0007 m³ của một thanh) — đúng là 17.008 × 0,0007275 m³ × 1.350.000 = 16.703.982 đ',
  },
  {
    name: 'Xốp mặt bàn tròn phi 720x20 D18',
    dims: [720, 720, 20],
    sp: 1950,
    dm: 2,
    qty: 3_900,
    basis: 'ctn',
    price: 20_500,
    amount: 79_950_000,
    note: '1/ 1950 bàn tròn',
  },
]
const PAPER_SUBTOTAL = 356_702_233

// Tiền dòng y như app: theo khối thì SL × (D×R×Dày mm → m³) × giá/m³.
const m3 = (d) => (d[0] * d[1] * d[2]) / 1e9
const amountOf = (l) =>
  l.basis === 'm3' ? l.qty * m3(l.dims) * l.price : l.qty * l.price
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
const [mats, sups, { data: users }, { data: lsxs }, { data: done }] = await Promise.all([
  every('warehouse_materials', 'id, code, name'),
  every('supply_suppliers', 'id, code, name'),
  sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
  sb.from('production_orders').select('id, code').eq('code', LSX_CODE),
  sb.from('supply_purchase_orders').select('code').eq('supplier_doc_no', '1/2026- HG/DS'),
])
const owner = users?.[0]
const lsx = lsxs?.[0]
if (!owner || !lsx) throw new Error('thiếu người phụ trách hoặc lệnh')
if (done?.length) {
  console.log(`Đơn 1/2026- HG/DS đã nạp: ${done.map((d) => d.code).join(', ')} — dừng.`)
  process.exit(0)
}
const supHit = sups.find((s) => s.code === SUP.code)
if (supHit && supHit.name !== SUP.name)
  throw new Error(`Mã NCC DS đã thuộc "${supHit.name}"`)

let sub = 0
console.log(
  `Đơn xốp Danh Sơn · lệnh ${lsx.code} · ${owner.name} · NCC ${supHit ? 'DS (có sẵn)' : '+ DS mới'}\n`,
)
for (const l of LINES) {
  const a = amountOf(l)
  sub += a
  const had = mats.find((m) => m.name === l.name)
  console.log(
    `  ${(had ? had.code : '+ mới').padEnd(8)} ${l.name.padEnd(34)} ${fmt(l.qty).padStart(7)} × ${fmt(l.price).padStart(9)}${l.basis === 'm3' ? '/m³' : '   '} = ${fmt(a).padStart(12)} (tờ ${fmt(l.amount)}${Math.abs(a - l.amount) > 1 ? ' ⚠' : ''})`,
  )
}
console.log(
  `\nTiền hàng ${fmt(sub)} · tờ ${fmt(PAPER_SUBTOTAL)} · lệch ${fmt(sub - PAPER_SUBTOTAL)}`,
)
console.log(`Tổng TT (VAT 8%) ${fmt(sub * 1.08)} · tờ 385.238.412`)
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ---------------------------------------------------------------- ghi -----
let sup = supHit
if (!sup) {
  const { data, error } = await sb
    .from('supply_suppliers')
    .insert({
      ...SUP,
      type: 'Mouse',
      status: 'active',
      is_active: true,
      can_order: true,
      created_by: owner.id,
      updated_by: owner.id,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai NCC: ${error.message}`)
  sup = data
  console.log(`  + NCC ${data.code} ${data.name}`)
}
// Mã vật tư mới: tiền tố MUT (số đông của nhóm), số lấy theo SỐ trên toàn danh mục.
let no = 0
for (const m of mats) {
  const hit = String(m.code).match(/^MUT(\d+)$/)
  if (hit) no = Math.max(no, Number(hit[1]))
}
const ids = []
for (const l of LINES) {
  const had = mats.find((m) => m.name === l.name)
  if (had) {
    ids.push(had.id)
    continue
  }
  const code = `MUT${String(++no).padStart(4, '0')}`
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({
      code,
      name: l.name,
      unit: 'Thanh',
      group_name: GROUP,
      spec: l.dims.join('×'),
      po_template: 'foam',
      needs_review: true,
      is_active: true,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai vật tư ${l.name}: ${error.message}`)
  mats.push(data)
  ids.push(data.id)
  console.log(`  + vật tư ${data.code} ${data.name}`)
}
const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
const note = [
  `Nạp từ ${SRC}.`,
  'Ảnh KHÔNG có ngày đặt và phần điều khoản — bổ sung từ tờ gốc.',
  'Tờ ghi "LSX 2 - ROSCO CHELSEA" nhưng số lượng (2240 bàn CN Ibiza, 2126 bàn vuông, 1950 bàn tròn) là của lệnh 02/26-27 - ROSCO = IBIZA — gắn theo số lượng.',
  `⚠ Dòng Xốp hông: tờ ghi thành tiền 982 đ (là giá MỘT thanh) — hệ thống tính đúng 16.703.982 đ, nên tiền hàng ${fmt(sub)} đ lớn hơn tờ ${fmt(PAPER_SUBTOTAL)} đ (lệch ${fmt(sub - PAPER_SUBTOTAL)} đ). Cần NCC xác nhận / sửa tờ.`,
].join(' ')
const { data: po, error: pe } = await sb
  .from('supply_purchase_orders')
  .insert({
    code,
    production_order_id: lsx.id,
    supplier_id: sup.id,
    status: 'draft',
    template: 'foam',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    supplier_doc_no: '1/2026- HG/DS',
    contract_no: '1-2026',
    note,
    signer_role: 'NGƯỜI LẬP',
    created_by: owner.id,
    assigned_to: owner.id,
  })
  .select('id, code')
  .single()
if (pe) throw new Error(`tạo đơn: ${pe.message}`)
const payload = LINES.map((l, i) => ({
  po_id: po.id,
  material_id: ids[i],
  qty_ordered: l.qty,
  unit_price: l.price,
  sort_order: i,
  qty_basis: 'manual',
  carton_basis: l.basis,
  inner_l_mm: l.dims[0],
  inner_w_mm: l.dims[1],
  inner_h_mm: l.dims[2],
  spec: `${l.dims.join('x')} · ${l.name.match(/D\d+$/)[0]}`,
  qty_demand: l.qty,
  dm_per_sp: l.dm,
  ...(({ qty2, unit2, price_basis }) => ({ qty2, unit2, price_basis }))(
    deriveLine('foam', { qty_ordered: l.qty, carton_basis: l.basis, inner_l_mm: l.dims[0], inner_w_mm: l.dims[1], inner_h_mm: l.dims[2] }), // prettier-ignore
  ),
  note: `${l.note} · ${l.sp} SP × ${l.dm}/SP`,
}))
const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
if (le) {
  await sb.from('supply_purchase_orders').delete().eq('id', po.id)
  throw new Error(`dòng đơn: ${le.message} — đã gỡ đầu đơn`)
}
console.log(`  ✓ ${po.code} — ${payload.length} dòng · ${fmt(sub)} đ · id ${po.id}`)
