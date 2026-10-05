/**
 * BÀN TRÒN COFFEE IBIZA (TB0286HG-IR, mã khách 2723876-B) — 05/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/plan-cost-ibiza-ban-tron-1005.ts --apply
 *
 * File `Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx` › "Updated price
 * 02.10": dòng Sofa (6) và dòng Table (7) GỘP Ô ở cột K–Q (K6:K7 = 1.864, M6:M7 = 192,68 ô
 * xanh) — file báo một giá cho sofa + bàn. Chủ dự án chốt "lấy cột giá HG có tô màu xanh"
 * cho bàn → TB0286 = 192,68 như sofa. LƯU Ý: tổng giá trị lệnh theo giá KH sẽ cao hơn đơn
 * khách 1.864 × 192,68 vì file chỉ đếm con số này một lần; sửa lại nếu Sale tách giá.
 * Ghi giá KH (chỉ FOB) rồi điền dòng đơn bán còn giá 0 của mã này qua bulkPrice (có vết).
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'

const APPLY = process.argv.includes('--apply')
const PRICE = 192.68
const SRC =
  'Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx › Updated price 02.10, ô M6:M7 "HG price 02.10" (ô xanh) GỘP với dòng Sofa — chủ dự án chốt lấy cùng số 192,68 cho bàn (05/10/2026)'

async function main() {
  const { data: a } = await db().from('users').select('email').eq('role', 'admin').eq('is_active', true).limit(1).single() // prettier-ignore
  const admin = await usersRepo.findByEmail(a!.email)
  const hang = await usersRepo.findByEmail('sales1@hoanggia.de')
  if (!admin || !hang) throw new Error('thiếu admin / sales1')

  const { data: p } = await db()
    .from('technical_products')
    .select('id, code, plan_price')
    .eq('code', 'TB0286HG-IR')
    .single()
  if (!p) throw new Error('không thấy TB0286HG-IR')
  console.log(`TB0286HG-IR plan_price hiện ${p.plan_price} → ${PRICE} USD`)

  const board = await ordersService.pricingBoard(admin)
  const lines = board.lines.filter(
    (l) => l.product_code === 'TB0286HG-IR' && l.unit_price <= 0,
  )
  for (const l of lines)
    console.log(`  dòng đơn ${l.order_code} · SL ${l.qty} · ${l.currency} → ${PRICE}`)
  if (!APPLY) return console.log('Dò khô xong. Thêm --apply để ghi.')

  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const { error } = await db()
    .from('technical_products')
    .update({
      plan_direct_cost: null,
      plan_overhead: null,
      plan_profit: null,
      plan_price: PRICE,
      plan_currency: 'USD',
      plan_fx_rate: null,
      plan_breakdown: [{ label: 'IBIZA Table (coffee) · gộp ô với Sofa', amount: PRICE }],
      plan_source: SRC,
      plan_at: today,
      plan_by: hang.id,
    })
    .eq('id', p.id)
    .is('plan_price', null)
  if (error) throw error
  const usd = lines.filter((l) => l.currency === 'USD')
  const r = usd.length
    ? await ordersService.bulkPrice(admin, {
        items: usd.map((l) => ({ line_id: l.line_id, unit_price: PRICE })),
        note: 'Điền từ giá FOB kế hoạch (bàn tròn IBIZA gộp ô với sofa, 05/10/2026)',
      })
    : { updated: 0, orders: 0 }
  console.log(`ĐÃ GHI giá KH + ${r.updated} dòng đơn.`)
}
void main()
