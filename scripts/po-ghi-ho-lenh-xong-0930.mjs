// GHI HỘ ĐƠN MUA CỦA LỆNH ĐÃ HOÀN THÀNH — 30/09/2026.
//
//   node scripts/po-ghi-ho-lenh-xong-0930.mjs            # dò khô
//   node scripts/po-ghi-ho-lenh-xong-0930.mjs --apply    # ghi
//
// 5 lệnh 01…05/26-27 - MX đã hoàn thành 25/09 nhưng 13 đơn gỗ gia công của
// Nguyễn Đình Huy còn nằm ở nháp / chờ duyệt, làm hộp ký BGĐ báo "chờ 15 ngày".
// Thực tế (chủ dự án xác nhận 28/09 và 30/09): các đơn ĐÃ KÝ, ĐÃ GỬI NCC,
// HÀNG ĐÃ VỀ ĐỦ — chỉ là chưa ai bấm trên hệ thống.
//
// Ghi đúng những gì app tự ghi khi đi hết vòng (submit → decide → advance
// ordered → advance received), không thêm không bớt:
//   · approval_events: 'submitted' (chỉ đơn còn nháp) + 'approved', lý do nói
//     rõ là GHI HỘ.
//   · đơn: status 'received', approved_by/approved_at, ordered_at.
//   · KHÔNG đụng `note` (ô đó in lên phiếu NCC), KHÔNG phát thông báo.
// Chỉ nhận đơn: lệnh chính đã completed, TOÀN dòng tự do (không dòng vật tư
// kho — phần kho do phiếu nhập quyết, BR-08), status draft/pending_approval.
// Ngày ký giấy không rõ nên mốc là lúc chạy script, lý do nói rõ điều đó.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const APPROVER_NAME = 'Điền Hg' // người đang giữ hộp ký và chỉ đạo xử lý

const { data: aps, error: ae } = await sb
  .from('users')
  .select('id, name, email')
  .eq('name', APPROVER_NAME)
if (ae) throw ae
if (aps?.length !== 1) throw new Error(`người duyệt "${APPROVER_NAME}": thấy ${aps?.length ?? 0}`)
const ap = aps[0]

const { data: pos, error } = await sb
  .from('supply_purchase_orders')
  .select(
    'id, code, status, expected_at, assigned_to, created_by, lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code, status)',
  )
  .in('status', ['draft', 'pending_approval'])
  .order('code')
if (error) throw error
const { data: lines, error: le } = await sb
  .from('supply_purchase_order_lines')
  .select('po_id, material_id')
  .in(
    'po_id',
    pos.map((p) => p.id),
  )
if (le) throw le

const targets = pos.filter(
  (p) =>
    p.lsx?.status === 'completed' &&
    !lines.some((l) => l.po_id === p.id && l.material_id != null),
)
console.log(`Người duyệt ghi hộ: ${ap.name} <${ap.email}>`)
console.log(`${targets.length} đơn:`)

const now = new Date()
const at = (addMin) => new Date(now.getTime() + addMin * 60_000).toISOString()
const reason =
  'Ghi hộ 30/09/2026 theo chỉ đạo: đơn đã ký, đã gửi NCC và hàng đã về đủ ngoài hệ thống; lệnh sản xuất đã hoàn thành 25/09. Ngày ký thật không ghi được nên mốc là lúc ghi hộ.'

for (const p of targets) {
  console.log(`  ${p.code} · ${p.status} · lệnh ${p.lsx.code} → đã duyệt · đã gửi NCC · đã về đủ`)
  if (!APPLY) continue
  const events = []
  if (p.status === 'draft')
    events.push({
      entity_type: 'po',
      entity_id: p.id,
      entity_code: p.code,
      action: 'submitted',
      actor_id: p.assigned_to ?? p.created_by,
      created_at: at(0),
      reason: 'Ghi hộ 30/09/2026 — đơn đã trình ký ngoài hệ thống.',
    })
  events.push({
    entity_type: 'po',
    entity_id: p.id,
    entity_code: p.code,
    action: 'approved',
    actor_id: ap.id,
    created_at: at(1),
    reason,
  })
  const { error: ee } = await sb.from('approval_events').insert(events)
  if (ee) throw new Error(`${p.code} nhật ký: ${ee.message}`)
  const { error: ue } = await sb
    .from('supply_purchase_orders')
    .update({
      status: 'received',
      approved_by: ap.id,
      approved_at: at(1),
      ordered_at: at(2),
    })
    .eq('id', p.id)
    .eq('status', p.status)
  if (ue) throw new Error(`${p.code} cập nhật: ${ue.message}`)
  console.log('     ✓ đã ghi')
}
if (!APPLY) console.log('\n(dò khô — thêm --apply để ghi)')
