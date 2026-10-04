// GẮN NGƯỜI PHỤ TRÁCH cho 10 đơn nạp 18/09/2026.
//
//   node scripts/don-truyen-0918-giao-viec.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-giao-viec.mjs --apply
//
// Anh Trương Thanh Truyền (Cung Ứng - Mua Hàng) ký ô NGƯỜI ĐẶT HÀNG trên cả 11
// tờ, nhưng script nạp đơn bỏ trống assigned_to/created_by nên danh sách hiện
// "chưa giao ai" — đơn thành vô chủ, không lọt vào bộ lọc "Của tôi" của chính
// người đang giữ nó, và không ai bị nhắc khi NCC trễ hẹn.
//
// PO-2026-0068 đã đứng tên anh từ trước; lấy đúng cách nó ghi (cả hai cột) để
// 10 đơn còn lại nhất quán với nó.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const TRUYEN = 'e99f2f40-7965-46de-9d38-2989f73cb81f' // Trương Thanh Truyền
const MA = [
  'PO-2026-0073', 'PO-2026-0074', 'PO-2026-0075', 'PO-2026-0076', 'PO-2026-0077',
  'PO-2026-0078', 'PO-2026-0079', 'PO-2026-0080', 'PO-2026-0081', 'PO-2026-0082',
]

const db = await client(import.meta.url)

// Kiểm người nhận việc có thật và còn làm việc, trước khi gắn tên ai đó vào 10 đơn.
const { data: u } = await db
  .from('users')
  .select('id, name, is_active, department_id')
  .eq('id', TRUYEN)
  .maybeSingle()
if (!u) throw new Error('không thấy tài khoản ' + TRUYEN)
if (!u.is_active) throw new Error(`${u.name} đang ngừng hoạt động — không giao việc được`)
console.log(`Giao cho: ${u.name}\n`)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const code of MA) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, assigned_to, created_by')
    .eq('code', code)
    .maybeSingle()
  if (!po) throw new Error(`không thấy ${code}`)

  const patch = {}
  if (po.assigned_to !== TRUYEN) patch.assigned_to = TRUYEN
  if (po.created_by == null) patch.created_by = TRUYEN // đã có người tạo thì giữ nguyên

  if (!Object.keys(patch).length) {
    console.log(`  = ${code} đã đứng tên đúng, bỏ qua`)
    continue
  }
  console.log(`  + ${code}  ${Object.keys(patch).join(' + ')}`)
  if (!APPLY) continue
  const { error } = await db.from('supply_purchase_orders').update(patch).eq('id', po.id)
  if (error) throw new Error(`${code}: ${error.message}`)
}

if (APPLY) {
  console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
  const { data: sau } = await db
    .from('supply_purchase_orders')
    .select('code, assigned_to, created_by')
    .in('code', [...MA, 'PO-2026-0068'])
    .order('code')
  for (const p of sau)
    console.log(
      `  ${p.assigned_to === TRUYEN ? '✓' : '✗'} ${p.code}` +
        `  phụ trách ${p.assigned_to === TRUYEN ? 'Truyền' : '—'}` +
        `  · tạo bởi ${p.created_by === TRUYEN ? 'Truyền' : '—'}`,
    )
  console.log('\n✓ Xong.\n')
} else {
  console.log('\nChạy lại với --apply để ghi.\n')
}
