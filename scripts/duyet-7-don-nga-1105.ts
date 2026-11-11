/**
 * 05/11/2026 — user báo 7 đơn của chị Nga "đã qua sếp duyệt" và "NCC đã xác nhận, chờ nhận
 * hàng", nhưng trên ERP cả 7 là NHÁP (5 đơn chị gửi 03/11 15:42–15:46 rồi tự rút 16:24–16:25,
 * 2 đơn chưa gửi lần nào). User chọn ghi người duyệt là anh Alex. Đi đúng 3 bước của app:
 *   chị Nga gửi duyệt → anh Alex duyệt → chị Nga ghi NCC xác nhận cả đơn (không chia đợt).
 * Mỗi đơn chạy riêng: đơn vướng (thiếu hẹn giao, thiếu hạng mục…) thì báo lý do, đơn khác vẫn đi.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/duyet-7-don-nga-1105.ts [--apply]
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poConfirmSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const CODES = ['PO-2026-0226', 'PO-2026-0233', 'PO-2026-0235', 'PO-2026-0236', 'PO-2026-0237', 'PO-2026-0240', 'PO-2026-0241'] // prettier-ignore
const GHI_CHU =
  'NCC đã xác nhận (Sếp duyệt ngoài ERP; ghi lại trên ERP 05/11/2026 theo yêu cầu)'

async function main() {
  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === 'kehoach1@hoanggia.de')
  const alex = users.find((u) => u.email === 'alex@hoanggia.de')
  if (!nga || !alex) throw new Error('thiếu chị Nga / anh Alex')
  const { data: pos, error } = await db()
    .from('supply_purchase_orders')
    .select(
      'id, code, status, expected_at, production_order_id, project_id, supplier_id, assigned_to, created_by',
    )
    .in('code', CODES)
  if (error) throw new Error(error.message)
  for (const code of CODES) {
    const p = pos?.find((x) => x.code === code)
    if (!p) { console.log(`${code}: KHÔNG THẤY`); continue } // prettier-ignore
    const { count } = await db().from('supply_purchase_order_lines').select('id', { count: 'exact', head: true }).eq('po_id', p.id) // prettier-ignore
    const { data: s } = await db().from('supply_suppliers').select('name, can_order, is_marketplace').eq('id', p.supplier_id).single() // prettier-ignore
    const vuong = [
      !p.expected_at && 'thiếu hẹn giao',
      !p.production_order_id && !p.project_id && 'đơn ngoài lệnh chưa có hạng mục',
      !count && 'không có dòng',
      s && !s.can_order && 'NCC đang khoá đặt hàng',
      s?.is_marketplace && 'NCC là sàn (cần mã đơn sàn)',
    ].filter(Boolean)
    console.log(`${code} · ${p.status} · ${s?.name} · hẹn ${p.expected_at?.slice(0, 10) ?? '—'} · ${count} dòng${vuong.length ? ` · VƯỚNG: ${vuong.join(', ')}` : ''}`) // prettier-ignore
    if (!APPLY) continue
    try {
      let st = p.status
      if (st === 'draft') st = (await posService.submit(nga, p.id)).status
      if (st === 'pending_approval')
        st = (await posService.decide(alex, p.id, 'approve')).status
      if (st === 'approved')
        st = (await posService.confirm(nga, p.id, poConfirmSchema.parse({ confirmed_note: GHI_CHU, shipments: [] }))).status // prettier-ignore
      console.log(`  ✓ ${code} → ${st}`)
    } catch (e) {
      console.log(`  ✗ ${code}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!APPLY) console.log('Dò khô — thêm --apply để ghi.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
