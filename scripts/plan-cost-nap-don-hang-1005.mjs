/**
 * NẠP GIÁ KẾ HOẠCH TỪ FILE ĐƠN HÀNG KHÁCH — 10 SP đang chạy lệnh, 05/10/2026.
 *
 *   node scripts/plan-cost-nap-don-hang-1005.mjs           # dò khô
 *   node scripts/plan-cost-nap-don-hang-1005.mjs --apply   # ghi technical_products.plan_*
 *
 * Sau hai đợt nạp từ sổ báo giá (03/10) còn 19 SP đang chạy lệnh chưa có giá. Chủ dự án:
 * "xem các file đơn hàng xem có không" → "cập nhật lại phần nào chưa có". Nguồn chính là sổ
 * `TONG HOP DON HANG CON LAI 2026-2027.xlsx` của Kế toán (Diên) trên Drive — mỗi khách một
 * sheet gồm PI/PO khách + lệnh có cột ĐƠN GIÁ; giá lấy là GIÁ ĐƠN KHÁCH ĐÃ KÝ (cột HG PRICE,
 * không lấy cột ROSCO PRICE cộng phí — cùng cách nạp IBIZA 02/10). Sổ chi phí của Sale có
 * Chi phí chung + Lợi nhuận thì nạp ĐỦ 4 SỐ: trực tiếp = Total sổ − chung − lợi nhuận, lợi
 * nhuận TÍNH LẠI theo giá đơn (giá đơn ≠ Total sổ: BLACKIN 94,50 vs 94,71; Hali 87/116 vs
 * báo giá 82/108). Aruba chỉ có dòng lợi nhuận, không có chi phí chung → CHỈ FOB.
 * Chỉ điền SP CHƯA có plan_price. 9 SP còn lại (IBIZA bàn tròn nằm trong bộ, 8 mã GIGA
 * Steve) không có giá trong đơn — danh sách gửi Sale, không nạp.
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

const TONG_HOP =
  'TONG HOP DON HANG CON LAI 2026-2027.xlsx (Kế toán, Drive 13_LjmPpJqwc_nXp8euKcnQtS1ySHB6pF)'
const ARUBA = `${TONG_HOP} › sheet ROSCO 03 ARUBA — PI PT-159-30…33 ngày 28/08/2026, cột HG PRICE (cột ROSCO PRICE +5% không dùng) · giá thành: quotation 10 Aruba-tinh gia.xlsx (Hằng, Drive 1k9I7U2Tv7bu5vW9YLNLERmgDpSLmUmRD) chỉ có lợi nhuận, không có chi phí chung`
const BLACKIN = `${TONG_HOP} › sheet BLACKIN — PO BLK260328 ngày 13/08/2026 · giá thành: Copy of BÁO GIÁ BLACKIN 2026.xlsx (Phương, Drive 1VwFDfOnCK9_VsOyWyMuZnn9mLWQujc5Z), lợi nhuận tính lại theo giá đơn`
const LAURA = `${TONG_HOP} › sheet LAURA — lệnh 01/26-27, PO 31032193253/254/256`
const HALI = `giá thành: Ban Hali.xlsx (Phương, Drive 1ghY3WS-9e6ZiUERA3E9wKrOrO3rdDd02), lợi nhuận tính lại theo giá đơn`

/* prettier-ignore */
const rows = [
  { code: 'TB0295HG-AL', kind: 'fob', price: 41.98, by: 'HANG', src: `${ARUBA} · 490TC70`, name: 'Aruba 70cm Bistro Table' },
  { code: 'TB0296HG-AL', kind: 'fob', price: 85.92, by: 'HANG', src: `${ARUBA} · 490TC120`, name: 'Aruba 120cm Round Dining Table' },
  { code: 'TB0297HG-AL', kind: 'fob', price: 107.05, by: 'HANG', src: `${ARUBA} · 490TC140`, name: 'Aruba 140cm Round Dining Table' },
  { code: 'ST0226HG-AL', kind: 'fob', price: 599.38, by: 'HANG', src: `${ARUBA} · 490COHL (cả bộ: 2 băng + góc + 2 đôn + bàn)`, name: 'Aruba Corner Set' },
  { code: 'OT0213HG-AL', kind: 'fob', price: 135.09, by: 'HANG', src: `${ARUBA} · 490CB`, name: 'Aruba Cushion Box' },
  // BLACKIN: sổ Total 94,714 = tt 76,972 + chung 11,546 + ln 6,196; đơn 94,50 → ln 5,98
  { code: 'TB0300HG-IR', kind: 'full', direct: 76.97, overhead: 11.55, profit: 5.98, price: 94.5, by: 'PHUONG', src: `${BLACKIN} · BT-HG01 (352 cái)`, name: 'Bàn CNKG khung sắt - gỗ keo non FSC' },
  // sổ Total 17,327 = tt 13,127 + chung 2,625 + ln 1,575; đơn 17,00 → ln 1,24
  { code: 'CH0291HG-IR', kind: 'full', direct: 13.13, overhead: 2.63, profit: 1.24, price: 17, by: 'PHUONG', src: `${BLACKIN} · BT-HG02 (960 cái)`, name: 'Ghế Stacking khung sắt, vải textline' },
  // Ban Hali.xlsx: 175 Total 80,922 = tt 68,811 + chung 3,441 + ln 8,67 (báo giá 82); đơn 2 thùng × 43,50 = 87 → ln 14,75
  { code: 'TB0211HG-IR', kind: 'full', direct: 68.81, overhead: 3.44, profit: 14.75, price: 87, by: 'PHUONG', src: `${LAURA} · 1708430.12/.22 Hali 175cm = 2 thùng × 43,50 · ${HALI} (báo giá 82)`, name: 'Bàn Hali 175cm khung sắt - mặt bàn gỗ keo FSC' },
  // 235 Total 106,545 = tt 90,599 + chung 4,53 + ln 11,416 (báo giá 108); đơn 2 × 58 = 116 → ln 20,87
  { code: 'TB0212HG-IR', kind: 'full', direct: 90.6, overhead: 4.53, profit: 20.87, price: 116, by: 'PHUONG', src: `${LAURA} · 1708431.12/.22 Hali 235cm = 2 thùng × 58,00 · ${HALI} (báo giá 108)`, name: 'Bàn Hali 235cm khung sắt - mặt bàn gỗ keo FSC' },
  { code: 'TB0228HG-IR', kind: 'fob', price: 63, by: 'PHUONG', src: `${LAURA} · 1708402.11 Amelia Dining Table Legs (100 cái)`, name: 'Chân bàn Amelia khung sắt' },
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
  .select('id, code, plan_price')
  .in(
    'code',
    rows.map((r) => r.code),
  )
if (error) throw error
let bad = 0
for (const r of rows) {
  const p = prods.find((x) => x.code === r.code)
  const okSum =
    r.kind === 'fob' || Math.abs(r.price - (r.direct + r.overhead + r.profit)) <= 0.011
  const okNeg = r.kind === 'fob' || (r.direct > 0 && r.overhead >= 0 && r.profit >= 0)
  const fresh = p && p.plan_price == null
  const ok = p && okSum && okNeg && fresh
  if (!ok) bad++
  console.log(
    `${ok ? '✓' : '✗'} ${r.code.padEnd(13)} ${r.kind === 'full' ? 'ĐỦ ' : 'FOB'} ${String(r.price).padStart(8)} USD ${r.kind === 'full' ? `(tt ${r.direct} + chung ${r.overhead} + ln ${r.profit})` : ''} ${r.name.slice(0, 40)}${!p ? ' · KHÔNG THẤY SP' : !fresh ? ` · ĐÃ CÓ GIÁ ${p.plan_price}` : ''}${!okSum ? ' · LỆCH TỔNG' : ''}${!okNeg ? ' · ÂM' : ''}`,
  )
}
console.log(
  `${rows.length} SP · đủ 4 số ${rows.filter((r) => r.kind === 'full').length} · chỉ FOB ${rows.filter((r) => r.kind === 'fob').length} · lỗi ${bad}`,
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
  const breakdown =
    r.kind === 'full'
      ? [
          {
            label: 'Chi phí trực tiếp (Total sổ − chi phí chung − lợi nhuận)',
            amount: r.direct,
          },
          { label: 'Chi phí chung', amount: r.overhead },
          { label: 'Lợi nhuận (tính lại theo giá đơn)', amount: r.profit },
        ]
      : [{ label: r.name, amount: r.price }]
  const { error: e } = await db
    .from('technical_products')
    .update({
      plan_direct_cost: r.kind === 'full' ? r.direct : null,
      plan_overhead: r.kind === 'full' ? r.overhead : null,
      plan_profit: r.kind === 'full' ? r.profit : null,
      plan_price: r.price,
      plan_currency: 'USD',
      plan_fx_rate: null,
      plan_breakdown: breakdown,
      plan_source: r.src,
      plan_at: TODAY,
      plan_by: BY[r.by],
    })
    .eq('id', p.id)
    .is('plan_price', null)
  if (e) throw e
  n++
}
console.log(`ĐÃ GHI ${n} SP.`)
