// NẠP 5 ĐƠN NGŨ KIM LỆNH 02/26-27 - ROSCO TỪ FILE "vt.xlsx" CHỊ NGA GỬI — 25/09/2026.
//
//   node scripts/po-import-vt-rosco2.mjs            # dò khô, in bảng
//   node scripts/po-import-vt-rosco2.mjs --apply    # ghi
//
// VÌ SAO MỘT SCRIPT RIÊNG, DỮ LIỆU GÕ TƯỜNG MINH thay vì chạy `po-import-file.mjs`:
// dò khô bằng bộ khớp tự động cho ra BA lỗi mà in bảng mới thấy —
//   1. "Lục Giác 4x100" (cây lục giác kèm SP) khớp vào BUL0536 "Bulon lục giác
//      14x100": chuỗi `4x100` nằm gọn trong `14x100`. Đơn 11,4 triệu trỏ sai hàng.
//   2. Tờ đơn ghi vật liệu "sắt xi 7M" (xi 7 màu) cho cả ba đơn bulon, bộ khớp
//      chọn toàn mã TRƠN hoặc XI TRẮNG (LĐS 8x20x1 → "Ly trắng").
//   3. Sheet Tường Nguyên có HAI cột "SL đặt hàng" và "SL đặt hàng (hh 2%)"; bộ
//      khớp lấy cột trước — thiếu 332.230 đ so với tờ đơn.
// 11 dòng thì chọn tay từng mã, ghi lý do ngay cạnh, soát được bằng mắt.
//
// LUẬT NẠP (giữ nguyên từ 01/09): mọi đơn ở bậc NHÁP, `ordered_at` null; ngày
// trên tờ đơn vào `note`; dòng đơn trỏ vào vật tư danh mục.
//
// SỐ LƯỢNG = ĐÚNG SỐ IN TRÊN TỜ ĐƠN. File tính SL × 1,02 ra số lẻ (59.404,8 con
// bulon) nhưng ô hiển thị làm tròn và đó là số NCC đọc. Thành tiền lệch vài chục
// đồng so với ô tiền của file (tính trên số lẻ) — ghi rõ trong note từng đơn.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)

const FILE = 'vt.xlsx'
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const LSX_CODE = '02/26-27 - ROSCO' // tờ đơn ghi "LSX 2 - ROSCO (IBIZA)"
const XI7 = 'Sắt xi 7 màu' // cột "Vật liệu" của ba đơn bulon ghi "sắt xi 7M"

const TERMS_TT = {
  quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng.',
  place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  payment: 'Thanh toán công nợ cuối tháng',
  invoice: 'Hóa đơn GTGT',
}

/*
 * Vật tư KHAI MỚI — danh mục không có mã nào đúng (đã dò hết 13.240 mã).
 * `needs_review` để Cung ứng soát quy cách/giá.
 */
const NEW_MATS = {
  LUCGIAC: {
    name: 'Lục giác 4x100, 7 màu',
    unit: 'Cái',
    group_name: 'Phụ kiện nội thất', // cùng chỗ NK-0151 "Lục giác 4x60, 7 màu"
    spec: '4×100',
    material_grade: XI7,
    po_template: 'accessory',
    why: 'danh mục chỉ có 4x60 / 4x80; không có 4x100',
  },
  LDS820: {
    name: 'LĐS 8x20x1, 7 màu',
    unit: 'Con',
    group_name: 'Bu lông - vít - đinh - liên kết',
    spec: '8×20×1',
    material_grade: XI7,
    po_template: 'accessory',
    why: 'mã 1 ly duy nhất có sẵn là LON0019 "Ly trắng" — trái với "xi 7M" trên tờ',
  },
  NUTXA: {
    name: 'Nút nhấn xả lavabo',
    unit: 'Cái',
    group_name: 'Phụ kiện nội thất',
    spec: null,
    material_grade: null,
    po_template: 'accessory',
    why: 'nút xả thùng đá bàn vuông; 4 "ứng viên" bộ khớp đưa ra đều là nút nhấn ĐIỆN',
  },
}

/*
 * NCC khai mới: hộ kinh doanh, MST là số CCCD 12 chữ số (hợp lệ cho hộ KD).
 * Tên giữ ĐÚNG chữ trên tờ, kể cả số "1" dính cuối — có thể là gõ thừa, có
 * thể là tên thật; Cung ứng xác nhận rồi sửa ở hồ sơ NCC.
 */
const NEW_SUP = {
  code: 'TBTM',
  name: 'HỘ KINH DOANH THIẾT BỊ THÔNG MINH1',
  tax_no: '008089011557',
  address:
    'Nhà Bà Nguyễn Thị Nguyên, Khu dân cư Bắc Thăng Long, T.cổ điển, X. Vĩnh Thanh, Tp.Hà nội',
  note: 'Người liên hệ: Anh Tuấn - 0388662462. Khai từ tờ đơn vt.xlsx 25/09/2026 — tên in trên tờ có số "1" dính cuối, xác nhận lại tên đúng.',
}

// mat: mã danh mục có sẵn, hoặc { new: KHOÁ } trong NEW_MATS.
const ORDERS = [
  {
    sheet: 'Vạn Vi Thành',
    supplier: 'VVT',
    docNo: '3/2026- HG/VVT',
    date: '22/09/2026',
    terms: {
      ...TERMS_TT,
      lead: 'Giao Hàng Theo Kế hoạch. Thời gian sẽ thông báo cụ thể sau.',
    },
    paperSubtotal: 11_450_000,
    lines: [
      {
        mat: { new: 'LUCGIAC' },
        qty: 22_900,
        demand: 22_854,
        price: 500,
        grade: XI7,
        spec: '4x30x98',
        note: 'VTR',
        why: 'khai mới — ' + NEW_MATS.LUCGIAC.why,
      },
    ],
  },
  {
    sheet: 'NKTN',
    supplier: 'NGŨ KIM THÀNH NGHĨA',
    // Tờ ghi "Số ĐH : 1/2026- HG/VVT" — hậu tố VVT là của Vạn Vi Thành, chép nhầm
    // từ sheet bên cạnh. Không ghi số sai vào đơn; để chị Nga điền số đúng.
    docNo: null,
    docNoNote:
      'Tờ đơn ghi "Số ĐH: 1/2026- HG/VVT" — hậu tố VVT là của đơn Vạn Vi Thành, có lẽ chép nhầm; chưa ghi vào số ĐH NCC, điền lại số đúng.',
    date: '23/09/2026',
    terms: {
      ...TERMS_TT,
      lead: 'Giao Hàng theo Kế hoạch. Thời gian giao hàng từ 3 đến 5 ngày (không tính ngày lễ và chủ nhật).',
    },
    paperSubtotal: 28_532_705,
    lines: [
      {
        mat: 'BUL0087',
        qty: 59_405,
        demand: 58_240,
        price: 295,
        grade: XI7,
        spec: '8x25x15',
        note: '1/ 2240 Bàn CN (26c/sp)',
        why: '"8X25X15M" — cùng họ BUL…M với 8x20x15/8x35x15; CN1497 "7 màu" là mã trùng nghĩa',
      },
      {
        mat: 'BUL0088',
        qty: 13_697,
        demand: 13_428,
        price: 385,
        grade: XI7,
        spec: '8x35x15',
        note: '1/ 1950 ghế bank 3 (4c/sp); 2/ 5628 ghế bank 1 (1c/sp)',
        why: '"8X35X15 M" (xi màu); bộ khớp chọn BUL0095 trơn',
      },
      {
        mat: 'NK-0034',
        qty: 127_447,
        demand: 124_948,
        price: 45,
        grade: XI7,
        spec: '6x16x1',
        note: '1/ 1950 ghế bank 3 (10c/sp); 2/ 5628 ghế bank 1 (6c/sp); 3/ 8960 ghế xoay (8c/sp)',
        why: '"LĐS 6x16x1,7M"; CN1605 "7 màu" là mã trùng nghĩa; bộ khớp chọn BUL0338 trơn',
      },
    ],
  },
  {
    sheet: 'Tường Nguyên',
    supplier: 'TN',
    docNo: '3/2026- HG/TN',
    date: '23/09/2026',
    terms: {
      ...TERMS_TT,
      lead: 'Giao Hàng theo Kế hoạch. Thời gian giao hàng từ 3 đến 5 ngày (không tính ngày lễ và chủ nhật).',
    },
    paperSubtotal: 16_943_710,
    lines: [
      {
        mat: 'BUL0029',
        qty: 19_890,
        demand: 19_500,
        price: 110,
        grade: XI7,
        spec: '6x10x13',
        note: '1/ 1950 Ghế bank 3 (10c/sp)',
        why: 'danh mục không có bản 7 màu cỡ này — mã trơn, lớp xi ghi ở cột Vật liệu',
      },
      {
        mat: 'BUL0029',
        qty: 34_443,
        demand: 33_768,
        price: 110,
        grade: XI7,
        spec: '6x10x13',
        note: '1/ 5628 ghế bank 1 (6c/sp)',
        why: 'như dòng trên (tờ đơn tách hai dòng theo sản phẩm)',
      },
      {
        mat: 'NK-0049',
        qty: 73_114,
        demand: 71_680,
        price: 150,
        grade: XI7,
        spec: '6x20x13',
        note: '1/ 8960 ghế xoay (8c/sp)',
        why: '"Bulong 6x20x13, 7M"; NK-0011 "7 màu" là mã trùng nghĩa; bộ khớp chọn BUL0041 trơn',
      },
    ],
  },
  {
    sheet: 'Tân Phát',
    supplier: 'TP',
    docNo: '3/2026- HG/TP',
    date: '23/09/2026',
    terms: {
      ...TERMS_TT,
      lead: 'Hàng Giao theo Kế hoạch, Thời gian giao hàng từ 5 đến 7 ngày.',
    },
    paperSubtotal: 18_313_020,
    lines: [
      {
        mat: 'BUL0085',
        qty: 32_316,
        demand: 38_816,
        onhand: 6_700,
        price: 260,
        grade: XI7,
        spec: '8x20x15',
        note: '1/ 1950 ghế bank 3 (4c/sp); 2/ 5628 ghế bank 1 (4c/sp); 3/ 2126 Bàn vuông (4c/sp)',
        why: '"8X20X15 M" (xi màu); BUL0086 là xi trắng',
      },
      {
        mat: 'BUL0089',
        qty: 12_000,
        demand: 11_700,
        price: 245,
        grade: XI7,
        spec: '8x15x15',
        note: '1/ 1950 bàn tròn (6c/sp)',
        why: 'mã duy nhất cỡ này (trơn) — lớp xi ghi ở cột Vật liệu',
      },
      {
        mat: { new: 'LDS820' },
        qty: 107_244,
        demand: 122_184,
        onhand: 15_240,
        price: 65,
        grade: XI7,
        spec: '8x20x1',
        note: '1/ 1950 ghế bank 3 (8c/sp); 2/ 5628 ghế bank 1 (5c/sp); 3/ 1950 bàn tròn (6c/sp); 4/ 2240 Bàn CN (26c/sp); 5/ 2126 Bàn Vuông (4c/sp)',
        why: 'khai mới — ' + NEW_MATS.LDS820.why,
      },
    ],
  },
  {
    sheet: 'Sheet1',
    supplier: { new: true },
    docNo: '1/2026- HG/ TM',
    date: '23/09/2026',
    terms: { ...TERMS_TT, payment: 'Nhận hàng thanh toán', lead: 'Hàng có giao ngay.' },
    paperSubtotal: 17_088_000,
    lines: [
      {
        mat: { new: 'NUTXA' },
        qty: 2_136,
        demand: 2_126,
        price: 8_000,
        grade: null,
        spec: null,
        note: '1/ 2126 bàn vuông',
        why: 'khai mới — ' + NEW_MATS.NUTXA.why,
      },
    ],
  },
]

// ------------------------------------------------------------------ đọc -----
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
const [mats, sups, { data: users }, { data: lsxs }] = await Promise.all([
  every('warehouse_materials', 'id, code, name, group_name'),
  every('supply_suppliers', 'id, code, name, tax_no, currency'),
  sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
  sb.from('production_orders').select('id, code').eq('code', LSX_CODE),
])
const owner = users?.[0]
const lsx = lsxs?.[0]
if (!owner) throw new Error(`Không thấy tài khoản ${OWNER_EMAIL}`)
if (!lsx) throw new Error(`Không thấy lệnh ${LSX_CODE}`)
const matBy = new Map(mats.map((m) => [m.code, m]))
const findSup = (key) =>
  sups.find((s) => s.code === key) ?? sups.find((s) => s.name === key) ?? null

// Chốt chống nạp hai lần: đơn nào đã có note "vt.xlsx" + đúng sheet thì bỏ.
const { data: done } = await sb
  .from('supply_purchase_orders')
  .select('code, note')
  .ilike('note', `%${FILE}%`)
const already = (sheet) => (done ?? []).find((p) => p.note?.includes(`(sheet ${sheet})`))

// ---------------------------------------------------------------- in bảng ---
const fmt = (n) => n.toLocaleString('vi-VN')
let grand = 0
console.log(`File ${FILE} · lệnh ${lsx.code} · người phụ trách ${owner.name}\n`)
for (const o of ORDERS) {
  const sup = o.supplier.new ? null : findSup(o.supplier)
  if (!o.supplier.new && !sup) throw new Error(`Không thấy NCC ${o.supplier}`)
  const sub = o.lines.reduce((s, l) => s + l.qty * l.price, 0)
  grand += sub
  const lech = sub - o.paperSubtotal
  const flag = already(o.sheet) ? '  ⟵ ĐÃ NẠP, sẽ bỏ qua' : ''
  console.log(
    `${o.sheet.padEnd(13)} ${sup ? (sup.code ?? sup.name) : `+ NCC mới ${NEW_SUP.code}`} · ${o.lines.length} dòng · ${fmt(sub)} đ (tờ đơn ${fmt(o.paperSubtotal)}, lệch ${fmt(lech)})${flag}`,
  )
  for (const l of o.lines) {
    const m = typeof l.mat === 'string' ? matBy.get(l.mat) : null
    if (typeof l.mat === 'string' && !m) throw new Error(`Không thấy mã ${l.mat}`)
    const label = m ? `${m.code} ${m.name}` : `+ ${NEW_MATS[l.mat.new].name}`
    console.log(
      `    ${label.padEnd(34)} ${fmt(l.qty).padStart(9)} × ${fmt(l.price).padStart(5)}  — ${l.why}`,
    )
  }
}
console.log(`\nTổng tiền hàng 5 đơn: ${fmt(grand)} đ (chưa VAT 8%)`)
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ------------------------------------------------------------------ ghi -----
async function nextCode(prefix, dashed, width) {
  // Theo SỐ, không theo thứ tự chuỗi; đọc đủ mọi trang (bẫy trần 1000 dòng).
  let no = 0
  for (const m of mats) {
    const hit = String(m.code).match(/^([A-Z]+)(-?)(\d+)$/)
    if (hit && hit[1] === prefix) no = Math.max(no, Number(hit[3]))
  }
  return `${prefix}${dashed ? '-' : ''}${String(no + 1).padStart(width, '0')}`
}
const PREFIX = {
  'Phụ kiện nội thất': ['NK', true, 4], // NK-0151 …
  'Bu lông - vít - đinh - liên kết': ['BUL', false, 4], // BUL0087 …
}
const newIds = {}
async function matId(ref) {
  if (typeof ref === 'string') return matBy.get(ref).id
  if (newIds[ref.new]) return newIds[ref.new]
  const spec = NEW_MATS[ref.new]
  const again = mats.find((m) => m.name === spec.name)
  if (again) return (newIds[ref.new] = again.id)
  const [p, dashed, width] = PREFIX[spec.group_name]
  const code = await nextCode(p, dashed, width)
  const { why: _why, ...row } = spec
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({ ...row, code, needs_review: true, is_active: true })
    .select('id, code, name, group_name')
    .single()
  if (error) throw new Error(`khai vật tư ${spec.name}: ${error.message}`)
  mats.push(data)
  matBy.set(data.code, data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return (newIds[ref.new] = data.id)
}

for (const o of ORDERS) {
  if (already(o.sheet)) {
    console.log(`  = ${o.sheet}: đã nạp (${already(o.sheet).code}), bỏ qua`)
    continue
  }
  let sup = o.supplier.new ? findSup(NEW_SUP.code) : findSup(o.supplier)
  if (!sup) {
    const { data, error } = await sb
      .from('supply_suppliers')
      .insert({
        ...NEW_SUP,
        status: 'active',
        is_active: true,
        can_order: true,
        created_by: owner.id,
        updated_by: owner.id,
      })
      .select('id, code, name, tax_no, currency')
      .single()
    if (error) throw new Error(`khai NCC: ${error.message}`)
    sups.push(data)
    sup = data
    console.log(`  + NCC ${data.code} ${data.name}`)
  }
  const sub = o.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const lech = sub - o.paperSubtotal
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const note = [
    `Nạp từ file "${FILE}" (sheet ${o.sheet}).`,
    `Ngày trên đơn: ${o.date}.`,
    'Ghi trên đơn: LSX 2 - ROSCO (IBIZA).',
    o.docNoNote ?? '',
    lech !== 0
      ? `Tiền hàng theo SL in trên tờ (đã làm tròn) là ${fmt(sub)} đ; ô tiền trên file tính theo SL lẻ ×1,02 ra ${fmt(o.paperSubtotal)} đ (lệch ${fmt(lech)} đ).`
      : '',
    `Mã vật tư chọn theo cột Vật liệu "sắt xi 7M" trên tờ — xem ghi chú từng dòng.`,
  ]
    .filter(Boolean)
    .join(' ')
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      production_order_id: lsx.id,
      supplier_id: sup.id,
      status: 'draft',
      template: 'accessory',
      currency: sup.currency ?? 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      supplier_doc_no: o.docNo,
      note,
      terms_quality: o.terms.quality,
      terms_delivery_place: o.terms.place,
      terms_payment: o.terms.payment,
      terms_invoice: o.terms.invoice,
      terms_lead_time: o.terms.lead,
      signer_role: 'NGƯỜI LẬP',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`tạo đơn ${o.sheet}: ${pe.message}`)
  const payload = []
  for (const [i, l] of o.lines.entries())
    payload.push({
      po_id: po.id,
      material_id: await matId(l.mat),
      qty_ordered: l.qty,
      unit_price: l.price,
      sort_order: i,
      qty_basis: 'manual',
      price_basis: 'unit',
      spec: l.spec,
      material_grade: l.grade,
      qty_demand: l.demand,
      qty_on_hand: l.onhand ?? null,
      note: `${l.note} · Chọn mã: ${l.why}`,
    })
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
  if (le) {
    // Không để đầu đơn mồ côi.
    await sb.from('supply_purchase_orders').delete().eq('id', po.id)
    throw new Error(`dòng đơn ${po.code}: ${le.message} — đã gỡ đầu đơn`)
  }
  console.log(`  ✓ ${po.code} ${o.sheet} — ${payload.length} dòng · ${fmt(sub)} đ`)
}
console.log('\nXong.')
