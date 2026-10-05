/**
 * HẠN GIAO LỆNH + ĐƠN BÁN IBIZA = CHUYẾN CUỐI 17/03/2027 — 05/10/2026 (user: "cứ cho hạn cuối đi").
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-ibiza-han-cuoi-1005.ts --apply
 *
 * `Shipping Order Dates for Ibiza.xlsx` (Hằng, 04/08): 92 chuyến 12/10/2026 → 17/03/2027.
 * Chủ dự án chọn KHÔNG chia đợt, lấy hạn cuối: lệnh 02/26-27 ROSCO ship_date + container
 * 92 x 40'HC (qua lsxService.updateHeader), đơn "ROSCO IBIZA 02/26-27 (tạm)" due_date
 * (qua ordersService.update, chỉ header). Trước đó lệnh không có ship_date nên màn quá
 * hạn không xét được.
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { ordersService } from '@/modules/dept/sales/orders.service'

const APPLY = process.argv.includes('--apply')
const DUE = '2027-03-17'
async function main() {
  const { data: a } = await db().from('users').select('email').eq('role', 'admin').eq('is_active', true).limit(1).single() // prettier-ignore
  const admin = await usersRepo.findByEmail(a!.email)
  if (!admin) throw new Error('không có admin')
  const { data: lsx } = await db().from('production_orders').select('id, code, ship_date, container_summary').eq('code', '02/26-27 - ROSCO').single() // prettier-ignore
  const { data: so } = await db().from('sales_orders').select('id, code, due_date').eq('production_order_id', lsx!.id).single() // prettier-ignore
  console.log(`lệnh ${lsx!.code}: ship_date ${lsx!.ship_date} → ${DUE}, container ${lsx!.container_summary} → 92 x 40'HC`)
  console.log(`đơn ${so!.code}: due_date ${so!.due_date} → ${DUE}`)
  if (!APPLY) return console.log('Dò khô xong. Thêm --apply để ghi.')
  await lsxService.updateHeader(admin, lsx!.id, { ship_date: DUE, container_summary: "92 x 40'HC" })
  await ordersService.update(admin, so!.id, { due_date: DUE, change_note: 'Hạn giao = chuyến cuối trong Shipping Order Dates for Ibiza (17/03/2027); 92 chuyến 12/10/2026 → 17/03/2027' })
  console.log('ĐÃ GHI.')
}
void main()
