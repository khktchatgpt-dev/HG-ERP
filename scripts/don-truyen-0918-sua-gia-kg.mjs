// SỬA MÔ HÌNH GIÁ cho 7 đơn tính tiền theo KG (nạp 18/09/2026).
//
//   node scripts/don-truyen-0918-sua-gia-kg.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-sua-gia-kg.mjs --apply
//
// SAI Ở ĐÂU. Lúc nạp, tôi để qty_ordered = số CÂY rồi quy đơn giá về đồng/cây
// (thành tiền ÷ số cây). Nhưng unit_price chỉ giữ 2 số lẻ, mà phép chia đó hiếm
// khi hết: 36.300.000 ÷ 141 = 257.446,8085… Kết quả là UI hiện "363.967.999,64
// VND" thay vì 363.968.000 — số lẻ vô nghĩa trên một tờ đơn VND.
//
// ĐÚNG RA PHẢI DÙNG GIÁ ĐƠN VỊ KÉP, thứ hệ thống đã có sẵn cho đúng ca này
// (src/lib/po-line.ts): price_basis='unit2' ⇒ thành tiền = qty2 × unit_price.
// Đặt qty2 = tổng KG, unit2='kg', unit_price = giá/kg (số TRÒN trên tờ: 121.000,
// 113.000, 98.000…) thì 300 × 121.000 = 36.300.000 — tròn tuyệt đối, và
// qtyTotals() in được dòng "Tổng số KG" đúng như phiếu NCC.
// qty_ordered vẫn giữ SỐ CÂY: đó là số thật sự đặt, kho vẫn nhận theo cây.
//
// Bảy đơn dưới đây mỗi đơn dùng ĐÚNG MỘT giá/kg, nên tổng kg của từng dòng suy
// ngược được từ thành tiền — và script tự kiểm lại: qty2 × giá/kg phải ra đúng
// số nguyên đồng, sai một đồng là dừng.
//
// KHÔNG ĐỤNG tới PO-2026-0073 (Visa), 0074 (Kim Tuấn), 0082 (Khu Ông Mai): ba tờ
// đó báo giá theo CÂY/TẤM chứ không theo kg.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')

// mã đơn → đơn giá mỗi kg ghi trên tờ
const GIA_KG = {
  'PO-2026-0075': 121000,
  'PO-2026-0076': 121000,
  'PO-2026-0077': 113000,
  'PO-2026-0078': 113000,
  'PO-2026-0079': 120000,
  'PO-2026-0080': 98000,
  'PO-2026-0081': 108000,
}

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

let hong = 0
const viec = []
for (const [code, gia] of Object.entries(GIA_KG)) {
  const { data: po, error } = await db
    .from('supply_purchase_orders')
    .select('id, code, vat_rate')
    .eq('code', code)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!po) throw new Error(`không thấy ${code}`)

  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('id, sort_order, line_name, qty_ordered, unit_price, price_basis')
    .eq('po_id', po.id)
    .order('sort_order')

  let congKg = 0
  let congTien = 0
  const dong = []
  for (const l of ln) {
    const ttCu = Number(l.qty_ordered) * Number(l.unit_price)
    // Tổng kg suy ngược từ thành tiền. Kg trên tờ có tối đa 3 số lẻ.
    const kg = Math.round((ttCu / gia) * 1000) / 1000
    const ttMoi = kg * gia
    if (!Number.isInteger(Math.round(ttMoi * 100) / 100) || Math.abs(ttMoi - ttCu) > 1) {
      console.error(
        `✗ ${code} #${l.sort_order}: ${kg}kg × ${gia} = ${ttMoi} — không ra số nguyên hoặc lệch quá 1đ so với ${ttCu}`,
      )
      hong++
    }
    congKg += kg
    congTien += ttMoi
    dong.push({
      id: l.id,
      stt: l.sort_order,
      ten: l.line_name,
      cay: Number(l.qty_ordered),
      kg,
      ttCu,
      ttMoi,
    })
  }
  viec.push({ po, gia, dong, congKg, congTien })
}
if (hong) {
  console.error(`\nDừng: ${hong} dòng không suy ngược được tổng kg.`)
  process.exit(1)
}

for (const v of viec) {
  const cu = v.dong.reduce((a, b) => a + b.ttCu, 0)
  console.log(
    `  ${v.po.code}  ${v.gia.toLocaleString('vi-VN')}đ/kg  ${v.dong.length} dòng` +
      `   cũ ${cu.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}` +
      ` → mới ${v.congTien.toLocaleString('vi-VN')}   (${v.congKg.toLocaleString('vi-VN')} kg)`,
  )
  if (!APPLY) continue
  for (const d of v.dong) {
    const { error } = await db
      .from('supply_purchase_order_lines')
      .update({ qty2: d.kg, unit2: 'kg', unit_price: v.gia, price_basis: 'unit2' })
      .eq('id', d.id)
    if (error) throw new Error(`${v.po.code} #${d.stt}: ${error.message}`)
  }
}

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const v of viec) {
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('qty_ordered, qty2, unit_price, price_basis')
    .eq('po_id', v.po.id)
  // Đúng công thức poLineAmount của app.
  const tien = ln.reduce(
    (a, l) =>
      a +
      (l.price_basis === 'unit2'
        ? Number(l.qty2 ?? 0) * Number(l.unit_price)
        : Number(l.qty_ordered) * Number(l.unit_price)),
    0,
  )
  const tron = Number.isInteger(tien)
  console.log(
    `  ${tron ? '✓' : '✗'} ${v.po.code}  ${tien.toLocaleString('vi-VN')}đ` +
      `  (${ln.filter((l) => l.price_basis === 'unit2').length}/${ln.length} dòng theo kg)`,
  )
}
console.log('\n✓ Xong.\n')
