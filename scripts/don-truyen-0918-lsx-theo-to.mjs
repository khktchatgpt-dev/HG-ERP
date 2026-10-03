// TRẢ LỆNH SẢN XUẤT VỀ ĐÚNG CHỮ GHI TRÊN TỜ ĐƠN.
//
//   node scripts/don-truyen-0918-lsx-theo-to.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-lsx-theo-to.mjs --apply
//
// HOÀN TÁC don-truyen-0918-lsx-jawoll.mjs. Script đó thấy lệnh 09/26-27 - MX
// không có món "Ghế Bank 2 Gỗ Jawoll" nên tự chuyển 5 đơn sang lệnh
// 01/26-27 - JAWOLL. Đó là suy diễn theo sản phẩm, không phải chứng từ.
//
// CHỦ DỰ ÁN CHỐT: gắn THEO ĐÚNG LỆNH GHI TRÊN TỜ. Danh mục lệnh thiếu món nào
// là việc của bên lập lệnh, không phải cớ để đơn mua tự đổi lệnh — người ký tờ
// đơn ghi MERXX 09 thì đơn thuộc MERXX 09.
//
// "MERXX 09 JAWOLL" là MỘT cụm: đợt MERXX 09, phần hàng Jawoll — không phải hai
// lệnh. Hệ thống không có lệnh nào tên như vậy; lệnh MERXX 09 là 09/26-27 - MX.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)

const { data: os } = await db.from('production_orders').select('id, code')
const id = (code) => {
  const o = os.find((x) => x.code === code)
  if (!o) throw new Error('không thấy lệnh ' + code)
  return o.id
}
const MX09 = id('09/26-27 - MX')
const MX10 = id('10/26-27 - MX')
const JAW = id('01/26-27 - JAWOLL')

// mã đơn → { chinh, phu[] } theo ĐÚNG ô lệnh in trên tờ
const THEO_TO = {
  'PO-2026-0075': { to: 'Đơn MERXX 09 JAWOLL + MERXX 10', chinh: MX09, phu: [MX10] },
  'PO-2026-0076': { to: 'Đơn MERXX 09 JAWOLL', chinh: MX09, phu: [] },
  'PO-2026-0078': { to: 'LSX MERXX 09 JAWOLL', chinh: MX09, phu: [] },
  'PO-2026-0079': { to: 'LSX MERXX 09 JAWOLL', chinh: MX09, phu: [] },
  'PO-2026-0080': { to: 'LSX MERXX 09', chinh: MX09, phu: [] },
}
const ten = (i) => os.find((x) => x.id === i)?.code ?? '—'

console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const [code, t] of Object.entries(THEO_TO)) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, production_order_id')
    .eq('code', code)
    .maybeSingle()
  const { data: phuCu } = await db
    .from('supply_po_extra_lsx')
    .select('production_order_id')
    .eq('po_id', po.id)
  const dsCu = (phuCu ?? []).map((e) => e.production_order_id)

  const doiChinh = po.production_order_id !== t.chinh
  const boPhu = dsCu.filter((x) => !t.phu.includes(x))
  const themPhu = t.phu.filter((x) => !dsCu.includes(x))

  console.log(`  ${code}  tờ ghi: "${t.to}"`)
  console.log(
    `    chính: ${ten(po.production_order_id)}${doiChinh ? ` → ${ten(t.chinh)}` : '  (giữ)'}` +
      (boPhu.length ? `\n    gỡ phụ: ${boPhu.map(ten).join(', ')}` : '') +
      (themPhu.length ? `\n    thêm phụ: ${themPhu.map(ten).join(', ')}` : ''),
  )
  if (!APPLY) continue

  if (doiChinh) {
    const { error } = await db
      .from('supply_purchase_orders')
      .update({ production_order_id: t.chinh })
      .eq('id', po.id)
    if (error) throw new Error(`${code}: ${error.message}`)
  }
  for (const x of boPhu) {
    const { error } = await db
      .from('supply_po_extra_lsx')
      .delete()
      .eq('po_id', po.id)
      .eq('production_order_id', x)
    if (error) throw new Error(`${code} gỡ phụ: ${error.message}`)
  }
  for (const x of themPhu) {
    const { error } = await db
      .from('supply_po_extra_lsx')
      .insert({ po_id: po.id, production_order_id: x })
    if (error) throw new Error(`${code} thêm phụ: ${error.message}`)
  }
}

if (!APPLY) { console.log('\nChạy lại với --apply để ghi.\n'); process.exit(0) }

console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const [code, t] of Object.entries(THEO_TO)) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, production_order_id')
    .eq('code', code)
    .maybeSingle()
  const { data: phu } = await db
    .from('supply_po_extra_lsx')
    .select('production_order_id')
    .eq('po_id', po.id)
  const ds = (phu ?? []).map((e) => e.production_order_id).sort()
  const ok =
    po.production_order_id === t.chinh &&
    ds.length === t.phu.length &&
    ds.every((x, i) => x === [...t.phu].sort()[i])
  const conJaw = po.production_order_id === JAW || ds.includes(JAW)
  console.log(
    `  ${ok && !conJaw ? '✓' : '✗'} ${code}  ${ten(po.production_order_id)}` +
      (ds.length ? ` + ${ds.map(ten).join(' + ')}` : ''),
  )
}
console.log('\n✓ Xong.\n')
