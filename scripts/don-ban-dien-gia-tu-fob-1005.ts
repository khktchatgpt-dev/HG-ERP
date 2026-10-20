/**
 * ĐIỀN ĐƠN GIÁ DÒNG ĐƠN BÁN TỪ GIÁ FOB KẾ HOẠCH — 05/10/2026 (user: "nạp").
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/don-ban-dien-gia-tu-fob-1005.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/don-ban-dien-gia-tu-fob-1005.ts --apply   # ghi
 *
 * Làm đúng việc nút "Lấy FOB kế hoạch" trên /sales/orders/gia rồi Lưu: dòng đơn còn
 * giá 0, SP đã có plan_price cùng tiền tệ với đơn → unit_price = plan_price. Đi qua
 * `ordersService.pricingBoard` + `bulkPrice` để giữ nguyên luật (đơn đã giao/huỷ bất
 * biến, vết `sales_order_changes` type price_fill). Chạy bằng tài khoản admin vì dòng
 * thuộc nhiều người lập (admin qua canMutateOwned). Dòng lệch tiền tệ hoặc SP chưa
 * có giá để nguyên — in ra để biết còn gì.
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'

const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: a } = await db()
    .from('users')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .single()
  const admin = await usersRepo.findByEmail(a!.email)
  if (!admin) throw new Error('không có admin')

  const board = await ordersService.pricingBoard(admin)
  const fill = board.lines.filter(
    (l) =>
      l.editable &&
      l.unit_price <= 0 &&
      l.plan_price != null &&
      l.plan_currency === l.currency,
  )
  const left = board.lines.filter((l) => l.unit_price <= 0 && !fill.includes(l))

  const byOrder = new Map<string, { n: number; sum: number; cur: string; cust: string }>()
  for (const l of fill) {
    const e = byOrder.get(l.order_code) ?? {
      n: 0,
      sum: 0,
      cur: l.currency,
      cust: l.customer_name,
    }
    e.n++
    e.sum += l.qty * l.plan_price!
    byOrder.set(l.order_code, e)
  }
  console.log(
    `Dòng giá 0: ${board.stats.unpriced} · điền được từ FOB KH: ${fill.length} · còn lại: ${left.length}`,
  )
  for (const [code, e] of [...byOrder].sort()) {
    console.log(
      `  ${code.padEnd(28)} ${String(e.cust).slice(0, 22).padEnd(22)} ${String(e.n).padStart(3)} dòng  +${e.sum.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${e.cur}`,
    )
  }
  if (left.length) {
    console.log('\nCÒN GIÁ 0 (không điền được):')
    const why = (l: (typeof left)[number]) =>
      l.plan_price == null
        ? 'SP chưa có giá KH'
        : l.plan_currency !== l.currency
          ? `lệch tiền tệ ${l.plan_currency}≠${l.currency}`
          : 'không sửa được'
    for (const l of left)
      console.log(
        `  ${l.order_code.padEnd(28)} ${l.product_code.padEnd(13)} ${String(l.qty).padStart(6)}  ${why(l)}`,
      )
  }
  if (!APPLY) {
    console.log('\nDò khô xong. Thêm --apply để ghi.')
    return
  }
  const r = await ordersService.bulkPrice(admin, {
    items: fill.map((l) => ({ line_id: l.line_id, unit_price: l.plan_price! })),
    note: 'Điền từ giá FOB kế hoạch (script 05/10/2026, theo yêu cầu chủ dự án) — Sale soát lại nếu giá đơn đã thương lượng khác',
  })
  console.log(`\nĐÃ GHI ${r.updated} dòng trên ${r.orders} đơn.`)
}
void main()
