// ĐỒNG BỘ TỔNG KG để màn danh sách và màn chi tiết nói CÙNG MỘT SỐ.
//
//   node scripts/don-truyen-0918-dong-bo-kg.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-dong-bo-kg.mjs --apply
//
// VẤN ĐỀ. App có hai đường tính tiền dòng:
//   · danh sách (posRepo.totalsByPoIds) đọc thẳng cột qty2;
//   · chi tiết  (deriveLine) tính lại qty2 = kg/m × dài cây × SL (mẫu nhôm)
//     hoặc kg mỗi đơn vị × SL (mẫu metal_kg).
// Tờ đơn NCC ghi tổng kg TRÒN (300 kg) chứ không phải tích đúng của kg/m × dài,
// nên hai đường ra hai số và người xem thấy đơn "đổi giá" khi bấm vào.
//
// CHỦ DỰ ÁN CHỐT 18/09/2026: lấy giá trị app tự tính làm chuẩn, ghi ngược vào
// cột qty2. Hai màn khớp tuyệt đối; phần lệch so với tờ (≤0,006%) ghi chú lên
// đơn. Chọn được vì chính tờ Tiến Đạt ghi "khối lượng dự kiến, thanh toán theo
// khối lượng cân thực tế" — con số đó vốn không phải số quyết toán.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const DAU = ' KHỐI LƯỢNG:'
const r4 = (n) => Math.round(n * 1e4) / 1e4

// mã đơn → tiền hàng in trên tờ
const TREN_TO = {
  'PO-2026-0075': 363968000,
  'PO-2026-0076': 72600000,
  'PO-2026-0077': 48409200,
  'PO-2026-0078': 252414880,
  'PO-2026-0079': 9960000,
  'PO-2026-0080': 49089180,
  'PO-2026-0081': 3996000,
}

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const [code, to] of Object.entries(TREN_TO)) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, template, note')
    .eq('code', code)
    .maybeSingle()
  if (!po) throw new Error(`không thấy ${code}`)

  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('id, sort_order, qty_ordered, qty2, unit_price, bar_length_m, weight_per_m, weight_per_unit')
    .eq('po_id', po.id)
    .order('sort_order')

  let doi = 0
  let tong = 0
  for (const l of ln) {
    const sl = Number(l.qty_ordered)
    // Đúng công thức deriveByTemplate của app cho mẫu của đơn này.
    const moi =
      po.template === 'metal_kg'
        ? r4(Number(l.weight_per_unit) * sl)
        : r4(Number(l.weight_per_m) * Number(l.bar_length_m) * sl)
    if (!(moi > 0)) throw new Error(`${code} #${l.sort_order}: thiếu ô quy đổi`)
    tong += moi * Number(l.unit_price)
    if (r4(Number(l.qty2)) !== moi) {
      doi++
      if (APPLY) {
        const { error } = await db
          .from('supply_purchase_order_lines')
          .update({ qty2: moi })
          .eq('id', l.id)
        if (error) throw new Error(`${code} #${l.sort_order}: ${error.message}`)
      }
    }
  }
  tong = Math.round(tong)
  const lech = tong - to

  const cu = po.note ?? ''
  const sach = cu.includes(DAU) ? cu.slice(0, cu.indexOf(DAU)) : cu
  const them =
    lech === 0
      ? ''
      : `${DAU} tổng kg trên hệ thống lấy theo tích kg/m × dài cây × SL` +
        ` (${tong.toLocaleString('vi-VN')}đ), lệch ${lech > 0 ? '+' : ''}${lech.toLocaleString('vi-VN')}đ` +
        ` so với ${to.toLocaleString('vi-VN')}đ in trên tờ — vì NCC ghi tổng kg làm tròn.` +
        ` Số trên tờ là khối lượng DỰ KIẾN; thanh toán theo khối lượng cân thực tế khi giao.`

  console.log(
    `  ${code}  ${po.template.padEnd(10)} ${String(doi).padStart(2)}/${ln.length} dòng đổi` +
      `  → ${tong.toLocaleString('vi-VN')}đ` +
      (lech === 0 ? '  ✓ khớp tờ' : `  (lệch ${lech > 0 ? '+' : ''}${lech.toLocaleString('vi-VN')}đ so tờ)`),
  )
  if (APPLY && sach + them !== cu) {
    const { error } = await db
      .from('supply_purchase_orders')
      .update({ note: sach + them })
      .eq('id', po.id)
    if (error) throw new Error(`${code} note: ${error.message}`)
  }
}

if (APPLY) {
  console.log('\n── ĐỐI CHIẾU: hai màn có cùng số chưa ──')
  for (const code of Object.keys(TREN_TO)) {
    const { data: po } = await db
      .from('supply_purchase_orders')
      .select('id, template')
      .eq('code', code)
      .maybeSingle()
    const { data: ln } = await db
      .from('supply_purchase_order_lines')
      .select('qty_ordered, qty2, unit_price, price_basis, bar_length_m, weight_per_m, weight_per_unit')
      .eq('po_id', po.id)
    // đường của màn DANH SÁCH
    const ds = ln.reduce(
      (a, l) => a + (l.price_basis === 'unit2' ? Number(l.qty2) : Number(l.qty_ordered)) * Number(l.unit_price),
      0,
    )
    // đường của màn CHI TIẾT
    const ct = ln.reduce((a, l) => {
      const sl = Number(l.qty_ordered)
      const kg =
        po.template === 'metal_kg'
          ? r4(Number(l.weight_per_unit) * sl)
          : r4(Number(l.weight_per_m) * Number(l.bar_length_m) * sl)
      return a + kg * Number(l.unit_price)
    }, 0)
    const ok = Math.round(ds) === Math.round(ct)
    console.log(`  ${ok ? '✓' : '✗'} ${code}  danh sách ${Math.round(ds).toLocaleString('vi-VN')} · chi tiết ${Math.round(ct).toLocaleString('vi-VN')}`)
  }
  console.log('\n✓ Xong.\n')
} else {
  console.log('\nChạy lại với --apply để ghi.\n')
}
