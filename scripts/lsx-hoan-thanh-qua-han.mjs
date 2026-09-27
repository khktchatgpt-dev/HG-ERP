// HOÀN THÀNH CÁC LỆNH SẢN XUẤT QUÁ HẠN GIAO — 25/09/2026.
//
//   node scripts/lsx-hoan-thanh-qua-han.mjs            # dò khô
//   node scripts/lsx-hoan-thanh-qua-han.mjs --apply    # ghi
//
// Chủ dự án: "xem các lsx nào quá hạn thì chuyển sang hoàn thành hết". Quá hạn =
// ngày giao (`ship_date`) trước hôm nay, lệnh chưa hoàn thành / chưa huỷ.
//
// Làm ĐÚNG như `lsxService.complete` nhánh ÉP HOÀN THÀNH (override): lệnh chưa có
// công việc SX nào trên hệ thống (thống kê chưa go-live) nên gate chặn, và chỉ
// Ban quản lý được ép kèm lý do. Hệ quả y như app:
//   · lệnh → completed, completed_at = lúc ghi, lý do nối vào note "[hoàn thành] …"
//   · đơn hàng của lệnh → completed + 1 dòng sales_order_changes
//     { type: 'production_completed', lsx_code }
//   · sau đó KHÔNG xuất kho cho lệnh được nữa (stock.service chặn), không ghi
//     sản lượng/giao tổ/gia công; NHẬP hàng theo đơn mua và HOÀN KHO vẫn được.
// Đo lúc chạy: mọi đơn mua còn mở của các lệnh này đều nháp/chờ duyệt (chưa gửi
// NCC) — không có hàng nào đang chờ về qua hệ thống.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const TODAY = '2026-09-25'
const ACTOR = 'it@hoanggia.de' // admin — override chỉ Ban quản lý (admin/manager) làm được
const vn = (d) => d.split('-').reverse().join('/')

const { data: actor } = await sb
  .from('users')
  .select('id, name, role')
  .eq('email', ACTOR)
  .single()
if (!['admin', 'manager'].includes(actor?.role))
  throw new Error('người ép hoàn thành phải là admin/manager')

const { data: lsxs, error } = await sb
  .from('production_orders')
  .select('id, code, status, ship_date, note')
  .lt('ship_date', TODAY)
  .not('status', 'in', '(completed,cancelled)')
  .order('code')
if (error) throw error

for (const l of lsxs) {
  if (
    l.status === 'pending_approval' ||
    l.status === 'rejected' ||
    l.status === 'draft'
  ) {
    console.log(
      `${l.code} · ${l.status} — BỎ QUA: lệnh chưa được duyệt, không hoàn thành được`,
    )
    continue
  }
  const { data: jobs } = await sb
    .from('production_jobs')
    .select('status')
    .eq('production_order_id', l.id)
  const open = (jobs ?? []).filter((j) => j.status !== 'done').length
  const why =
    (jobs ?? []).length === 0
      ? 'chưa có công việc SX nào ghi trên hệ thống'
      : `còn ${open} công việc chưa xác nhận`
  const reason = `Ép hoàn thành 25/09/2026 theo chỉ đạo: quá hạn giao ${vn(l.ship_date)}; ${why} (thống kê sản xuất chưa ghi trên hệ thống).`
  const { data: ords } = await sb
    .from('sales_orders')
    .select('id, code, status')
    .eq('production_order_id', l.id)
  console.log(
    `${l.code} · ${l.status} · giao ${vn(l.ship_date)} · ${why} · đơn hàng ${(ords ?? []).map((o) => `${o.code} (${o.status} → completed)`).join(', ') || '—'}`,
  )
  if (!APPLY) continue

  const { error: ue } = await sb
    .from('production_orders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      note: `${l.note ? `${l.note}\n` : ''}[hoàn thành] ${reason}`,
    })
    .eq('id', l.id)
    .eq('status', l.status)
  if (ue) throw new Error(`${l.code}: ${ue.message}`)
  for (const o of ords ?? []) {
    const { error: oe } = await sb
      .from('sales_orders')
      .update({ status: 'completed' })
      .eq('id', o.id)
    if (oe) throw new Error(`${o.code}: ${oe.message}`)
    const { error: ce } = await sb.from('sales_order_changes').insert({
      order_id: o.id,
      changed_by: actor.id,
      change: { type: 'production_completed', lsx_code: l.code },
      note: reason,
    })
    if (ce) throw new Error(`${o.code} lịch sử: ${ce.message}`)
  }
  console.log('   ✓ đã hoàn thành')
}
if (!APPLY) console.log('\n(dò khô — thêm --apply để ghi)')
