/**
 * NẠP GIÁ THÀNH KẾ HOẠCH TỪ FILE DRIVE CỦA SALE — 02/10/2026.
 *
 *   node scripts/plan-cost-nap-drive-1002.mjs           # dò khô: khớp mã, kiểm tổng
 *   node scripts/plan-cost-nap-drive-1002.mjs --apply   # ghi technical_products.plan_*
 *
 * Nguồn (đọc 02/10/2026, mọi số là USD/đơn vị như Sale ghi):
 *   LAURA  · "Revise Quotation - Aria Rattan 10 July" (REVISED 17 JUL 2026)
 *          · "Quotation - 4nd Revised date 11 May" (Sigrid · Imani · New Hali chair)
 *          · "Quotation - Ezra + Eli + Hali Stool" · "Quotation - Halston (10 Jul 2026)"
 *   JAWOLL · "Quotation 01.26 updated 27.4.26 - Jawoll"
 *   YOTRIO · "Quotation 01.26 updated 27.4.26"
 *   MERXX  · "order HG 2026-2027.xlsx" (đơn 18023/18028/18035/18056) — CHỈ GIÁ FOB
 *   ROSCO  · "New chelsea range - HG's price-after ROSCO working with cus" — CHỈ GIÁ FOB
 *
 * LUẬT GHI: trực tiếp và chi phí chung lấy nguyên bảng tính; GIÁ = giá FOB đã
 * báo khách (bảng giá đầu file). Nếu bảng tính ra Total khác giá đã báo thì lợi
 * nhuận = giá báo − trực tiếp − chung (và ghi Total gốc vào breakdown để soi).
 * Bộ (set) = cộng các khối thành phần. SP chỉ có bảng giá chốt → chỉ FOB.
 *
 * KHÔNG CÓ NGUỒN (bỏ qua, báo ở cuối): Hali 175/235 tables, Amelia legs,
 * IBIZA (02/26-27 ROSCO), SP "21660-011" trong lệnh 09 MX chưa gắn hồ sơ.
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

// Người nạp = chủ file trên Drive. sales1 = Hằng (minhhangmx), sales2 = Phương (thanhphuongmerxx).
const HANG = '77b5c16b-56b8-46f2-b90d-9b96830624e3'
const PHUONG = 'e589c8de-66f5-48be-bf33-55bc2fa9fef9'

const r2 = (n) => Math.round(n * 100) / 100
const sum = (o) => r2(Object.values(o).reduce((s, v) => s + v, 0))

/** Khối đủ số: bd = các dòng trực tiếp; oh = chi phí chung; ln = lợi nhuận bảng tính; fob = giá đã báo. */
function full(codes, bd, oh, ln, fob, src, by, note) {
  const direct = sum(bd)
  const total = r2(direct + oh + ln)
  const profit = Math.abs(total - fob) <= 0.05 ? ln : r2(fob - direct - oh)
  const breakdown = Object.entries(bd).map(([label, amount]) => ({ label, amount }))
  if (profit !== ln)
    breakdown.push({ label: `Total bảng tính (LN ${ln})`, amount: total })
  if (note) breakdown.push({ label: note, amount: 0 })
  return codes.map((code) => ({
    code,
    direct,
    overhead: oh,
    profit,
    price: fob,
    breakdown,
    src,
    by,
  }))
}
/** Bộ = cộng thành phần. parts: [{bd, oh, ln}] */
function set(codes, parts, fob, src, by) {
  const direct = r2(parts.reduce((s, p) => s + sum(p.bd), 0))
  const oh = r2(parts.reduce((s, p) => s + p.oh, 0))
  const ln = r2(parts.reduce((s, p) => s + p.ln, 0))
  const total = r2(direct + oh + ln)
  const profit = Math.abs(total - fob) <= 0.05 ? ln : r2(fob - direct - oh)
  const breakdown = parts.map((p) => ({
    label: `${p.name}: ${sum(p.bd)} + chung ${p.oh} + LN ${p.ln}`,
    amount: r2(sum(p.bd) + p.oh + p.ln),
  }))
  if (profit !== ln)
    breakdown.push({ label: `Total bảng tính (LN ${ln})`, amount: total })
  return codes.map((code) => ({
    code,
    direct,
    overhead: oh,
    profit,
    price: fob,
    breakdown,
    src,
    by,
  }))
}
const fobOnly = (map, src, by) =>
  Object.entries(map).map(([code, price]) => ({
    code,
    direct: null,
    overhead: null,
    profit: null,
    price,
    breakdown: null,
    src,
    by,
  }))

// ── LAURA · Aria Rattan ───────────────────────────────────────────────────────
const ARIA =
  'Revise Quotation - Aria Rattan (REVISED 17 JUL 2026, Drive 1rfdjNCTNSwCLxZD8CQpJRSNDOJTbzmiN)'
const ariaGoc = {
  name: 'Ghế góc 177',
  bd: {
    Sắt: 7.96,
    'Hàn, nguội, sơn': 7.78,
    Mây: 11.25,
    'Công đan': 15.38,
    'Vật tư': 1.0,
    'Bao bì': 4.24,
    'Kiểm-XC': 3.95,
    'Nhãn màu': 1.0,
    Nệm: 42.3,
  },
  oh: 2.06,
  ln: 4.83,
}
const aria3 = {
  name: 'Ghế 3 (203cm)',
  bd: {
    Sắt: 9.11,
    'Hàn, nguội, sơn': 8.72,
    Mây: 13.85,
    'Công đan': 15.38,
    'Vật tư': 1.0,
    'Bao bì': 5.24,
    'Kiểm-XC': 5.34,
    'Nhãn màu': 1.0,
    Nệm: 46.2,
  },
  oh: 2.93,
  ln: 6.16,
}
const ariaBanVuong = {
  name: 'Bàn vuông 60',
  bd: {
    Sắt: 2.12,
    'Hàn, nguội, sơn': 2.03,
    Mây: 3.46,
    'Công đan': 2.31,
    'Vật tư': 0.5,
    Kính: 2.77,
    'Bao bì': 1.65,
    'Kiểm-XC': 1.31,
    'Nhãn màu': 1.0,
  },
  oh: 0.81,
  ln: 1.7,
}
const ariaNangHa = {
  name: 'Bàn nâng hạ 144',
  bd: {
    Sắt: 11.94,
    'Hàn, nguội, sơn': 12.98,
    Mây: 12.98,
    'Công đan': 11.54,
    'Vật tư': 1.5,
    Kính: 7.75,
    'Bao bì': 5.24,
    'Kiểm-XC': 3.25,
    'Nhãn màu': 1.0,
  },
  oh: 4.7,
  ln: 8.63,
}

const rows = [
  ...full(
    ['BN0208HG-RA'],
    {
      Sắt: 5.66,
      'Hàn, nguội, sơn': 5.42,
      Mây: 7.27,
      'Công đan': 7.31,
      'Vật tư': 0.77,
      'Bao bì': 2.8,
      'Kiểm-XC': 2.4,
      'Nhãn màu, thẻ treo': 1.0,
      Nệm: 15.4,
    },
    1.46,
    3.31,
    52.8,
    ARIA,
    PHUONG,
  ),
  ...full(
    ['BN0207HG-RA'],
    {
      Sắt: 6.9,
      'Hàn, nguội, sơn': 6.6,
      Mây: 10.73,
      'Công đan': 11.54,
      'Vật tư': 0.77,
      'Bao bì': 3.0,
      'Kiểm-XC': 3.56,
      'Nhãn màu': 1.0,
      Nệm: 30.8,
    },
    2.15,
    4.53,
    81.58,
    ARIA,
    PHUONG,
  ),
  ...full(['BN0209HG-RA'], aria3.bd, aria3.oh, aria3.ln, 114.51, ARIA, PHUONG),
  ...full(
    ['TB0215HG-RA'],
    ariaBanVuong.bd,
    ariaBanVuong.oh,
    ariaBanVuong.ln,
    19.65,
    ARIA,
    PHUONG,
  ),
  ...full(
    ['CH0218HG-RA'],
    {
      Sắt: 2.48,
      'Hàn, nguội, sơn': 2.37,
      Mây: 2.77,
      'Công đan': 2.31,
      'Vật tư': 0.5,
      'Bao bì': 1.1,
      'Kiểm-XC': 0.68,
      'Nhãn màu': 1.0,
      Nệm: 6.8,
    },
    0.61,
    1.28,
    20.2,
    ARIA,
    PHUONG,
    'Giá báo 20,20 thấp hơn bảng tính 21,90 → lợi nhuận âm',
  ),
  ...full(
    ['TB0216HG-RA'],
    ariaNangHa.bd,
    ariaNangHa.oh,
    ariaNangHa.ln,
    81.8,
    ARIA,
    PHUONG,
  ),
  ...full(
    ['SL0183HG-RA'],
    {
      Sắt: 8.49,
      'Hàn, nguội, sơn': 8.86,
      Mây: 10.38,
      'Công đan': 11.15,
      'Vật tư': 1.9,
      'Bao bì': 5.7,
      'Kiểm-XC': 4.11,
      'Nhãn màu': 1.0,
      Nệm: 35.3,
    },
    2.53,
    5.31,
    94.97,
    ARIA,
    PHUONG,
  ),
  ...set(['ST0215HG-RA'], [ariaGoc, aria3, ariaBanVuong], 232.0, ARIA, PHUONG),
  ...set(['ST0214HG-RA'], [ariaGoc, aria3, ariaNangHa], 290.0, ARIA, PHUONG),

  // ── LAURA · Sigrid · Imani · Hali (bản 11 May, revised) ───────────────────
  ...full(
    ['TB0213HG-AL', 'TB0214HG-AL'],
    {
      Nhôm: 15.47,
      'Khoán đến sơn': 4.16,
      'Đóng+kiểm': 0.68,
      'Xuất hàng': 0.78,
      'Bao bì 200 + chèn lót': 4.23,
      'Vật tư': 0.85,
      Sơn: 0.51,
      'Mặt đá': 20.24,
    },
    2.35,
    4.93,
    54.2,
    'Quotation - 4nd Revised date 11 May (LAURA Sigrid, Drive 1VAcKs6aFFSko2rOJ6knvbLj99-gDFf5g)',
    PHUONG,
  ),
  ...full(
    ['CH0214HG-AL', 'CH0215HG-AL'],
    {
      Nhôm: 20.43,
      'Khoán đến sơn': 5.49,
      'Xuất hàng': 3.78,
      'Bao bì 200 + chèn lót': 2.88,
      'Vật tư': 1.15,
      Sơn: 0.76,
      Nệm: 44.37,
    },
    3.94,
    8.28,
    91.1,
    'Quotation - 4nd Revised date 11 May (LAURA Sigrid armchair)',
    PHUONG,
  ),
  ...full(
    ['CH0216HG-AL', 'CH0217HG-AL'],
    {
      Nhôm: 15.08,
      'Khoán đến sơn': 4.05,
      'Xuất hàng': 2.35,
      'Bao bì 200 + chèn lót': 4.81,
      'Vật tư': 0.77,
      Sơn: 0.54,
      Nệm: 41.8,
    },
    3.47,
    5.83,
    79.0,
    'Quotation - 4nd Revised date 11 May (LAURA Sigrid middle section)',
    PHUONG,
  ),
  ...full(
    ['ST0211HG-AL', 'ST0212HG-AL'],
    {
      Nhôm: 85.14,
      'Khoán đến đóng thùng': 22.88,
      'Xuất hàng': 9.87,
      'Bao bì 200 + chèn lót': 8.27,
      'Vật tư': 2.77,
      Sơn: 2.99,
      Nệm: 220.9,
    },
    17.64,
    44.46,
    421.0,
    'Quotation - 4nd Revised date 11 May (LAURA Sigrid corner sofa set GD27GFURN-36)',
    PHUONG,
  ),
  ...full(
    ['ST0213HG-AL'],
    {
      Nhôm: 115.96,
      'Khoán đến sơn': 26.28,
      'Đóng+kiểm': 8.19,
      'Xuất hàng': 9.42,
      'Bao bì 200 + chèn lót': 11.92,
      'Vật tư': 2.88,
      Sơn: 5.35,
      Nệm: 121.55,
    },
    24.13,
    48.85,
    374.55,
    'Quotation - 4nd Revised date 11 May (LAURA Imani corner)',
    PHUONG,
  ),
  ...full(
    ['CH0212HG-IR', 'CH0213HG-IR'],
    {
      Sắt: 5.42,
      'Khoán đến sơn': 3.76,
      'Đóng+kiểm': 0.47,
      'Xuất hàng': 0.54,
      'Bao bì 200 + chèn lót': 3.65,
      'Vật tư': 0.77,
      Sơn: 0.22,
      Nệm: 5.06,
    },
    1.59,
    3.22,
    24.71,
    'Quotation - 4nd Revised date 11 May (LAURA New Hali chair)',
    PHUONG,
  ),
  ...full(
    ['CH0210HG-IR', 'CH0211HG-IR'],
    {
      Sắt: 5.5,
      'Khoán đến sơn': 5.44,
      'Đóng+kiểm': 0.63,
      'Xuất hàng': 0.72,
      'Bao bì 200 + chèn lót': 1.06,
      'Vật tư': 0.77,
      Sơn: 0.23,
      'Dây dù': 3.6,
      'Công đan': 1.85,
      Nệm: 4.6,
    },
    2.44,
    2.15,
    28.98,
    'Quotation - Ezra + Eli + Hali Stool (LAURA, Drive 1cYZABwzhkkQfIsj7n3knkxc7mpt6tllT)',
    PHUONG,
  ),
  ...full(
    ['ST0216HG-IR'],
    {
      Sắt: 25.6,
      'Khoán đến sơn': 12.69,
      'Đóng+kiểm': 2.96,
      'Xuất hàng': 3.4,
      'Bao bì 200 + chèn lót': 6.84,
      'Vật tư': 3.48,
      Sơn: 2.24,
      Gỗ: 9.75,
      Nệm: 77.04,
    },
    28.8,
    15.55,
    190.0,
    'Quotation - Halston (10 Jul 2026, Drive 18q18J9T_CUIMUozcPKm8aZGV08Vep-q9)',
    PHUONG,
  ),

  // ── JAWOLL ───────────────────────────────────────────────────────────────
  ...full(
    ['BN0228HG-AL'],
    {
      Nhôm: 20.34,
      'Tiền công': 6.16,
      'Đóng+kiểm': 0.69,
      'Xuất hàng': 0.8,
      'Bao bì, đóng gói': 6.5,
      'Vật tư': 1.05,
      Sơn: 0.86,
      'Euka FSC': 20.83,
    },
    7.44,
    6.47,
    71.13,
    'Quotation 01.26 updated 27.4.26 - Jawoll (Drive 1ulybDgvYWYa01KqeoQGKTK3zgKM4PEBN)',
    PHUONG,
  ),

  // ── YOTRIO ───────────────────────────────────────────────────────────────
  ...full(
    ['CH0221HG-AL'],
    {
      Nhôm: 18.48,
      'Tiền công': 4.86,
      'Đóng+kiểm': 0.38,
      'Xuất hàng': 0.43,
      'Bao bì, đóng gói': 4.59,
      'Vật tư': 3.17,
      Sơn: 1.25,
      'Euka FSC': 11.36,
    },
    4.45,
    3.43,
    52.19,
    'Quotation 01.26 updated 27.4.26 - YOTRIO (Drive 1hFkUgQlgWfON6Gq9-HZi8kuTlYwESSkU)',
    HANG,
  ),
  ...full(
    ['CH0065HG-AL'],
    {
      Nhôm: 12.45,
      'Tiền công': 2.34,
      'Đóng+kiểm': 0.43,
      'Xuất hàng': 0.49,
      'Bao bì, đóng gói': 8.98,
      'Vật tư': 1.26,
      Sơn: 1.0,
      'Euka FSC': 4.73,
    },
    4.12,
    3.58,
    36.68,
    'Quotation 01.26 updated 27.4.26 - YOTRIO (stacking chair FZA30095J)',
    HANG,
  ),
  ...full(
    ['TB0202HG-AL'],
    {
      Nhôm: 41.07,
      'Tiền công': 8.49,
      'Đóng+kiểm': 0.88,
      'Xuất hàng': 1.02,
      'Bao bì, đóng gói': 9.57,
      'Vật tư': 3.24,
      Sơn: 1.09,
      'Euka FSC': 33.49,
    },
    11.86,
    11.07,
    121.79,
    'Quotation 01.26 updated 27.4.26 - YOTRIO (rect. table 160x89)',
    HANG,
  ),

  // ── MERXX · chỉ FOB (giá trên đơn đã ký) ────────────────────────────────
  ...fobOnly(
    {
      'TB0251HG-IR': 19.8,
      'TB0278HG-AL': 47.52,
      'TB0281HG-AL': 24.52,
      'CH0238HG-IR': 30.17,
      'CH0022HG-AL': 23.95,
      'TB0008HG-AL': 104.97,
      'TB0023HG-AL': 65.97,
      'ST0048HG-AL': 151.14,
      'CH0242HG-IR': 23.34,
      'TB0280HG-AL': 38.69,
      'TB0279HG-AL': 109.93,
      'ST0029HG-AL': 111.71,
      'TB0242HG-IR': 64.51,
      'TB0283HG-AL': 64.51,
      'OT0211HG-IR': 58.84,
      'AC0003HG-XX': 3.46,
      'AC0004HG-XX': 3.45,
      'AC0005HG-XX': 7.54,
      'AC0006HG-XX': 7.97,
      'AC0007HG-XX': 6.62,
      'SL0185HG-IR': 74.47,
      'TB0282HG-AL': 49.23,
      'CH0272HG-IR': 14.5,
      'TB0273HG-AL': 49.23,
      'TB0245HG-IR': 109.46,
      'TB0263HG-AL': 175.45,
      'TB0274HG-AL': 109.46,
      'TB0249HG-IR': 145.84,
      'TB0275HG-AL': 145.84,
      'CH0237HG-AL': 44.25,
      'CH0243HG-IR': 69.25,
      'AC0008HG-XX': 27.07,
      'AC0009HG-XX': 59.08,
      'AC0011HG-XX': 18.02,
      'CH0285HG-AL': 33.86,
      'AC0010HG-XX': 9.27,
      'CH0286HG-AL': 24.03,
      'TB0294HG-AL': 109.46,
    },
    'order HG 2026-2027.xlsx — giá trên đơn MERXX 18023/18028/18035/18056 (Drive 1s9vmBxQ1DCEMEn2dLkSil-0CbLIMwhtX); chưa có bảng tính giá thành',
    PHUONG,
  ),

  // ── ROSCO New Chelsea · chỉ FOB (giá ROSCO chốt với khách) ───────────────
  ...fobOnly(
    {
      'TB0217HG-AL': 61.95,
      'TB0223HG-AL': 61.95,
      'TB0218HG-AL': 29.82,
      'TB0224HG-AL': 29.82,
      'TB0096HG-AL': 30.49,
      'TB0227HG-AL': 30.49,
      'TB0219HG-AL': 18.41,
      'TB0222HG-AL': 18.41,
      'TB0225HG-AL': 144.76,
      'TB0226HG-AL': 82.34,
      'CH0219HG-AL': 60.66,
      'CH0220HG-AL': 60.66,
      'CH0222HG-AL': 121.46,
      'CH0099HG-AL': 121.46,
      'TB0221HG-AL': 35.73,
      'TB0220HG-AL': 35.73,
      'BN0210HG-AL': 600.2,
      'BN0211HG-AL': 600.2,
      'OT0180HG-AL': 122.0,
      'SL0182HG-AL': 147.99,
    },
    'New chelsea range - HG price after ROSCO working with cus (08/2026, Drive 1LMSHrywwU8ta-2v2XqDbBa1dPpptvLPl); chưa có bảng tính giá thành',
    HANG,
  ),
]

// ── Khớp mã HG → id, kiểm tổng ───────────────────────────────────────────────
const codes = rows.map((r) => r.code)
if (new Set(codes).size !== codes.length) throw new Error('mã trùng trong danh sách')
const { data: prods, error } = await db
  .from('technical_products')
  .select('id, code, name, customer_item_code, plan_price, plan_source')
  .in('code', codes)
if (error) throw error
const byCode = new Map(prods.map((p) => [p.code, p]))
let bad = 0
for (const r of rows) {
  const p = byCode.get(r.code)
  const chk =
    r.direct == null
      ? 'FOB'
      : Math.abs(r.price - (r.direct + r.overhead + r.profit)) <= 0.05
        ? 'OK '
        : 'LỆCH'
  if (!p || chk === 'LỆCH') bad++
  console.log(
    `${p ? '✓' : '✗ KHÔNG CÓ'} ${r.code.padEnd(12)} ${chk} ${String(r.price).padStart(7)} = ${String(r.direct ?? '—').padStart(7)} + ${String(r.overhead ?? '—').padStart(6)} + ${String(r.profit ?? '—').padStart(6)}  ${p ? (p.name ?? '').slice(0, 44) : ''}${p?.plan_price != null ? `  [đang có ${p.plan_price}]` : ''}`,
  )
}
console.log(
  `\n${rows.length} dòng (${rows.filter((r) => r.direct != null).length} đủ số, ${rows.filter((r) => r.direct == null).length} chỉ FOB) · lỗi: ${bad}`,
)
if (bad > 0) process.exit(1)
if (!APPLY) {
  console.log('Dò khô xong. Thêm --apply để ghi.')
  process.exit(0)
}
let n = 0
for (const r of rows) {
  const p = byCode.get(r.code)
  const { error: e } = await db
    .from('technical_products')
    .update({
      plan_direct_cost: r.direct,
      plan_overhead: r.overhead,
      plan_profit: r.profit,
      plan_price: r.price,
      plan_currency: 'USD',
      plan_fx_rate: null,
      plan_breakdown: r.breakdown,
      plan_source: r.src,
      plan_at: TODAY,
      plan_by: r.by,
    })
    .eq('id', p.id)
  if (e) throw e
  n++
}
console.log(`ĐÃ GHI ${n} dòng.`)
