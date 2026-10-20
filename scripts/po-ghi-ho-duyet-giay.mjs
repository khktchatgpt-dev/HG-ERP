// GHI HỘ VIỆC DUYỆT + GỬI NCC ĐÃ LÀM TRÊN GIẤY — 25/09/2026.
//
//   node scripts/po-ghi-ho-duyet-giay.mjs            # dò khô
//   node scripts/po-ghi-ho-duyet-giay.mjs --apply    # ghi
//
// 5 đơn ngũ kim lệnh 02/26-27 - ROSCO (nạp từ vt.xlsx) đã được Vũ Phương Thảo ký
// duyệt TRÊN GIẤY và đã gửi NCC; trên hệ thống chúng vẫn ở nháp. Chủ dự án chọn
// "ghi hộ" (25/09/2026) thay vì bắt duyệt lại trên app — duyệt lại thì ngày
// duyệt thành hôm nay, sai với tờ giấy.
//
// GHI ĐÚNG NHỮNG GÌ APP TỰ GHI khi đi hết vòng (pos.service submit → decide →
// advance), không thêm không bớt:
//   · approval_events: 'submitted' (người soạn) rồi 'approved' (người duyệt) —
//     cùng dạng handler `approval.audit.ts` ghi; lý do nói rõ là GHI HỘ.
//   · đơn: status 'ordered', approved_by / approved_at, ordered_at.
//   · KHÔNG phát thông báo (việc đã xong trên giấy, báo lại là nhiễu) và không
//     đụng danh mục — `po.ordered` không còn side-effect nào (po.catalog.ts).
// Ngày = ngày trên tờ đơn; giấy không ghi giờ nên giờ là giờ quy ước 08:00/08:05,
// nói rõ trong lý do.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const APPROVER = 'ketoan2@hoanggia.de' // Vũ Phương Thảo — người ký duyệt
const ORDERS = [
  { code: 'PO-2026-0083', date: '2026-09-22' }, // Vạn Vi Thành
  { code: 'PO-2026-0084', date: '2026-09-23' }, // Ngũ Kim Thành Nghĩa
  { code: 'PO-2026-0085', date: '2026-09-23' }, // Tường Nguyên
  { code: 'PO-2026-0086', date: '2026-09-23' }, // Tân Phát
  { code: 'PO-2026-0087', date: '2026-09-23' }, // HKD Thiết bị thông minh
]
const vn = (d) => d.split('-').reverse().join('/')

const { data: ap } = await sb
  .from('users')
  .select('id, name')
  .eq('email', APPROVER)
  .single()
if (!ap) throw new Error('không thấy người duyệt')
const { data: pos, error } = await sb
  .from('supply_purchase_orders')
  .select(
    'id, code, status, expected_at, assigned_to, created_by, note, owner:users!supply_purchase_orders_assigned_to_fkey(name)',
  )
  .in(
    'code',
    ORDERS.map((o) => o.code),
  )
if (error) throw error

for (const o of ORDERS) {
  const p = pos.find((x) => x.code === o.code)
  const ok = p?.status === 'draft' && !!p.expected_at
  console.log(
    `${o.code} · ${p?.status} · hẹn ${p?.expected_at ?? '—'} · soạn ${p?.owner?.name} → gửi duyệt ${vn(o.date)} 08:00, ${ap.name} duyệt ${vn(o.date)} 08:00, gửi NCC ${vn(o.date)} 08:05${ok ? '' : '  ⟵ BỎ QUA (không còn nháp / thiếu hẹn giao)'}`,
  )
  if (!APPLY || !ok) continue

  const at = (hm) => `${o.date}T${hm}:00+07:00`
  const reason = `Ký duyệt TRÊN GIẤY ngày ${vn(o.date)} — ghi hộ lên hệ thống ngày 25/09/2026 theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).`
  const { error: ee } = await sb.from('approval_events').insert([
    {
      entity_type: 'po',
      entity_id: p.id,
      entity_code: o.code,
      action: 'submitted',
      actor_id: p.assigned_to ?? p.created_by,
      // Sớm hơn mốc duyệt vài phút để dòng thời gian xếp đúng thứ tự.
      created_at: at('07:55'),
      reason: 'Ghi hộ 25/09/2026 — đơn đã trình ký trên giấy.',
    },
    {
      entity_type: 'po',
      entity_id: p.id,
      entity_code: o.code,
      action: 'approved',
      actor_id: ap.id,
      created_at: at('08:00'),
      reason,
    },
  ])
  if (ee) throw new Error(`${o.code} nhật ký: ${ee.message}`)
  const { error: ue } = await sb
    .from('supply_purchase_orders')
    .update({
      status: 'ordered',
      approved_by: ap.id,
      approved_at: at('08:00'),
      ordered_at: at('08:05'),
      note: `${p.note ?? ''} Đã ký duyệt (${ap.name}) và gửi NCC trên giấy ngày ${vn(o.date)} — trạng thái ghi hộ 25/09/2026.`.trim(),
    })
    .eq('id', p.id)
    .eq('status', 'draft')
  if (ue) throw new Error(`${o.code} cập nhật: ${ue.message}`)
  console.log('   ✓ đã ghi')
}
if (!APPLY) console.log('\n(dò khô — thêm --apply để ghi)')
