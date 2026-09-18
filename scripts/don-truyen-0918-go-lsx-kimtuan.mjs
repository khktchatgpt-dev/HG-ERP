// GỠ LỆNH SẢN XUẤT gắn nhầm cho PO-2026-0074 (Sắt thép Kim Tuấn).
//
//   node scripts/don-truyen-0918-go-lsx-kimtuan.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-go-lsx-kimtuan.mjs --apply
//
// SAI Ở ĐÂU. Tờ Kim Tuấn (ĐH số 02/2026 ngày 09/09/2026) để TRỐNG ô lệnh sản
// xuất — chín tờ còn lại trong tập đều điền ô đó ("Đơn IBIZA + MERXX 09",
// "LSX MERXX 10", "Lsx 02 - ROSCO/IBIZA (T10)"…). Lúc nạp tôi lấy chữ "ĐƠN HÀNG
// IBIZA THÁNG 10" ở cột TÊN CHI TIẾT của bốn dòng hàng — tức mô tả món hàng —
// rồi suy ra lệnh 02/26-27 - ROSCO. Suy diễn, không phải dữ liệu trên tờ.
//
// Để nguyên thì 95.010.000đ thép tấm bị tính vào giá thành một lệnh mà tờ đơn
// không hề nói nó thuộc về. Gỡ ra, để "Ngoài LSX" như đơn khuôn mẫu Quang Minh —
// ai biết nó thuộc lệnh nào thì gắn lại trên giao diện.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const CODE = 'PO-2026-0074'
const CU = 'Lệnh ghi trên đơn: "ĐƠN HÀNG IBIZA THÁNG 10".'
const MOI =
  'Tờ đơn ĐỂ TRỐNG ô lệnh sản xuất — không gắn lệnh nào.' +
  ' ("ĐƠN HÀNG IBIZA THÁNG 10" trên tờ là tên chi tiết của bốn dòng hàng, không phải ô lệnh.)'

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

const { data: po } = await db
  .from('supply_purchase_orders')
  .select('id, code, production_order_id, note')
  .eq('code', CODE)
  .maybeSingle()
if (!po) throw new Error('không thấy ' + CODE)

const { data: lsx } = await db
  .from('production_orders')
  .select('code')
  .eq('id', po.production_order_id)
  .maybeSingle()
const { data: phu } = await db
  .from('supply_po_extra_lsx')
  .select('po_id')
  .eq('po_id', po.id)

console.log(`  ${CODE}`)
console.log(`    lệnh chính đang gắn: ${lsx?.code ?? '(không có)'}  → gỡ`)
console.log(`    lệnh phụ: ${phu?.length ?? 0} dòng`)
console.log(`    ghi chú: sửa câu "Lệnh ghi trên đơn" thành đúng sự thật`)

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

const note = (po.note ?? '').includes(CU) ? po.note.replace(CU, MOI) : (po.note ?? '') + ' ' + MOI
const { error } = await db
  .from('supply_purchase_orders')
  .update({ production_order_id: null, note })
  .eq('id', po.id)
if (error) throw new Error(error.message)
if (phu?.length) {
  const { error: e2 } = await db.from('supply_po_extra_lsx').delete().eq('po_id', po.id)
  if (e2) throw new Error('lệnh phụ: ' + e2.message)
}

const { data: sau } = await db
  .from('supply_purchase_orders')
  .select('code, production_order_id, note')
  .eq('code', CODE)
  .maybeSingle()
console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
console.log(`  ${sau.production_order_id === null ? '✓' : '✗'} ${sau.code} không còn gắn lệnh`)
console.log(`  ${sau.note.includes('ĐỂ TRỐNG ô lệnh') ? '✓' : '✗'} ghi chú đã nói đúng sự thật`)
console.log('\n✓ Xong.\n')
