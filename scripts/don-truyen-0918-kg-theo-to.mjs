// GHI TỔNG KG ĐÚNG THEO TỜ ĐƠN, để tiền khớp chứng từ.
//
//   node scripts/don-truyen-0918-kg-theo-to.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-kg-theo-to.mjs --apply
//
// Bản trước (don-truyen-0918-dong-bo-kg.mjs) ghi tổng kg = tích kg/m × dài × SL
// để hai màn của app nói cùng một số. Đổi lại: chứng từ lệch tờ 14.650đ. Chủ dự
// án chốt ưu tiên ngược — CHỨNG TỪ PHẢI KHỚP GIẤY.
//
// Chọn được vì mọi con số ĐI RA NGOÀI đều đọc thẳng cột qty2 từ DB, không tính
// lại: phiếu đặt hàng và file Excel gửi NCC (po-excel.ts), tổng ở màn danh sách
// (posRepo.totalsByPoIds), công nợ. Chỉ MÀN XEM CHI TIẾT trên web tự dẫn xuất
// lại từ kg/m nên sẽ hiện lệch ~0,006% — đó là chỗ app tính hai đường khác nhau,
// cần sửa ở app chứ không bù bằng cách ghi sai số chứng từ.
//
// Số kg dưới đây chép nguyên từ cột "Tổng số kg" trên tờ, theo thứ tự dòng.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const DAU = ' KHỐI LƯỢNG:'

const TO = {
  'PO-2026-0075': { gia: 121000, kg: [300, 300, 303, 300, 300, 300, 300, 305, 300, 300] },
  'PO-2026-0076': { gia: 121000, kg: [300, 300] },
  'PO-2026-0078': {
    gia: 113000,
    kg: [243.6, 59.885, 319.77, 176.4, 333.9, 266.7, 102.306, 62.71, 54.835, 54.652, 245.657, 229.755, 64.694, 18.896],
  },
  'PO-2026-0079': { gia: 120000, kg: [83] },
  'PO-2026-0080': { gia: 98000, kg: [190.22, 310.69] },
  'PO-2026-0077': { gia: 113000, kg: [110.16, 318.24] },
  'PO-2026-0081': { gia: 108000, kg: [37] },
}
// Tiền hàng in trên tờ — phép kiểm cuối.
const TIEN = {
  'PO-2026-0075': 363968000, 'PO-2026-0076': 72600000, 'PO-2026-0077': 48409200,
  'PO-2026-0078': 252414880, 'PO-2026-0079': 9960000, 'PO-2026-0080': 49089180,
  'PO-2026-0081': 3996000,
}

// ── kiểm số TRƯỚC khi đụng vào cơ sở dữ liệu ────────────────────────────────
let hong = 0
for (const [code, t] of Object.entries(TO)) {
  const cong = Math.round(t.kg.reduce((a, b) => a + b, 0) * t.gia)
  if (cong !== TIEN[code]) {
    console.error(`✗ ${code}: ${t.kg.reduce((a,b)=>a+b,0)}kg × ${t.gia} = ${cong} ≠ ${TIEN[code]} in trên tờ`)
    hong++
  }
}
if (hong) { console.error(`\nDừng: ${hong} đơn không khớp.`); process.exit(1) }
console.log('✓ Phép kiểm: tổng kg × đơn giá của cả 7 đơn ra đúng tiền hàng in trên tờ.\n')

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const [code, t] of Object.entries(TO)) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, note')
    .eq('code', code)
    .maybeSingle()
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('id, sort_order, qty2, unit_price')
    .eq('po_id', po.id)
    .order('sort_order')
  if (ln.length !== t.kg.length) throw new Error(`${code}: ${ln.length} dòng ≠ ${t.kg.length} số kg khai`)

  let doi = 0
  for (let i = 0; i < ln.length; i++) {
    if (Number(ln[i].unit_price) !== t.gia)
      throw new Error(`${code} #${i}: đơn giá ${ln[i].unit_price} ≠ ${t.gia}`)
    if (Number(ln[i].qty2) === t.kg[i]) continue
    doi++
    if (!APPLY) continue
    const { error } = await db
      .from('supply_purchase_order_lines')
      .update({ qty2: t.kg[i] })
      .eq('id', ln[i].id)
    if (error) throw new Error(`${code} #${i}: ${error.message}`)
  }
  const note = (po.note ?? '').includes(DAU) ? po.note.slice(0, po.note.indexOf(DAU)) : po.note
  if (APPLY && note !== po.note)
    await db.from('supply_purchase_orders').update({ note }).eq('id', po.id)
  console.log(
    `  ${code}  ${String(doi).padStart(2)}/${ln.length} dòng đổi  →` +
      ` ${TIEN[code].toLocaleString('vi-VN')}đ` +
      (note !== po.note ? '  (gỡ ghi chú khối lượng cũ)' : ''),
  )
}

if (!APPLY) { console.log('\nChạy lại với --apply để ghi.\n'); process.exit(0) }

console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const code of Object.keys(TO)) {
  const { data: po } = await db.from('supply_purchase_orders').select('id').eq('code', code).maybeSingle()
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('qty_ordered, qty2, unit_price, price_basis')
    .eq('po_id', po.id)
  const tien = Math.round(
    ln.reduce((a, l) => a + (l.price_basis === 'unit2' ? Number(l.qty2) : Number(l.qty_ordered)) * Number(l.unit_price), 0),
  )
  console.log(
    `  ${tien === TIEN[code] ? '✓' : '✗'} ${code}  ${tien.toLocaleString('vi-VN')}đ` +
      `  (tờ: ${TIEN[code].toLocaleString('vi-VN')}đ)`,
  )
}
console.log('\n✓ Xong.\n')
