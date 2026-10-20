/**
 * SỬA LỆNH 02/26-27 ROSCO (IBIZA) VỀ SỐ ĐƠN KHÁCH 02/10 — 05/10/2026 (user: "sửa lệnh về số đơn 02/10 đi").
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-ibiza-sua-so-luong-1005.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/lsx-ibiza-sua-so-luong-1005.ts --apply   # ghi
 *
 * Nguồn: `Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx` › "Updated price
 * 02.10", cột K ORDERED QTY (ghế 2 cái/thùng → K là số THÙNG: 60 set/cont = 60 bàn + 120
 * thùng ghế xoay; sofa + bàn tròn gộp ô K6:K7). Lệnh bản 1 (15/09, sheet "Ver 2" 03/09)
 * đang dư 36 bộ ăn + 86 bộ sofa so với đơn 02/10. Đi qua `lsxLinesService.save` để thành
 * bản chỉnh sửa 2 (đánh dấu dòng đổi, phát `lsx.revised`), rồi `ordersService.update`
 * sửa 6 dòng đơn bán "ROSCO IBIZA 02/26-27 (tạm)" theo (giữ đơn giá). Lệnh không có
 * created_by nên chạy bằng admin (luật của-ai-người-đó-sửa).
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { ordersService } from '@/modules/dept/sales/orders.service'

const APPLY = process.argv.includes('--apply')
const NEW: Record<string, number> = {
  '2722875': 8816, // Swivel chair: 4.408 thùng × 2
  '2722239': 2204, // Dining table
  '2723875': 5456, // Armchair: 2.728 thùng × 2
  '2723876-A': 1864, // Sofa
  '2723876-B': 1864, // Coffee table (gộp ô với sofa)
  '2723874': 2040, // Side table bản sửa lỗ dù
}
const NOTE =
  'Bản 2: về đúng ORDERED QTY file khách "HG_ENC_Ibiza Order 2026 - 02.10.2026" (ghế = số thùng × 2). Bản 1 dư 36 bộ ăn + 86 bộ sofa.'

async function main() {
  const { data: a } = await db().from('users').select('email').eq('role', 'admin').eq('is_active', true).limit(1).single() // prettier-ignore
  const admin = await usersRepo.findByEmail(a!.email)
  if (!admin) throw new Error('không có admin')
  const { data: lsx } = await db().from('production_orders').select('id, code, revision').eq('code', '02/26-27 - ROSCO').single() // prettier-ignore
  if (!lsx) throw new Error('không thấy lệnh')

  const sheet = await lsxLinesService.sheet(admin, lsx.id)
  let changed = 0
  const groups = sheet.groups.map((g) => ({
    id: g.id,
    sales_order_id: g.sales_order_id,
    title: g.title,
    buyer_name: g.buyer_name,
    po_no: g.po_no,
    ship_date: g.ship_date,
    ship_label: g.ship_label,
    note: g.note,
    sort_order: g.sort_order,
    lines: g.lines.map((l) => {
      const key = l.customer_item_code ?? ''
      const qty = NEW[key]
      if (qty == null) throw new Error(`dòng ${l.product_code} (${key}) không có số mới`)
      if (qty !== Number(l.qty)) changed++
      console.log(
        `  lệnh ${String(l.product_code).padEnd(12)} ${key.padEnd(10)} ${String(l.qty).padStart(5)} → ${qty}`,
      )
      return {
        id: l.id,
        product_id: l.product_id,
        sales_order_line_id: l.sales_order_line_id,
        product_code: l.product_code,
        customer_item_code: l.customer_item_code,
        name_foreign: l.name_foreign,
        name_vi: l.name_vi,
        name_customs: l.name_customs,
        barcode: l.barcode,
        unit: l.unit,
        qty,
        packing: l.packing,
        cbm: l.cbm,
        ship_date: l.ship_date,
        ship_label: l.ship_label,
        specs: l.specs,
        checks: l.checks,
        extras: l.extras,
        note: l.note,
        important_note: l.important_note,
        image_file_id: l.image_file_id,
        sort_order: l.sort_order,
      }
    }),
  }))
  console.log(
    `lệnh ${lsx.code} bản ${lsx.revision} → ${lsx.revision + 1}: ${changed} dòng đổi`,
  )

  const { data: so } = await db().from('sales_orders').select('id, code').eq('production_order_id', lsx.id) // prettier-ignore
  const orders = so ?? []
  const orderLines: { orderId: string; code: string; lines: { product_id: string; qty: number; unit_price: number; ship_date: string | null; note: string | null }[] }[] = [] // prettier-ignore
  for (const o of orders) {
    const { data: ls } = await db().from('sales_order_lines').select('product_id, qty, unit_price, ship_date, note, product:technical_products(customer_item_code, code, plan_price, plan_currency)').eq('order_id', o.id) // prettier-ignore
    const lines = (ls ?? []).map((l) => {
      const p = Array.isArray(l.product) ? l.product[0] : l.product
      const qty = NEW[p?.customer_item_code ?? '']
      if (qty == null) throw new Error(`dòng đơn ${p?.code} không có số mới`)
      console.log(
        `  đơn ${o.code} ${String(p?.code).padEnd(12)} ${String(l.qty).padStart(5)} → ${qty} · giá ${l.unit_price} → KH ${p?.plan_price}`,
      )
      return {
        product_id: l.product_id,
        qty,
        unit_price:
          p?.plan_currency === 'USD' && p?.plan_price != null
            ? Number(p.plan_price)
            : Number(l.unit_price),
        ship_date: l.ship_date,
        note: l.note,
      }
    })
    orderLines.push({ orderId: o.id, code: o.code, lines })
  }
  if (!APPLY) return console.log('Dò khô xong. Thêm --apply để ghi.')

  await lsxLinesService.save(admin, lsx.id, { groups, revision_note: NOTE })
  for (const o of orderLines) {
    await ordersService.update(admin, o.orderId, { lines: o.lines, change_note: NOTE })
  }
  console.log(
    `ĐÃ GHI: lệnh bản ${lsx.revision + 1} (${changed} dòng) + ${orderLines.length} đơn bán.`,
  )
}
void main()
