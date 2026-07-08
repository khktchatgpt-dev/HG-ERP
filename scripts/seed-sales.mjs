// Seed dữ liệu mẫu cho phân hệ Kinh doanh (Sales) — dựa trên 3 chứng từ thật:
// Quotation 02.26 (YOTRIO), Sales Contract 17867 + LSX 27/25-26 (MERXX).
//
// Tạo: cấu hình công ty (bên bán + FSC), 2 khách, ~7 sản phẩm (kèm thông số
// kỹ thuật / đóng gói), 1 báo giá đã chốt (YOTRIO), 1 đơn hàng + điều khoản
// xuất khẩu (MERXX). Idempotent: upsert theo mã; báo giá/đơn bỏ qua nếu đã có.
//
// Usage:  node scripts/seed-sales.mjs
// Đọc NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY từ env hoặc .env.local.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

loadEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) die('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Owner/created_by = admin đầu tiên (hoặc user bất kỳ).
const { data: owner } = await db
  .from('users')
  .select('id, email')
  .order('role', { ascending: true })
  .limit(1)
  .maybeSingle()
if (!owner) die('Chưa có user nào — tạo admin trước bằng scripts/create-user.mjs')
console.log(`• Owner: ${owner.email}`)

// ── 1) Cấu hình công ty (bên bán + FSC) ─────────────────────────────────────
const settings = {
  company_name: 'HOANG GIA CO., LTD',
  company_address:
    'Lot C3, Cat Nhon Industrial Complex, Phu Cat District, Binh Dinh Province, Vietnam',
  company_phone: '+84 56 3501516',
  company_fax: '+84 56 3853 946',
  company_email: 'info@hoanggia.de',
  company_bank_account:
    '005137/03829959 at Joint Stock Commercial Bank for Foreign Trade of Viet Nam (Quy Nhon Branch)',
  company_swift: 'BFTVVNVX026',
  company_representative: 'Mr. Chu Xuan Loc',
  company_representative_title: 'Vice Director',
  company_fsc_cert: 'SW-COC-006425',
  fsc_scientific_name: 'Acacia Hybrid FSC 100%',
  fsc_country_origin: 'Viet Nam',
  fsc_area_origin: 'Viet Nam',
  fsc_forest_owner:
    'Nguyen Cong Hoan, Tran Van Toi, Nguyen Khanh Hoa, Bui Cong Thu, Dang Bian Thay (SA-FM/COC-014709)',
  fsc_exporter: 'Hong Phat General Trading Production Company Limited (SGS-COC-700470)',
  fsc_importer: 'Minh Dat Co., Ltd (SCS-COC-006352)',
  fsc_seller: 'Minh Dat Co., Ltd (SCS-COC-006352)',
  fsc_coordinates: '18°17\'34.55"N 105°48\'47.25"E\n18°14\'44.66"N 105°502.42"E',
}
{
  const rows = Object.entries(settings).map(([k, v]) => ({ key: k, value: v }))
  const { error } = await db.from('settings').upsert(rows)
  if (error) die(`settings: ${error.message}`)
  console.log(`✓ Settings công ty (${rows.length} khoá)`)
}

// ── 2) Khách hàng ───────────────────────────────────────────────────────────
const customers = [
  {
    code: 'MERXX',
    name: 'MERXX HANDELS GMBH',
    country: 'Germany',
    address: 'An der Trave 19, 23923 Selmsdorf, Germany',
    contact_person: 'Mr. Rainer Tiburzik',
    representative_title: 'Manager',
    phone: '0049 038823/64000',
    fax: '0049 038823/540011',
    fsc_cert: 'SCS-COC-001485',
    default_currency: 'USD',
    default_price_term: 'FOB Quy Nhon',
    default_payment_terms: 'By T/T',
    port_of_discharge: 'Hamburg Port - Germany',
    owner_id: owner.id,
  },
  {
    code: 'YOTRIO',
    name: 'YOTRIO GROUP',
    country: 'China',
    contact_person: 'Ms. Trang',
    default_currency: 'USD',
    default_price_term: 'FOB Quy Nhon',
    default_payment_terms: 'L/C at sight',
    port_of_discharge: 'Ningbo Port - China',
    owner_id: owner.id,
  },
]
{
  const { error } = await db
    .from('sales_customers')
    .upsert(customers, { onConflict: 'code' })
  if (error) die(`customers: ${error.message}`)
  console.log(`✓ Khách hàng (${customers.length})`)
}
const { data: custRows } = await db
  .from('sales_customers')
  .select('id, code')
  .in('code', ['MERXX', 'YOTRIO'])
const custId = Object.fromEntries(custRows.map((c) => [c.code, c.id]))

// ── 3) Sản phẩm (thông số kỹ thuật + đóng gói) ──────────────────────────────
const P = (o) => ({
  unit: 'cai',
  bom_status: 'none',
  packing: {},
  tech_spec: {},
  showroom_sample: false,
  ...o,
})
const products = [
  // MERXX — theo Sales Contract 17867 + LSX 27/25-26
  P({
    code: '21605-217',
    customer_item_code: '21600-217',
    customer_id: custId.MERXX,
    name: 'Bàn CNKG Tilos, khung nhôm',
    name_de:
      'Tilos Ausziehtisch, 150(200)x90x74 cm, Aluminium, Tischplatte aus Akazienholz, FSC 100%',
    barcode: '4033662987552',
    description_en: 'Tilos extension table, aluminium frame, acacia wood top, FSC 100%',
    reference_price: 35.9,
    showroom_sample: true,
    packing: {
      l_cm: 150,
      w_cm: 90,
      h_cm: 74,
      carton_l_cm: 154,
      carton_w_cm: 154,
      carton_h_cm: 11.6,
      qty_per_carton: 1,
      loading_40hc: 154,
      pack_unit_label: 'ctn',
    },
    tech_spec: { wood: 'Acacia FSC 100% Màu 142', paint: 'Màu Graphit H-SM-96 08' },
  }),
  P({
    code: '22014-307',
    customer_item_code: '22010-307',
    customer_id: custId.MERXX,
    name: 'Ghế 5 bậc Paxos',
    name_de:
      'Klappsessel Paxos, Rückenlehne 5-fach verstellbar, Alu/Textilen, graphit, mit Holzarmlehne Akazie FSC 100%',
    barcode: '4033662220147',
    reference_price: 24.4,
    packing: { qty_per_carton: 1, pack_unit_label: 'ctn' },
    tech_spec: { paint: 'HG-T650-07 (T07)', wood: 'Acacia FSC 100% Màu 142' },
  }),
  P({
    code: '28256-228',
    customer_item_code: '22028-209',
    customer_id: custId.MERXX,
    name: 'Ghế thư giãn Riva Treviso',
    name_de:
      'Relaxinsel Riva, Multifunktion, inkl. Auflagen, Alu/Kunststoffgeflecht, naturgrau',
    barcode: '4033662900957',
    unit: 'bo',
    reference_price: 36.63,
    packing: { qty_per_carton: 1, pack_unit_label: 'ctn' },
    tech_spec: {
      machine: 'F2264B',
      cushion: 'HG-P180-M2 1 (M21)',
      paint: 'Màu Graphit H-SM-9 608',
    },
  }),
  P({
    code: '26443-228',
    customer_item_code: '22060-210',
    customer_id: custId.MERXX,
    name: 'Bàn kéo giãn nhôm kính',
    name_de:
      'Semi Balkon AZ-Tisch 80(120)x70cm, graphitfarbenes Alugestell, mit grauer Glasplatte',
    barcode: '4033662264431',
    reference_price: 29.59,
    packing: {
      l_cm: 80,
      w_cm: 70,
      carton_l_cm: 120,
      qty_per_carton: 1,
      pack_unit_label: 'ctn',
    },
    tech_spec: {
      glass: 'Kính sơn xám dolphin, kính dán',
      paint: 'Màu Graphit H-SM-96 08',
    },
  }),
  // YOTRIO — theo Quotation 02.26 (dòng Rhone)
  P({
    code: 'RHONE-DT',
    customer_id: custId.YOTRIO,
    name: 'Rhone Aluminium Dining Table',
    description_en:
      'Rhone Aluminium Dining Table, Alu frame powder coating, Eukalyptus FSC 100%',
    reference_price: 102.81,
    unit: 'set',
    packing: {
      l_cm: 212,
      w_cm: 95,
      h_cm: 75,
      carton_l_cm: 216,
      carton_w_cm: 99,
      carton_h_cm: 11.6,
      qty_per_carton: 1,
      loading_40hc: 270,
      pack_unit_label: 'ctn',
    },
    tech_spec: { wood: 'Eukalyptus FSC 100%', paint: 'Powder coating' },
  }),
  P({
    code: 'RHONE-BENCH',
    customer_id: custId.YOTRIO,
    name: 'Rhone Aluminium Bench',
    description_en:
      'Rhone Aluminium Bench, Alu frame powder coating, Eukalyptus FSC 100%',
    reference_price: 67.94,
    unit: 'set',
    packing: {
      l_cm: 187,
      w_cm: 36,
      h_cm: 45,
      carton_l_cm: 191,
      carton_w_cm: 40,
      carton_h_cm: 11.6,
      qty_per_carton: 1,
      loading_40hc: 756,
      pack_unit_label: 'ctn',
    },
    tech_spec: { wood: 'Eukalyptus FSC 100%', paint: 'Powder coating' },
  }),
  P({
    code: 'RHONE-CHAIR',
    customer_id: custId.YOTRIO,
    name: 'Rhone Aluminium Dining Chair',
    description_en:
      'Rhone Aluminium Dining Chair, Alu frame powder coating, Eukalyptus FSC 100%',
    reference_price: 24.15,
    unit: 'pcs',
    packing: {
      l_cm: 60.2,
      w_cm: 58.1,
      h_cm: 92.4,
      carton_l_cm: 110,
      carton_w_cm: 64,
      carton_h_cm: 223,
      qty_per_carton: 20,
      loading_40hc: 660,
      pack_unit_label: 'pallet',
    },
    tech_spec: { wood: 'Eukalyptus FSC 100%', paint: 'Powder coating' },
  }),
]
{
  const { error } = await db
    .from('technical_products')
    .upsert(products, { onConflict: 'code' })
  if (error) die(`products: ${error.message}`)
  console.log(`✓ Sản phẩm (${products.length})`)
}
const { data: prodRows } = await db
  .from('technical_products')
  .select('id, code')
  .in(
    'code',
    products.map((p) => p.code),
  )
const prodId = Object.fromEntries(prodRows.map((p) => [p.code, p.id]))

async function nextCode(kind) {
  const { data, error } = await db.rpc('next_doc_code', { p_kind: kind })
  if (error) die(`next_doc_code(${kind}): ${error.message}`)
  return data
}

// ── 4) Báo giá đã chốt cho YOTRIO (Quotation 02.26) ─────────────────────────
{
  const { count } = await db
    .from('sales_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', custId.YOTRIO)
  if (count && count > 0) {
    console.log('• Báo giá YOTRIO đã tồn tại — bỏ qua')
  } else {
    const code = await nextCode('BG')
    const { data: q, error } = await db
      .from('sales_quotes')
      .insert({
        code,
        customer_id: custId.YOTRIO,
        status: 'sent',
        currency: 'USD',
        valid_from: '2026-02-01',
        valid_to: '2026-05-31',
        price_term: 'FOB Quy Nhon',
        payment_terms: 'L/C at sight',
        note: 'QUOTATION 02.26 - HOANG GIA (mẫu seed)',
        created_by: owner.id,
      })
      .select('id')
      .single()
    if (error) die(`quote: ${error.message}`)
    const qlines = [
      { product_id: prodId['RHONE-DT'], qty: 100, unit_price: 102.81 },
      { product_id: prodId['RHONE-BENCH'], qty: 100, unit_price: 67.94 },
      { product_id: prodId['RHONE-CHAIR'], qty: 400, unit_price: 24.15 },
    ].map((l, i) => ({ ...l, quote_id: q.id, sort_order: i }))
    const { error: le } = await db.from('sales_quote_lines').insert(qlines)
    if (le) die(`quote lines: ${le.message}`)
    console.log(`✓ Báo giá ${code} (YOTRIO, đã chốt, ${qlines.length} dòng)`)
  }
}

// ── 5) Đơn hàng cho MERXX (Sales Contract 17867) ────────────────────────────
{
  const { count } = await db
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', custId.MERXX)
  if (count && count > 0) {
    console.log('• Đơn MERXX đã tồn tại — bỏ qua')
  } else {
    const code = await nextCode('DH')
    const { data: o, error } = await db
      .from('sales_orders')
      .insert({
        code,
        customer_id: custId.MERXX,
        customer_po_no: 'HG-MX',
        status: 'confirmed',
        currency: 'USD',
        due_date: '2026-04-26',
        deposit_percent: 20,
        price_term: 'FOB Quy Nhon',
        payment_terms: 'By T/T',
        container_summary: "3 x 40'HC",
        qty_tolerance_pct: 10,
        partial_shipment: true,
        transhipment: true,
        port_of_loading: 'Quy Nhon Port - Vietnam',
        port_of_discharge: 'Hamburg Port - Germany',
        payment_method: 'By T/T',
        required_docs:
          'Commercial Invoice: 03 originals\nPacking list: 03 originals\nCertificate of Origin GSP Form A: 01 original + 03 copy\nFull set Clean on Board Bill of Lading: 03 originals',
        note: 'Sales Contract 17867HG-MX (mẫu seed)',
        created_by: owner.id,
      })
      .select('id')
      .single()
    if (error) die(`order: ${error.message}`)
    const olines = [
      { product_id: prodId['21605-217'], qty: 500, unit_price: 35.9 },
      { product_id: prodId['22014-307'], qty: 400, unit_price: 24.4 },
      { product_id: prodId['28256-228'], qty: 250, unit_price: 36.63 },
      { product_id: prodId['26443-228'], qty: 300, unit_price: 29.59 },
    ].map((l, i) => ({ ...l, order_id: o.id, sort_order: i }))
    const { error: le } = await db.from('sales_order_lines').insert(olines)
    if (le) die(`order lines: ${le.message}`)
    console.log(`✓ Đơn hàng ${code} (MERXX, ${olines.length} dòng, có điều khoản XK)`)
  }
}

console.log('\n✓ Seed Sales xong. Vào /sales để xem KH · báo giá · đơn hàng · in BG/HĐ.')
process.exit(0)
