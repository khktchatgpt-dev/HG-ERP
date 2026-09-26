// NẠP 2 ĐƠN BAO BÌ HIỆP HƯNG (Yotrio + Ibiza) CHO CHỊ NGA — 25/09/2026.
//
//   node scripts/po-import-baobi-hiephung.mjs [đường dẫn .xlsx]            # dò khô
//   node scripts/po-import-baobi-hiephung.mjs [đường dẫn .xlsx] --apply    # ghi
//
// Nguồn: "BAO BÌ HIỆP HƯNG - Yotrio & Ibiza.xlsx" — hai sheet, mỗi sheet một tờ
// đơn ngày 24/09/2026:
//   · Yotrio → 01-2026 HG/HH · lệnh 01/26-27 - YOTRIO
//   · Ibiza  → 02-2026 HG/HH · lệnh 02/26-27 - ROSCO (tờ ghi "LSX 02.2026 ROSCO IBIZA")
// Số lượng khớp lệnh: Yotrio 180 bàn / 400 ghế 5 bậc / 400 ghế xếp; Ibiza 2814
// hộp ghế bành (= 5628 cái / 2) · 1950 sofa + bàn tròn · 4480 hộp ghế xoay
// (= 8960 / 2) · 2126 bàn vuông · 2240 bàn ăn.
//
// Đọc SỐ từ file (ô công thức lấy kết quả đã tính), không gõ lại tay.
// Dòng tính tiền theo THÙNG (carton_basis 'ctn'): đơn giá = đúng ô "ĐƠN GIÁ" của
// tờ — tờ làm tròn m² × giá/m² tới chục đồng TỪNG THÙNG rồi mới nhân SL, còn
// tính theo m² trên hệ thống thì không làm tròn → lệch với tờ. m² và giá/m² vẫn
// ghi vào area_m2 / price_per_m2 để phiếu in bày đủ cột.
// Cột "SL ĐH" (số SP) → qty_demand, "SP/Crt" → pcs_per_ctn — đúng quy ước các
// đơn carton đã có (PO-2026-0066, Kimpack).
//
// BỎ QUA (không có số lượng / tiền trên tờ, không nằm trong tổng):
//   · Ibiza: 3 dòng "Giấy kraft 1 mặt láng B3 150gsm" 15.000 đ — dòng đầu ghi
//     "MUA 1 CUỘN 500KG, KHỔ 1400MM". Ghi vào ghi chú đơn, chờ chốt.
//   · Yotrio: "Giấy xeo" (trống) và "Ghế xếp chồng" (dòng tiêu đề nhóm).
import ExcelJS from 'exceljs'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const FILE =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ??
  'C:/Users/HP/Downloads/BAO BÌ HIỆP HƯNG - Yotrio & Ibiza.xlsx'
const sb = await client(import.meta.url)
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const SUPPLIER_TAX = '4200500423' // CÔNG TY TNHH HIỆP HƯNG — đã có trong danh mục
const GROUP = 'Bao bì - đóng gói - tem nhãn'
const ORDER_DATE = '24/09/2026'
// "Giao hàng từ 5 đến 7 ngày kể từ ngày gởi đơn (không tính lễ & chủ nhật)":
// 24/09 (thứ Năm) + 7 ngày làm việc trừ CN = 02/10/2026 — lấy mốc xa.
const EXPECTED_AT = '2026-10-02'
const TERMS = {
  terms_quality:
    'Đúng định lượng, Đúng quy cách, Thùng vuông góc, không rách móp ẩm mốc, in rõ đúng nội dung.',
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Công nợ cuối tháng.',
  terms_invoice: 'Hóa đơn GTGT',
  terms_lead_time:
    'Giao hàng từ 5 đến 7 ngày kể từ ngày gởi đơn hàng. (không tính ngày lễ & chủ nhật.)',
}

// Nhóm SP theo khoảng dòng (STT trên tờ) — tờ xếp theo từng SP liền nhau.
const ORDERS = [
  {
    sheet: 'Yotrio',
    docNo: '01-2026 HG/HH',
    lsx: '01/26-27 - YOTRIO',
    onPaper: 'LSX 01.2026 - YOTRIO',
    contact: 'Ms Thu Hà - 0986 864 627',
    subtotalCell: 'L41',
    groups: [
      { rows: [16, 28], code: 'FTA20904X', label: 'Bàn Yotrio FTA20904X' },
      { rows: [29, 35], code: 'FDA50089N', label: 'Ghế 5 bậc Yotrio FDA50089N' },
      { rows: [36, 39], code: 'FZA30095J', label: 'Ghế xếp chồng Yotrio FZA30095J' },
    ],
    skippedNote: 'Tờ có dòng "Giấy xeo" để trống (không SL, không giá) — không nạp.',
  },
  {
    sheet: 'Ibiza',
    docNo: '02-2026 HG/HH',
    lsx: '02/26-27 - ROSCO',
    onPaper: 'LSX 02.2026 - ROSCO IBIZA',
    contact: 'Anh Hưng - 0986.864.627',
    subtotalCell: 'L45',
    groups: [
      { rows: [16, 20], code: '2723875', label: 'Arm Chair IBIZA 2723875' },
      { rows: [21, 29], code: '2723876', label: 'Sofa + Coffee Table IBIZA 2723876' },
      { rows: [30, 34], code: '2722875', label: 'Swivel Chair IBIZA 2722875' },
      { rows: [35, 37], code: '2723874', label: 'Bàn vuông IBIZA 2723874' },
      { rows: [38, 43], code: '2722239', label: 'Dining Table IBIZA 2722239' },
    ],
    skippedNote:
      '⚠ CHƯA NẠP giấy kraft (1 mặt láng 1 mặt nhám, B3 150gsm, 15.000 đ): tờ có 3 dòng không SL/không tiền, dòng đầu ghi "MUA 1 CUỘN 500KG, KHỔ 1400MM" (≈ 7.500.000 đ nếu giá theo kg) — không nằm trong tổng tờ; cần chốt SL rồi thêm dòng.',
  },
]

// ------------------------------------------------------------ đọc file -----
const val = (c) => {
  const v = c?.value
  if (v == null) return null
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('formula' in v || 'sharedFormula' in v) return null // công thức chưa có kết quả
  }
  return v
}
const txt = (c) => {
  const v = val(c)
  return v == null ? '' : String(v).replace(/\s+/g, ' ').trim()
}
const num = (c) => {
  const v = val(c)
  return typeof v === 'number' ? v : v != null && v !== '' && !isNaN(+v) ? +v : null
}

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)

// Thùng chính + đồ in theo SP (nội dung in khác nhau) → vật tư RIÊNG từng SP.
// Lót / thanh V / tổ ong / thùng chèn → vật tư theo QUY CÁCH, dùng chung được.
const PER_PRODUCT = /^(BB |Thùng SOLE|Thùng AD 5|Thùng NC 5|Hướng dẫn|Tem |Thẻ treo)/
const unitOf = (name) =>
  /^(Thùng|BB )/.test(name)
    ? 'Thùng'
    : /^Thanh V/.test(name)
      ? 'Thanh'
      : /^Hướng dẫn/.test(name)
        ? 'Quyển'
        : /^Thẻ treo/.test(name)
          ? 'Thẻ'
          : /^(Tem|Nắp)/.test(name)
            ? 'Cái'
            : 'Tấm'

function readOrder(o) {
  const ws = wb.getWorksheet(o.sheet)
  if (!ws) throw new Error(`thiếu sheet ${o.sheet}`)
  const lines = []
  const skipped = []
  for (const g of o.groups)
    for (let r = g.rows[0]; r <= g.rows[1]; r++) {
      const row = ws.getRow(r)
      // "Thanh V (3.200/m)" — giá/m đã nằm ở cột giá, không để vào tên vật tư.
      const name = txt(row.getCell('B')).replace(/\s*\([\d.,]+\/m\)/, '')
      const qty = num(row.getCell('F'))
      const price = num(row.getCell('K'))
      if (!name) continue
      if (!qty || !price) {
        skipped.push(`${r}: ${name}`)
        continue
      }
      const dimsCm = txt(row.getCell('G'))
      const req = txt(row.getCell('H'))
      const m2 = num(row.getCell('I'))
      const m2Txt = txt(row.getCell('I'))
      const priceM2 = num(row.getCell('J'))
      const paperAmount = num(row.getCell('L'))
      const isBar = /^Thanh V/.test(name)
      const matName = PER_PRODUCT.test(name)
        ? `${name}${dimsCm ? ` ${dimsCm}cm` : ''} - ${g.label}`
        : `${name}${dimsCm ? ` ${dimsCm}cm` : ''}${req && !/^B3-n1-b3$/.test(req) ? ` ${req}` : ''}`
      const dims = dimsCm
        .split('x')
        .map((s) => Math.round(parseFloat(s) * 10))
        .filter((n) => n > 0)
      const boxInner = /^(Thùng|BB )/.test(name) && /KTLL/.test(name) && dims.length === 3
      const specBits = [
        dimsCm ? `${dimsCm} cm` : '',
        req,
        m2Txt && m2 == null ? m2Txt : '',
        isBar && m2 != null && priceM2
          ? `${String(m2).replace('.', ',')} m × ${priceM2.toLocaleString('vi-VN')} đ/m`
          : '',
      ].filter(Boolean)
      const noteBits = [`STT ${txt(row.getCell('A'))} tờ`]
      if (/Tổ ong/.test(name)) noteBits.push('đơn giá = m² × giá/m² × 1,15 (theo tờ)')
      if (isBar && price !== Math.round((m2 * priceM2) / 10) * 10)
        noteBits.push('đơn giá có cộng công bấm góc (theo tờ)')
      lines.push({
        row: r,
        name,
        matName,
        unit: unitOf(name),
        qty,
        price,
        paperAmount,
        product_code: g.code,
        qty_demand: num(row.getCell('D')),
        pcs_per_ctn: num(row.getCell('E')),
        open_style: txt(row.getCell('C')) || null,
        area_m2: !isBar && m2 != null ? m2 : null,
        price_per_m2: !isBar && priceM2 != null ? priceM2 : null,
        inner: boxInner ? dims : null,
        spec:
          specBits.join(' · ') +
          (boxInner ? ' (lọt lòng)' : /KTPB/.test(name) ? ' (phủ bì)' : ''),
        note: noteBits.join(' · '),
      })
    }
  return {
    ...o,
    lines,
    skipped,
    paperSubtotal: num(ws.getCell(o.subtotalCell)),
    paperDate: txt(ws.getCell('H3')),
  }
}

const fmt = (n) => Math.round(n).toLocaleString('vi-VN')
async function every(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}
const [mats, { data: sups }, { data: users }, { data: lsxs }, { data: done }] =
  await Promise.all([
    every('warehouse_materials', 'id, code, name'),
    sb.from('supply_suppliers').select('id, name, currency').eq('tax_no', SUPPLIER_TAX),
    sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
    sb
      .from('production_orders')
      .select('id, code')
      .in(
        'code',
        ORDERS.map((o) => o.lsx),
      ),
    sb
      .from('supply_purchase_orders')
      .select('code, supplier_doc_no')
      .in(
        'supplier_doc_no',
        ORDERS.map((o) => o.docNo),
      ),
  ])
const owner = users?.[0]
const sup = sups?.[0]
if (!owner) throw new Error('không thấy chị Nga')
if (sups?.length !== 1)
  throw new Error(`NCC MST ${SUPPLIER_TAX}: thấy ${sups?.length ?? 0}`)
const norm = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
const matByName = new Map(mats.map((m) => [norm(m.name), m]))

const plans = ORDERS.map(readOrder)
let bad = false
for (const p of plans) {
  const lsx = lsxs.find((l) => l.code === p.lsx)
  const had = done.find((d) => d.supplier_doc_no === p.docNo)
  const sub = p.lines.reduce((s, l) => s + l.qty * l.price, 0)
  console.log(
    `\n=== ${p.sheet} · ${p.docNo} · ${p.paperDate} · lệnh ${lsx?.code ?? '⚠ KHÔNG THẤY ' + p.lsx} · ${sup.name} · ${owner.name}${had ? ` · ĐÃ NẠP (${had.code}) — bỏ qua` : ''}`,
  )
  if (!lsx) bad = true
  for (const l of p.lines) {
    const a = l.qty * l.price
    const m = matByName.get(norm(l.matName))
    const off = l.paperAmount != null && Math.abs(a - l.paperAmount) > 0.5
    if (off) bad = true
    console.log(
      `  ${String(l.row).padStart(2)} ${(m ? m.code : '+ mới').padEnd(8)} ${l.matName.slice(0, 70).padEnd(70)} ${fmt(l.qty).padStart(7)} ${l.unit.padEnd(5)} × ${fmt(l.price).padStart(7)} = ${fmt(a).padStart(12)}${off ? ` ⚠ tờ ${fmt(l.paperAmount)}` : ''}`,
    )
  }
  for (const s of p.skipped) console.log(`  -- bỏ qua dòng ${s}`)
  const lech = sub - p.paperSubtotal
  if (Math.abs(lech) > 0.5) bad = true
  console.log(
    `  Tiền hàng ${fmt(sub)} · tờ ${fmt(p.paperSubtotal)} · lệch ${fmt(lech)} · VAT 8% → ${fmt(sub * 1.08)}`,
  )
}
if (bad) throw new Error('có chỗ lệch tờ / thiếu lệnh — dừng')
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ---------------------------------------------------------------- ghi -----
let no = 0
for (const m of mats) {
  const hit = String(m.code).match(/^BAO(\d+)$/)
  if (hit) no = Math.max(no, Number(hit[1]))
}
async function matId(l) {
  const had = matByName.get(norm(l.matName))
  if (had) return had.id
  const code = `BAO${String(++no).padStart(4, '0')}`
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({
      code,
      name: l.matName,
      unit: l.unit,
      group_name: GROUP,
      spec: l.spec || null,
      po_template: 'carton',
      needs_review: true,
      is_active: true,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error(`khai vật tư ${l.matName}: ${error.message}`)
  matByName.set(norm(data.name), data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return data.id
}

for (const p of plans) {
  if (done.find((d) => d.supplier_doc_no === p.docNo)) continue
  const lsx = lsxs.find((l) => l.code === p.lsx)
  const sub = p.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const ids = []
  for (const l of p.lines) ids.push(await matId(l))
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const note = [
    `Nạp từ file "BAO BÌ HIỆP HƯNG - Yotrio & Ibiza.xlsx" (sheet ${p.sheet}) ngày 25/09/2026.`,
    `Ngày trên đơn: ${ORDER_DATE}. Ghi trên đơn: ${p.onPaper}. Người liên hệ NCC: ${p.contact}.`,
    `Tiền hàng ${fmt(sub)} đ khớp tờ; đơn giá = ô ĐƠN GIÁ của tờ (m² × giá/m² làm tròn chục đồng từng thùng).`,
    'Hẹn giao 02/10/2026 = mốc xa của "5–7 ngày kể từ ngày gởi đơn, không tính lễ & CN".',
    p.skippedNote,
  ].join(' ')
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      production_order_id: lsx.id,
      supplier_id: sup.id,
      status: 'draft',
      template: 'carton',
      currency: sup.currency ?? 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      supplier_doc_no: p.docNo,
      expected_at: EXPECTED_AT,
      note,
      ...TERMS,
      signer_role: 'NGƯỜI LẬP',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`tạo đơn ${p.sheet}: ${pe.message}`)
  const payload = p.lines.map((l, i) => ({
    po_id: po.id,
    material_id: ids[i],
    qty_ordered: l.qty,
    unit_price: l.price,
    sort_order: i,
    price_basis: 'unit',
    qty_basis: 'manual',
    carton_basis: 'ctn',
    product_code: l.product_code,
    qty_demand: l.qty_demand,
    pcs_per_ctn: l.pcs_per_ctn,
    open_style: l.open_style,
    area_m2: l.area_m2,
    price_per_m2: l.price_per_m2,
    inner_l_mm: l.inner?.[0] ?? null,
    inner_w_mm: l.inner?.[1] ?? null,
    inner_h_mm: l.inner?.[2] ?? null,
    spec: l.spec || null,
    note: l.note,
  }))
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
  if (le) {
    await sb.from('supply_purchase_orders').delete().eq('id', po.id)
    throw new Error(`dòng đơn ${p.sheet}: ${le.message} — đã gỡ đầu đơn`)
  }
  console.log(`  ✓ ${po.code} (${p.docNo}) — ${payload.length} dòng · ${fmt(sub)} đ`)
}
