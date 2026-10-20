/**
 * TÁCH GIÁ BỘ SOFA + BÀN TRÒN IBIZA THEO TỶ LỆ — 05/10/2026 (user: "chia theo tỷ lệ đi").
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/plan-cost-ibiza-tach-bo-1005.ts --apply
 *
 * File đơn khách gộp ô sofa 2723876-A + bàn tròn 2723876-B = 192,68 USD/bộ (ô xanh
 * "HG price 02.10"); lệnh 02/26-27 ROSCO có cả hai mã cùng 1.950 cái = 1.950 bộ. Script
 * trước đã ghi 192,68 cho CẢ HAI mã → bộ bị tính hai lần (+375.726 USD). Chủ dự án chốt
 * chia theo tỷ lệ sheet "Original price" của chính file (sofa 186 · bàn 63):
 *   sofa  BN0222 = 192,68 × 186/249 = 143,93
 *   bàn   TB0286 = 192,68 ×  63/249 =  48,75   (cộng lại đúng 192,68)
 * Ghi giá KH hai mã + điền lại hai dòng đơn bán ROSCO IBIZA 02/26-27 (tạm) qua bulkPrice.
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'

const APPLY = process.argv.includes('--apply')
const SET = 192.68
const SRC =
  'Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx › Updated price 02.10 ô M6:M7 "HG price 02.10" = 192,68/bộ sofa + bàn tròn, TÁCH theo tỷ lệ sheet Original price (sofa 186 · bàn 63) — chủ dự án chốt 05/10/2026'
const rows = [
  {
    code: 'BN0222HG-IR',
    old: 192.68,
    price: 143.93,
    label: 'Sofa IBIZA 2723876-A — 192,68 × 186/249',
  },
  {
    code: 'TB0286HG-IR',
    old: 192.68,
    price: 48.75,
    label: 'Bàn tròn coffee IBIZA 2723876-B — 192,68 × 63/249',
  },
]
if (Math.abs(rows[0].price + rows[1].price - SET) > 0.005)
  throw new Error('tổng tách ≠ 192,68')

async function main() {
  const { data: a } = await db().from('users').select('email').eq('role', 'admin').eq('is_active', true).limit(1).single() // prettier-ignore
  const admin = await usersRepo.findByEmail(a!.email)
  const hang = await usersRepo.findByEmail('sales1@hoanggia.de')
  if (!admin || !hang) throw new Error('thiếu admin / sales1')
  const { data: prods } = await db()
    .from('technical_products')
    .select('id, code, plan_price')
    .in(
      'code',
      rows.map((r) => r.code),
    )
  for (const r of rows) {
    const p = prods?.find((x) => x.code === r.code)
    if (!p || Number(p.plan_price) !== r.old)
      throw new Error(`${r.code}: DB đang ${p?.plan_price}, không phải ${r.old}`)
    console.log(`${r.code} ${r.old} → ${r.price}`)
  }
  const board = await ordersService.pricingBoard(admin)
  const lines = board.lines.filter(
    (l) => rows.some((r) => r.code === l.product_code) && l.currency === 'USD',
  )
  for (const l of lines)
    console.log(
      `  dòng ${l.order_code} · ${l.product_code} · SL ${l.qty} · ${l.unit_price} → ${rows.find((r) => r.code === l.product_code)!.price}`,
    )
  if (!APPLY) return console.log('Dò khô xong. Thêm --apply để ghi.')

  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  for (const r of rows) {
    const p = prods!.find((x) => x.code === r.code)!
    const { error } = await db()
      .from('technical_products')
      .update({
        plan_price: r.price,
        plan_breakdown: [{ label: r.label, amount: r.price }],
        plan_source: SRC,
        plan_at: today,
        plan_by: hang.id,
      })
      .eq('id', p.id)
      .eq('plan_price', r.old)
    if (error) throw error
  }
  const res = await ordersService.bulkPrice(admin, {
    items: lines.map((l) => ({
      line_id: l.line_id,
      unit_price: rows.find((r) => r.code === l.product_code)!.price,
    })),
    note: 'Tách giá bộ sofa + bàn tròn IBIZA 192,68 theo tỷ lệ 186:63 (05/10/2026)',
  })
  console.log(`ĐÃ GHI 2 giá KH + ${res.updated} dòng đơn.`)
}
void main()
