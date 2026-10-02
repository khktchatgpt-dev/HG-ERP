/**
 * (A) TẠO ĐƠN BÁN CHO 5 LỆNH CHƯA CÓ ĐƠN + (B) DUYỆT 4 LỆNH CÒN NHÁP — 02/10/2026.
 * Chủ dự án chốt: "tạo đơn bán cho 3 lệnh chưa có", "2 lệnh chưa có đơn hàng tạo
 * giúp tôi", "các lsx đang là nháp duyệt để chạy luôn vì đang sang giai đoạn sản xuất".
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/don-ban-tu-lenh-va-duyet-lsx-1002.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/don-ban-tu-lenh-va-duyet-lsx-1002.ts --apply   # ghi
 *
 * (A) Đơn dựng NGƯỢC từ dòng lệnh: một đơn cho mỗi NGÀY GIAO của lệnh (đơn không
 *     được trùng SP, mà LAURA 01 có 26 SP rải 11 ngày giao — khớp cách khách đặt
 *     theo từng PO/đợt). SL = Σ dòng lệnh cùng SP cùng ngày; đơn giá = FOB kế
 *     hoạch (plan_price) nếu có, không thì 0; tiền tệ USD. Mã PO khách CHƯA CÓ —
 *     ghi chú trên đơn để Sale bổ sung. Đi qua `ordersService.create` (fx chốt
 *     theo ngày tạo), rồi gắn `production_order_id`. Lệnh đã duyệt → đơn về
 *     `lsx_issued`; lệnh còn nháp → để (B) submit/approve tự chuyển đơn.
 * (B) Lệnh nháp: `submit` bằng người lập (luật chủ sở hữu) rồi `approve` bằng
 *     Giám đốc (dien@) — đúng vòng đời, có vết và thông báo như bấm trên màn.
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

const APPLY = process.argv.includes('--apply')
const dmy = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4)

async function main() {
  const [sales1, sales2, gd] = await Promise.all([
    usersRepo.findByEmail('sales1@hoanggia.de'),
    usersRepo.findByEmail('sales2@hoanggia.de'),
    usersRepo.findByEmail('dien@hoanggia.de'),
  ])
  if (!sales1 || !sales2 || !gd) throw new Error('thiếu tài khoản sales1/sales2/dien')

  // ── (A) ────────────────────────────────────────────────────────────────────
  const TARGETS = [
    { code: '01/26-27 - LAURA', by: sales2, label: 'LAURA 01/26-27' },
    { code: '01/26-27 - JAWOLL', by: sales2, label: 'JAWOLL 01/26-27' },
    { code: '02/26-27 - ROSCO', by: sales1, label: 'ROSCO IBIZA 02/26-27' },
    { code: '01/26-27 - GIGA', by: sales2, label: 'GIGA 01/26-27' },
    { code: '01/26-27 - BLACKIN', by: sales2, label: 'BLACKIN 01/26-27' },
  ]
  let created = 0
  for (const t of TARGETS) {
    const { data: lsx, error } = await db()
      .from('production_orders')
      .select('id, code, status, customer_id, ship_date')
      .eq('code', t.code)
      .single()
    if (error || !lsx) throw new Error(`không thấy lệnh ${t.code}`)
    const { count } = await db()
      .from('sales_orders')
      .select('id', { count: 'exact', head: true })
      .eq('production_order_id', lsx.id)
    if ((count ?? 0) > 0) {
      console.log(`· ${t.code}: đã có ${count} đơn — bỏ qua`)
      continue
    }
    const { data: lines } = await db()
      .from('production_order_lines')
      .select('product_id, qty, ship_date, product:technical_products(code, plan_price)')
      .eq('production_order_id', lsx.id)
      .order('sort_order')
    type L = { product_id: string | null; qty: unknown; ship_date: string | null; product: { code: string; plan_price: unknown } | { code: string; plan_price: unknown }[] | null } // prettier-ignore
    const groups = new Map<string, Map<string, { qty: number; price: number; code: string }>>()
    for (const l of (lines ?? []) as unknown as L[]) {
      if (!l.product_id) continue
      const p = Array.isArray(l.product) ? l.product[0] : l.product
      const k = l.ship_date ?? ''
      const m = groups.get(k) ?? new Map()
      const cur = m.get(l.product_id) ?? { qty: 0, price: Number(p?.plan_price ?? 0), code: p?.code ?? '?' }
      cur.qty += Number(l.qty)
      m.set(l.product_id, cur)
      groups.set(k, m)
    }
    const keys = [...groups.keys()].sort()
    for (const k of keys) {
      const m = groups.get(k)!
      const code = keys.length > 1 ? `${t.label} g.${dmy(k)}` : `${t.label} (tạm)`
      const items = [...m.entries()]
      const total = items.reduce((s, [, v]) => s + v.qty * v.price, 0)
      const zero = items.filter(([, v]) => v.price === 0).map(([, v]) => v.code)
      console.log(
        `${APPLY ? '→' : '·'} ${code.padEnd(30)} ${String(items.length).padStart(2)} dòng · ${items.reduce((s, [, v]) => s + v.qty, 0)} cái · ${total.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} USD${zero.length ? ' · giá 0: ' + zero.join(',') : ''}`,
      )
      if (!APPLY) continue
      const order = await ordersService.create(t.by, {
        code,
        customer_id: lsx.customer_id,
        currency: 'USD',
        due_date: k || lsx.ship_date || null,
        note: `Đơn dựng lại từ lệnh ${lsx.code} ngày 02/10/2026 (lệnh có trước, chưa có đơn bán trong hệ). Đơn giá = FOB kế hoạch của Sale (0 = chưa có); mã PO khách chưa có — Bán hàng bổ sung.`,
        lines: items.map(([product_id, v]) => ({ product_id, qty: v.qty, unit_price: v.price, ship_date: k || null })),
      })
      const patch: Record<string, unknown> = { production_order_id: lsx.id }
      if (lsx.status !== 'draft') patch.status = 'lsx_issued'
      const { error: e2 } = await db().from('sales_orders').update(patch).eq('id', order.id)
      if (e2) throw new Error(e2.message)
      created++
    }
  }

  // ── (B) ────────────────────────────────────────────────────────────────────
  const { data: drafts } = await db()
    .from('production_orders')
    .select('id, code, created_by')
    .eq('status', 'draft')
    .order('code')
  let approved = 0
  for (const d of drafts ?? []) {
    const owner = (d.created_by ? await usersRepo.findById(d.created_by) : null) ?? gd
    console.log(`${APPLY ? '→' : '·'} duyệt ${d.code} (gửi duyệt bởi ${owner.email}, duyệt bởi ${gd.email})`)
    if (!APPLY) continue
    await lsxService.submit(owner, d.id)
    await lsxService.approve(gd, d.id)
    approved++
  }
  console.log(APPLY ? `XONG: tạo ${created} đơn, duyệt ${approved} lệnh.` : 'Dò khô xong. Thêm --apply để ghi.')
}
void main()
