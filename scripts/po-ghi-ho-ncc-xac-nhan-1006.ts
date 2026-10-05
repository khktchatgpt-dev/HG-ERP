/**
 * GHI HỘ "NCC XÁC NHẬN" — 06/10/2026, theo chỉ đạo chủ dự án.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-ghi-ho-ncc-xac-nhan-1006.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-ghi-ho-ncc-xac-nhan-1006.ts --apply   # ghi
 *
 * Ô "NCC chưa xác nhận: 14 · Gửi quá 2 ngày" (Giám sát mua hàng): 14 đơn bấm "Gửi
 * NCC" 02–03/10 mà chưa ai bấm "NCC xác nhận" (4 đơn anh Truyền còn dời hẹn kèm
 * "NCC báo"). Chủ dự án chốt: đơn được xác nhận → sang CHỜ GIAO NHẬN; đơn QUÁ HẠN
 * GIAO giữ nguyên để Cung ứng tự dời hạn.
 *
 * Tập đơn = đúng hàm của ô (`classifyTodo === 'unconfirmed'`) tại lúc chạy —
 * `classifyTodo` xét quá hạn TRƯỚC nên đơn quá hạn tự rơi ra. Ghi qua
 * `posService.confirm` (không chia đợt: giữ hẹn giao + đợt đã có, ghi sổ hẹn giao
 * 'ncc_xac_nhan'), người ghi là Quản trị viên, lý do nói rõ GHI HỘ.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { classifyTodo } from '@/lib/supply-watch'

const APPLY = process.argv.includes('--apply')
const LY_DO =
  'Ghi hộ 06/10/2026 theo chỉ đạo — NCC đã nhận đơn; hẹn giao giữ như trên đơn.'

async function main() {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
  const admin = (await usersRepo.list()).find((u) => u.email === 'admin@hg.com')
  if (!admin) throw new Error('không thấy tài khoản Quản trị viên')
  const { data: pos, error } = await db()
    .from('supply_purchase_orders')
    .select('id, code, status, expected_at, ordered_at, confirmed_at, assigned_to')
    .eq('status', 'ordered')
  if (error) throw new Error(error.message)
  const tap = (pos ?? [])
    .filter((p) => classifyTodo(p as never, today) === 'unconfirmed')
    .sort((a, b) => (a.code < b.code ? -1 : 1))
  const quaHan = (pos ?? []).filter((p) => classifyTodo(p as never, today) === 'overdue')
  console.log(`Hôm nay ${today} · sẽ xác nhận ${tap.length} đơn · đơn "Đã gửi NCC" quá hạn giữ nguyên: ${quaHan.map((p) => p.code).join(', ') || 'không'}`) // prettier-ignore
  for (const p of tap) console.log(`  ${p.code} · gửi ${p.ordered_at?.slice(0, 10)} · hẹn ${p.expected_at ?? '—'}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  let ok = 0
  for (const p of tap) {
    try {
      const r = await posService.confirm(admin, p.id, {
        confirmed_note: LY_DO,
        shipments: [],
      })
      console.log(`  ✓ ${p.code} → ${r.status}`)
      ok++
    } catch (e) {
      console.log(`  ✗ ${p.code}: ${(e as Error).message}`)
    }
  }
  console.log(`Xong: ${ok}/${tap.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
