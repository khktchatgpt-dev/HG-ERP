/**
 * NẠP GIÁ KẾ HOẠCH SALE ĐIỀN + CẬP NHẬT IBIZA 02/10 — 05/10/2026.
 *
 *   node scripts/plan-cost-nap-sale-dien-1005.mjs           # dò khô
 *   node scripts/plan-cost-nap-sale-dien-1005.mjs --apply   # ghi technical_products.plan_*
 *
 * Hai nguồn Sale gửi lại 05/10 (user: "xem giá để ý cột màu xanh"):
 *   (A) `SP-chua-gia-dang-chay-lenh-0510 (1).xlsx` — danh sách 9 mã chưa giá, Sale điền cột
 *       "The price" cho 8 mã GIGA Steve (N767P389536–539 K/N). Chỉ FOB, USD, mã mới chưa
 *       có plan_price → hàng rào `.is('plan_price', null)`.
 *   (B) `Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx` › sheet
 *       "Updated price 02.10", cột M "HG price 02.10" TÔ XANH (FF92D050) = giá mới thay
 *       cột L "HG price 8/4" đã nạp 02/10. Giá ghế vẫn là GIÁ/THÙNG 2 GHẾ (K = số thùng;
 *       60 set/cont = 60 bàn + 120 thùng ghế) nên chia 2 như script 02/10. Bàn tròn coffee
 *       2723876-B vẫn TRỐNG cả hai cột → không nạp. Ghi ĐÈ 5 mã, giá cũ lưu trong
 *       plan_source để còn vết.
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

const SRC_GIGA =
  'Sale điền cột "The price" trong SP-chua-gia-dang-chay-lenh-0510.xlsx (05/10/2026) — giá kế hoạch đơn, chưa có bảng tính giá thành'
const SRC_IBIZA =
  'Cập nhập giá 260804_HG_ENC_Ibiza Order 2026 - 02.10.2026.xlsx › Updated price 02.10, cột M "HG price 02.10" (ô xanh)'

/* prettier-ignore */
const rows = [
  // (A) GIGA Steve — mới, chỉ FOB
  { code: 'BN0230HG-AL', price: 89.75, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank II khung nhôm (20x80) · N767P389538K' },
  { code: 'BN0231HG-AL', price: 135, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank III khung nhôm (20x80) · N767P389539K' },
  { code: 'BN0232HG-AL', price: 96.34, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank II khung nhôm (20x80) · N767P389538N' },
  { code: 'BN0233HG-AL', price: 144.04, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank III khung nhôm (20x80) · N767P389539N' },
  { code: 'CH0289HG-AL', price: 57.83, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank I khung nhôm (20x80) · N767P389537K' },
  { code: 'CH0290HG-AL', price: 62.41, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Ghế bank I khung nhôm (20x80) · N767P389537N' },
  { code: 'TB0298HG-AL', price: 44.14, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Bàn khung nhôm (25x50) · N767P389536K' },
  { code: 'TB0299HG-AL', price: 47.41, by: 'PHUONG', mode: 'new', src: SRC_GIGA, name: 'Bàn khung nhôm (25x50) · N767P389536N' },
  // (B) IBIZA — ghi đè giá 8/4 bằng giá 02.10
  { code: 'CH0254HG-IR', price: 45.13, old: 44.88, by: 'HANG', mode: 'update', src: `${SRC_IBIZA} · MNSC31DB Swivel Dining Chair 90,26 USD/thùng 2 ghế (8/4: 89,76 → 44,88/ghế)`, name: 'Swivel Dining Chair · 2722875' },
  { code: 'TB0287HG-IR', price: 148.15, old: 146.3, by: 'HANG', mode: 'update', src: `${SRC_IBIZA} · MNTBLEDS Dining Table (8/4: 146,30)`, name: 'Stone Dining Table · 2722239' },
  { code: 'BN0229HG-IR', price: 61.01, old: 60.76, by: 'HANG', mode: 'update', src: `${SRC_IBIZA} · MNIBZ4P Armchair 122,02 USD/thùng 2 ghế (8/4: 121,52 → 60,76/ghế)`, name: 'IBIZA Băng 1 · 2723875' },
  { code: 'BN0222HG-IR', price: 192.68, old: 192.18, by: 'HANG', mode: 'update', src: `${SRC_IBIZA} · MNIBZ4P Sofa (8/4: 192,18)`, name: 'Sofa · 2723876-A' },
  { code: 'TB0284HG-IR', price: 65.75, old: 64.06, by: 'HANG', mode: 'update', src: `${SRC_IBIZA} · Side table w/ ice bucket bản sửa thêm lỗ dù, SL đặt 2.040 (8/4 nạp nhầm bản hiện tại 64,06)`, name: 'SIDE TABLE w/ Ice bucket · 2723874' },
]

const { data: users, error: ue } = await db
  .from('users')
  .select('id, email')
  .in('email', ['sales1@hoanggia.de', 'sales2@hoanggia.de'])
if (ue) throw ue
const BY = {
  HANG: users.find((u) => u.email === 'sales1@hoanggia.de')?.id,
  PHUONG: users.find((u) => u.email === 'sales2@hoanggia.de')?.id,
}
if (!BY.HANG || !BY.PHUONG) throw new Error('thiếu tài khoản sales1/sales2')

const { data: prods, error } = await db
  .from('technical_products')
  .select('id, code, plan_price, plan_currency')
  .in(
    'code',
    rows.map((r) => r.code),
  )
if (error) throw error
let bad = 0
for (const r of rows) {
  const p = prods.find((x) => x.code === r.code)
  const ok =
    p &&
    r.price > 0 &&
    (r.mode === 'new'
      ? p.plan_price == null
      : Math.abs(Number(p.plan_price) - r.old) < 0.005 && p.plan_currency === 'USD')
  if (!ok) bad++
  console.log(
    `${ok ? '✓' : '✗'} ${r.code.padEnd(13)} ${r.mode === 'new' ? 'MỚI ' : 'SỬA '} ${String(r.price).padStart(8)} USD${r.mode === 'update' ? ` (cũ ${r.old})` : ''} ${r.name.slice(0, 46)}${!p ? ' · KHÔNG THẤY SP' : r.mode === 'new' && p.plan_price != null ? ` · ĐÃ CÓ GIÁ ${p.plan_price}` : r.mode === 'update' && Math.abs(Number(p.plan_price) - r.old) >= 0.005 ? ` · DB ĐANG ${p.plan_price} ≠ ${r.old}` : ''}`,
  )
}
console.log(
  `${rows.length} SP · mới ${rows.filter((r) => r.mode === 'new').length} · sửa ${rows.filter((r) => r.mode === 'update').length} · lỗi ${bad}`,
)
if (bad) {
  console.log('Có dòng lỗi — không ghi.')
  process.exit(1)
}
if (!APPLY) {
  console.log('Dò khô xong. Thêm --apply để ghi.')
  process.exit(0)
}
let n = 0
for (const r of rows) {
  const p = prods.find((x) => x.code === r.code)
  let q = db
    .from('technical_products')
    .update({
      plan_direct_cost: null,
      plan_overhead: null,
      plan_profit: null,
      plan_price: r.price,
      plan_currency: 'USD',
      plan_fx_rate: null,
      plan_breakdown: [{ label: r.name, amount: r.price }],
      plan_source: r.src,
      plan_at: TODAY,
      plan_by: BY[r.by],
    })
    .eq('id', p.id)
  if (r.mode === 'new') q = q.is('plan_price', null)
  else q = q.eq('plan_price', r.old)
  const { error: e } = await q
  if (e) throw e
  n++
}
console.log(`ĐÃ GHI ${n} SP.`)
