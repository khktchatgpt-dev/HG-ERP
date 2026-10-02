/**
 * NẠP GIÁ FOB KẾ HOẠCH CHO 5 MÃ IBIZA (lệnh 02/26-27 - ROSCO) — 02/10/2026.
 *
 *   node scripts/plan-cost-nap-ibiza-1002.mjs           # dò khô
 *   node scripts/plan-cost-nap-ibiza-1002.mjs --apply   # ghi
 *
 * Nguồn: "IBIZA ORDER PLAN_92x40'HC_HG 04.08.2026.xlsx" (minhhangmx, Drive
 * 1Gd4m8dFaeryt0QNUVUKm8-VrplM8f1x5) — cột "HG price". Là GIÁ KẾ HOẠCH trên bản
 * kế hoạch đơn, chưa phải giá đơn đã ký; không có bảng tính giá thành → CHỈ FOB.
 * Bàn tròn 2723876-B không có giá riêng trong file → không nạp.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})
const APPLY = process.argv.includes('--apply')
const TODAY = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const HANG = '77b5c16b-56b8-46f2-b90d-9b96830624e3'
const SRC =
  "IBIZA ORDER PLAN_92x40'HC_HG 04.08.2026.xlsx — cột HG price (Drive 1Gd4m8dFaeryt0QNUVUKm8-VrplM8f1x5); giá kế hoạch đơn, chưa có bảng tính giá thành"

/** Khoá theo MÃ KHÁCH (customer_item_code) vì mã HG của IBIZA phần lớn chính là mã khách. */
const rows = [
  {
    cust: '2722875',
    price: 44.88,
    note: 'Ibiza Swivel Dining Chair MNSC31DB — 89,76 USD/thùng 2 ghế',
  },
  { cust: '2722239', price: 146.3, note: 'Ibiza Dining Table MNTBLEDS' },
  {
    cust: '2723875',
    price: 60.76,
    note: 'Armchair bộ 4 món MNIBZ4P — 121,52 USD/thùng 2 ghế; SL lệnh 5.628 so kế hoạch 2.500',
  },
  { cust: '2723876-A', price: 192.18, note: 'Sofa bộ 4 món MNIBZ4P' },
  {
    cust: '2723874',
    price: 64.06,
    note: 'Side table w/ ice bucket — bản hiện tại 64,06; bản sửa thêm lỗ dù 65,75',
  },
]

const { data: prods, error } = await db
  .from('technical_products')
  .select('id, code, name, customer_item_code, plan_price')
  .in(
    'customer_item_code',
    rows.map((r) => r.cust),
  )
if (error) throw error
let bad = 0
for (const r of rows) {
  const hits = prods.filter((p) => p.customer_item_code === r.cust)
  if (hits.length !== 1) bad++
  console.log(
    `${hits.length === 1 ? '✓' : '✗ ' + hits.length + ' SP'} ${r.cust.padEnd(10)} FOB ${String(r.price).padStart(7)}  ${hits.map((p) => `${p.code} · ${p.name}${p.plan_price != null ? ` [đang có ${p.plan_price}]` : ''}`).join(' | ')}`,
  )
}
if (bad) process.exit(1)
if (!APPLY) {
  console.log('Dò khô xong. Thêm --apply để ghi.')
  process.exit(0)
}
for (const r of rows) {
  const p = prods.find((x) => x.customer_item_code === r.cust)
  const { error: e } = await db
    .from('technical_products')
    .update({
      plan_direct_cost: null,
      plan_overhead: null,
      plan_profit: null,
      plan_price: r.price,
      plan_currency: 'USD',
      plan_fx_rate: null,
      plan_breakdown: [{ label: r.note, amount: r.price }],
      plan_source: SRC,
      plan_at: TODAY,
      plan_by: HANG,
    })
    .eq('id', p.id)
  if (e) throw e
}
console.log(`ĐÃ GHI ${rows.length} dòng.`)
