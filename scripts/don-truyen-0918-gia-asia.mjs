// BỔ SUNG ĐƠN GIÁ cho PO-2026-0068 (Thép Asia, 08/09/2026).
//
//   node scripts/don-truyen-0918-gia-asia.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-gia-asia.mjs --apply   # ghi thật
//
// Đơn đã nằm trong hệ thống từ PHIẾU ĐỀ XUẤT BÁN HÀNG số 20171966.001 — phiếu đó
// KHÔNG ghi giá nên cả 6 dòng để unit_price NULL. Tờ ĐƠN ĐẶT HÀNG anh Truyền ký
// (tập scan dh-09182026013924.pdf, trang 3) là bản CÙNG số lượng nhưng CÓ giá.
//
// Khớp hai bản bằng SỐ LƯỢNG, không bằng tên: tờ đơn viết tắt kiểu "VK20X20X0.8"
// còn danh mục ghi "Thép vuông kẽm 20x20x0.8". Sáu số lượng 18/491/464/393/426/160
// là duy nhất trong đơn nên khớp được một-một, không mơ hồ.
//
// ĐƠN GIÁ LÀ VNĐ/KG. Đơn này đã sẵn price_basis='unit2' với qty2 = tổng kg từ
// lần nạp trước, nên app tính tiền = qty2 × unit_price ⇒ unit_price phải là
// GIÁ MỖI KG, để nguyên như tờ đơn.
//
// BẢN ĐẦU CỦA SCRIPT NÀY ĐÃ SAI Ở ĐÚNG CHỖ ĐÓ: nó quy đơn giá về đồng/CÂY
// (42.210 = 2,1kg × 20.100) rồi ghi vào unit_price, trong khi app vẫn nhân với
// qty2 tính bằng KG — tổng đơn phọt lên 2.529.747.213đ, gấp mười lần tờ giấy.
// Bài học: ĐỌC price_basis TRƯỚC KHI GHI unit_price, đừng suy từ qty_ordered.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const PO = 'PO-2026-0068'

// Đọc từ tờ đơn. kg_cay = cột "Quy cách NCC (kg/cây)", gia_kg = cột "Đơn giá (VND/kg)".
const DONG = [
  {
    cay: 18,
    ten: 'VK16X16X0.8 6M IN',
    kg_cay: 2.1,
    tong_kg: 37.8,
    gia_kg: 20100,
    tt: 759780,
  },
  {
    cay: 491,
    ten: 'VK20X20X0.8 6M IN',
    kg_cay: 2.58,
    tong_kg: 1266.78,
    gia_kg: 19700,
    tt: 24955566,
  },
  {
    cay: 464,
    ten: 'VK20X20X1.0 6M IN',
    kg_cay: 3.29,
    tong_kg: 1526.56,
    gia_kg: 19500,
    tt: 29767920,
  },
  {
    cay: 393,
    ten: 'HK20X40X1.0 6M',
    kg_cay: 5.03,
    tong_kg: 1976.79,
    gia_kg: 19500,
    tt: 38547405,
  },
  {
    cay: 160,
    ten: 'VK60X60X1.2 6M IN',
    kg_cay: 12.56,
    tong_kg: 2009.6,
    gia_kg: 19500,
    tt: 39187200,
  },
  {
    cay: 426,
    ten: 'VK75X75X1.1 6M IN',
    kg_cay: 14.22,
    tong_kg: 6057.72,
    gia_kg: 19500,
    tt: 118125540,
  },
]
const TONG_TIEN = 251343411
const TONG_KG = 12875.25

// ── kiểm số TRƯỚC khi đụng vào cơ sở dữ liệu ────────────────────────────────
// Tờ đơn tự mang bằng chứng của nó: cây × kg/cây = tổng kg, tổng kg × giá/kg =
// thành tiền, cộng dồn ra đúng tổng đơn. Lệch một đồng là đọc sai ảnh — dừng.
let hong = 0
let congTien = 0
let congKg = 0
for (const d of DONG) {
  const kg = Math.round(d.cay * d.kg_cay * 100) / 100
  if (Math.abs(kg - d.tong_kg) > 0.02) {
    console.error(`✗ ${d.ten}: ${d.cay} cây × ${d.kg_cay} = ${kg}kg ≠ ${d.tong_kg}kg`)
    hong++
  }
  const tt = Math.round(d.tong_kg * d.gia_kg)
  if (tt !== d.tt) {
    console.error(`✗ ${d.ten}: ${d.tong_kg}kg × ${d.gia_kg} = ${tt} ≠ ${d.tt}`)
    hong++
  }
  congTien += d.tt
  congKg += d.tong_kg
}
if (congTien !== TONG_TIEN) {
  console.error(`✗ cộng dòng ${congTien} ≠ tổng đơn ${TONG_TIEN}`)
  hong++
}
if (Math.abs(congKg - TONG_KG) > 0.02) {
  console.error(`✗ cộng kg ${congKg.toFixed(2)} ≠ ${TONG_KG}`)
  hong++
}
if (hong) {
  console.error(`\nDừng: ${hong} chỗ số không khớp tờ đơn.`)
  process.exit(1)
}
console.log(
  `✓ Phép kiểm: 6 dòng, ${congKg.toFixed(2)} kg, ${congTien.toLocaleString('vi-VN')}đ — khớp tờ đơn.\n`,
)

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

const { data: po, error: ePo } = await db
  .from('supply_purchase_orders')
  .select('id, code, status, vat_rate, note')
  .eq('code', PO)
  .maybeSingle()
if (ePo) throw new Error(ePo.message)
if (!po) throw new Error(`Không thấy ${PO}`)

const { data: lines, error: eL } = await db
  .from('supply_purchase_order_lines')
  .select(
    'id, sort_order, spec, qty_ordered, unit_price, material_id, price_basis, qty2, unit2',
  )
  .eq('po_id', po.id)
  .order('sort_order')
if (eL) throw new Error(eL.message)

// Công thức tính tiền của app phụ thuộc price_basis — script này chỉ đúng cho
// 'unit2' (tiền = qty2 × giá/kg). Gặp thứ khác thì dừng, đừng đoán.
const la = [...new Set(lines.map((l) => l.price_basis))]
if (la.length !== 1 || la[0] !== 'unit2')
  throw new Error(`đơn này có price_basis = ${la.join('/')} — script chỉ xử lý 'unit2'`)

const { data: mats } = await db
  .from('warehouse_materials')
  .select('id, code, name')
  .in('id', lines.map((l) => l.material_id).filter(Boolean))
const tenVt = new Map((mats ?? []).map((m) => [m.id, `${m.code} ${m.name}`]))

// Khớp theo SỐ LƯỢNG — duy nhất trong đơn này, nên một-một và không mơ hồ.
const conLai = [...DONG]
const viec = []
for (const l of lines) {
  const cay = Number(l.qty_ordered)
  const i = conLai.findIndex((d) => d.cay === cay)
  if (i < 0) {
    console.error(`✗ dòng #${l.sort_order} (${cay} cây) không có trên tờ đơn`)
    process.exit(1)
  }
  const d = conLai.splice(i, 1)[0]
  // Tổng kg đã có sẵn trong đơn — nó phải trùng con số in trên tờ, nếu không thì
  // một trong hai bản ghi sai và không được ghi đè lên nhau.
  const kgCo = Number(l.qty2)
  if (Math.abs(kgCo - d.tong_kg) > 0.02) {
    console.error(
      `✗ dòng #${l.sort_order}: qty2 đang là ${kgCo}kg, tờ đơn ghi ${d.tong_kg}kg`,
    )
    process.exit(1)
  }
  viec.push({ l, d })
}
if (conLai.length) {
  console.error(`✗ còn ${conLai.length} dòng trên tờ đơn chưa gắn được`)
  process.exit(1)
}

console.log(`${po.code} [${po.status}] VAT ${po.vat_rate ?? 0}% · tính tiền theo KG\n`)
let kiemTong = 0
for (const { l, d } of viec) {
  kiemTong += Math.round(Number(l.qty2) * d.gia_kg)
  console.log(
    `  #${l.sort_order} ${(tenVt.get(l.material_id) ?? '?').slice(0, 34).padEnd(36)}` +
      `${String(d.cay).padStart(4)} cây · ${String(d.tong_kg).padStart(9)} kg` +
      ` × ${d.gia_kg.toLocaleString('vi-VN').padStart(6)}đ/kg` +
      ` = ${d.tt.toLocaleString('vi-VN').padStart(13)}đ`,
  )
}
console.log(`\n  Cộng lại theo công thức của app: ${kiemTong.toLocaleString('vi-VN')}đ`)
if (kiemTong !== TONG_TIEN) {
  console.error(
    `  ✗ LỆCH ${(kiemTong - TONG_TIEN).toLocaleString('vi-VN')}đ so với tờ đơn — dừng.`,
  )
  process.exit(1)
}
console.log(`  ✓ khớp đúng tổng in trên đơn.\n`)

if (!APPLY) {
  console.log('Chạy lại với --apply để ghi.\n')
  process.exit(0)
}

for (const { l, d } of viec) {
  const { error } = await db
    .from('supply_purchase_order_lines')
    .update({
      unit_price: d.gia_kg,
      weight_per_unit: d.kg_cay,
      line_name: d.ten,
      line_unit: 'Cây',
    })
    .eq('id', l.id)
  if (error) throw new Error(`dòng #${l.sort_order}: ${error.message}`)
}

const themNote =
  ' ĐÃ BỔ SUNG ĐƠN GIÁ 18/09/2026 từ tờ ĐƠN ĐẶT HÀNG anh Truyền ký (tập scan' +
  ' dh-09182026013924.pdf): 19.500–20.100đ/KG, đúng như in trên tờ. Đơn tính tiền' +
  ' theo kg (price_basis unit2) nên tổng = tổng kg × đơn giá = 251.343.411đ (chưa VAT),' +
  ' khớp con số in trên tờ. Tổng kg 12.875,25 đã có sẵn trong đơn và trùng khớp tờ.'
// Chạy lại thì THAY ghi chú cũ, đừng cộng dồn — bản đầu của script này để lại
// một câu nói rằng đơn giá "đã quy về đồng/cây", nay không còn đúng nữa.
const DAU_NOTE = ' ĐÃ BỔ SUNG ĐƠN GIÁ 18/09/2026'
const noteCu = po.note ?? ''
const noteSach = noteCu.includes(DAU_NOTE)
  ? noteCu.slice(0, noteCu.indexOf(DAU_NOTE))
  : noteCu
const { error: eNote } = await db
  .from('supply_purchase_orders')
  .update({ note: noteSach + themNote })
  .eq('id', po.id)
if (eNote) throw new Error('note: ' + eNote.message)

// ── đối chiếu lại sau khi ghi ───────────────────────────────────────────────
// Tính ĐÚNG công thức poLineAmount của app, không tính theo cách riêng — đó là
// chỗ sai của bản đầu: nó tự nhân qty_ordered × unit_price rồi báo "✓ khớp",
// trong khi app nhân qty2 × unit_price và ra số gấp mười lần.
const { data: sau } = await db
  .from('supply_purchase_order_lines')
  .select('qty_ordered, qty2, unit_price, price_basis')
  .eq('po_id', po.id)
const tong = sau.reduce(
  (a, l) =>
    a +
    (l.price_basis === 'unit2'
      ? Number(l.qty2 ?? 0) * Number(l.unit_price)
      : Number(l.qty_ordered) * Number(l.unit_price)),
  0,
)
const thieu = sau.filter((r) => r.unit_price == null).length
console.log('── ĐỐI CHIẾU SAU KHI GHI ──')
console.log(
  `  ${thieu === 0 ? '✓' : '✗'} ${sau.length} dòng, ${thieu} dòng còn thiếu giá`,
)
console.log(
  `  ${tong === TONG_TIEN ? '✓' : '✗'} tổng theo công thức app: ${tong.toLocaleString('vi-VN')}đ` +
    ` (tờ đơn: ${TONG_TIEN.toLocaleString('vi-VN')}đ)`,
)
console.log('\n✓ Xong.\n')
