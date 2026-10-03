// GẮN ĐÚNG LỆNH cho hàng "Ghế Bank 2 Gỗ Jawoll".
//
//   node scripts/don-truyen-0918-lsx-jawoll.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-lsx-jawoll.mjs --apply
//
// CĂN CỨ (tra trên dòng lệnh sản xuất, không suy từ tên đơn):
//   · 01/26-27 - JAWOLL có đúng món đó — mã BN0228HG-AL,
//     "Gartenbank 2-sitzer Eucalyptus Alu rahmen" / "Bank II - Khung nhôm, gỗ
//     Bạch Đàn", 557 cái.
//   · 09/26-27 - MX có đủ 10 dòng và KHÔNG có món Bank nào; nó chứa đúng phần
//     còn lại của các đơn: Bàn CNKG 150(200)x90, Ghế 5 bậc Verona, Ghế Amalfi,
//     Bàn CNKG Semi 150(220)x90, Ghế Atrani.
//
// Tờ đơn ghi "MER 09" ở cột LSX của cả dòng Jawoll, nhưng lệnh MERXX 09 không
// sản xuất món đó — chủ dự án chốt: lệnh nào có sản phẩm thì gắn lệnh đó.
//
// Đơn TOÀN hàng Jawoll thì đổi lệnh chính; đơn TRỘN thì giữ lệnh chính và thêm
// JAWOLL làm lệnh phụ, vì cả hai lệnh đều thật sự dùng vật tư của đơn đó.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)

const { data: jaw } = await db
  .from('production_orders')
  .select('id, code')
  .eq('code', '01/26-27 - JAWOLL')
  .maybeSingle()
if (!jaw) throw new Error('không thấy lệnh 01/26-27 - JAWOLL')

// Phép thử căn cứ: lệnh JAWOLL phải thật sự có món Bank, nếu không thì dừng.
const { data: co } = await db
  .from('production_order_lines')
  .select('product_code, name_vi')
  .eq('production_order_id', jaw.id)
if (!co?.some((l) => /bank/i.test(l.name_vi ?? ''))) {
  console.error('✗ lệnh JAWOLL không có món Bank — căn cứ sai, dừng.')
  process.exit(1)
}
console.log(`Căn cứ: ${jaw.code} có ${co.map((l) => l.product_code).join(', ')} — "${co[0].name_vi}"\n`)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

const MA = ['PO-2026-0075', 'PO-2026-0076', 'PO-2026-0078', 'PO-2026-0079', 'PO-2026-0080']
for (const code of MA) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, production_order_id, note')
    .eq('code', code)
    .maybeSingle()
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('line_name')
    .eq('po_id', po.id)
  const nJaw = ln.filter((l) => /jawoll/i.test(l.line_name ?? '')).length
  const toanBo = nJaw === ln.length

  const { data: phu } = await db
    .from('supply_po_extra_lsx')
    .select('production_order_id')
    .eq('po_id', po.id)
  const daCoPhu = (phu ?? []).some((e) => e.production_order_id === jaw.id)
  const daLaChinh = po.production_order_id === jaw.id

  if (toanBo) {
    if (daLaChinh) { console.log(`  = ${code} đã đứng lệnh JAWOLL`); continue }
    console.log(`  ↻ ${code}  ${nJaw}/${ln.length} dòng Jawoll → ĐỔI lệnh chính sang JAWOLL`)
    if (!APPLY) continue
    const { error } = await db
      .from('supply_purchase_orders')
      .update({ production_order_id: jaw.id })
      .eq('id', po.id)
    if (error) throw new Error(`${code}: ${error.message}`)
    // Đơn thuần Jawoll thì MERXX 09 không còn liên quan — gỡ khỏi lệnh phụ nếu có.
    await db.from('supply_po_extra_lsx').delete().eq('po_id', po.id).eq('production_order_id', jaw.id)
  } else {
    if (daCoPhu) { console.log(`  = ${code} đã có JAWOLL ở lệnh phụ`); continue }
    console.log(`  + ${code}  ${nJaw}/${ln.length} dòng Jawoll → THÊM JAWOLL làm lệnh phụ`)
    if (!APPLY) continue
    const { error } = await db
      .from('supply_po_extra_lsx')
      .insert({ po_id: po.id, production_order_id: jaw.id })
    if (error) throw new Error(`${code}: ${error.message}`)
  }
}

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const code of MA) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, production_order_id')
    .eq('code', code)
    .maybeSingle()
  const { data: o } = await db
    .from('production_orders')
    .select('code')
    .eq('id', po.production_order_id)
    .maybeSingle()
  const { data: phu } = await db
    .from('supply_po_extra_lsx')
    .select('production_orders(code)')
    .eq('po_id', po.id)
  const ds = (phu ?? []).map((e) => e.production_orders?.code).filter(Boolean)
  const okJaw = o?.code === jaw.code || ds.includes(jaw.code)
  console.log(`  ${okJaw ? '✓' : '✗'} ${code}  chính: ${o?.code ?? '—'}${ds.length ? '  phụ: ' + ds.join(', ') : ''}`)
}
console.log('\n✓ Xong.\n')
