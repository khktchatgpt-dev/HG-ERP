// NẠP 5 ĐƠN NHÔM CỦA ANH TRUYỀN — file "Đơn gửi Việt.xlsx" — 30/09/2026.
//
//   node scripts/po-import-truyen-nhom-0930.mjs            # dò khô
//   node scripts/po-import-truyen-nhom-0930.mjs --apply    # ghi
//
// 5 sheet = 5 đơn, người đặt ký tên Trương Thanh Truyền, ngày 28–29/09/2026:
//   Cattuong_Mer06  Cát Tường   nhôm tấm 3 li    LSX MERXX 06        → 06/26-27 - MX
//   cattuong_Giga   Cát Tường   nhôm tấm 4 li    LSX GIGA STEVE'S    → 01/26-27 - GIGA
//   Qminh_aruba     Quang Minh  19 dòng hộp/phi  LSX ARUBA 159/AK    → 03/26-27 - ROSCO
//   QMinh_Giga      Quang Minh  13 dòng hộp      LSX GIGA STEVE'S    → 01/26-27 - GIGA
//   Taiwan_Giga     Đoàn Gia    6 dòng hộp 15x35 LSX GIGA STEVE'S    → 01/26-27 - GIGA
//     (sheet tên "Taiwan" nhưng Kính gửi + địa chỉ là Nhôm Đoàn Gia — hồ sơ
//      NCC 546266d5 có tên ngắn "Taiwant", cùng NCC các đơn PO-2026-0077/0078)
//   ARUBA 159 = lệnh 03/26-27 - ROSCO (ghi chú lệnh: "LSX 03.26-27 HG-ROSCO (ARUBA 159)").
//
// CHỐT THEO TIỀN LỆ:
//   · NHÁP, giao + người tạo = anh Truyền (luật 01/09: đơn nạp từ file luôn ở nháp).
//   · VAT theo ĐÚNG TỜ (chốt 18/09 với đơn anh Truyền): tờ in ô 10% mà dòng TỔNG
//     THANH TOÁN bằng tiền hàng ⇒ ghi 0 (Cát Tường ×2, Đoàn Gia); tờ thật sự cộng
//     thuế ⇒ 10 (Quang Minh ×2).
//   · Hẹn giao = ngày trên tờ + số ngày ở điều khoản 6 (cách tính user duyệt 25/09),
//     vì gửi duyệt bắt buộc có hẹn giao.
//   · Ghi chú nội bộ vào Trao đổi (doc_notes internal) — po.note/line.note IN LÊN
//     PHIẾU NCC nên chỉ chứa chữ của tờ (Tên SP · Tên chi tiết).
//   · Dòng nhôm ghi kiểu PO-2026-0077: SL = cây, giá = đ/kg, qty2 = kg/m × dài × SL
//     (tròn 4 lẻ như deriveLine), price_basis unit2.
//
// CHỌN MÃ VẬT TƯ (danh mục có nhiều mã trùng nghĩa cho cùng quy cách — hộp 20x40x1
// có 5 mã). Định mức SP của cả 3 lệnh đều CHƯA có dòng nhôm nào, nên không khớp
// theo định mức được. Thứ tự ưu tiên:
//   1. mã anh Truyền đã đặt cùng quy cách (PO-2026-0077/0078) — hàng về chung một mã;
//   2. mã được định mức SP dùng nhiều nhất (mã "gốc" sau các đợt gộp trùng);
//   3. tờ ghi "mềm" thì lấy mã nhôm mềm/ủ mềm;
//   4. không có gì ở trên thì kg/m gần nhất + số lần đặt trong sổ cũ.
// Tờ Aruba không ghi độ dày — kg/m trên tờ khớp ống/hộp dày 1 li nên lấy mã 1 li.
import { readFileSync } from 'node:fs'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const FILE = 'C:/Users/HP/Downloads/Đơn gửi Việt.xlsx'
const FILE_NAME = 'Đơn gửi Việt.xlsx'
const OWNER_EMAIL = 'kehoach3@hoanggia.de' // Trương Thanh Truyền

const SUP = {
  CT: 'ae39ff5b-b00e-461c-9be0-04cea2f45966', // CÔNG TY TNHH XUẤT NHẬP KHẨU CÁT TƯỜNG
  QM: '323888a2-1d5d-4c27-aca7-a4196cf24560', // CÔNG TY TNHH NHÔM THÉP QUANG MINH
  DG: '546266d5-42fb-41d8-86c7-b5dc9079e522', // Công Ty TNHH Nhôm Đoàn Gia (Taiwant)
}

// Mã vật tư theo quy cách trên tờ (khoá = KT chuẩn hoá + độ dày nếu tờ có ghi).
const MA = {
  'nhôm tấm 3x1200x2400': [
    'NH-0110',
    'mã tấm 3 li khổ 1200x2400 duy nhất theo ĐVT Tấm (cùng họ NH-0077 anh Truyền đặt ở PO-2026-0079)',
  ],
  'nhôm tấm 4x1200x2400': ['NH-0051', 'mã tấm 4 li khổ 1200x2400 duy nhất theo ĐVT Tấm'],
  'hộp 10x20': ['NH-0067', '"Nhôm hộp 10x20x1li" — mã định mức SP dùng (7 dòng)'],
  'hộp 20x30': ['NH-0079', '"Nhôm hộp 20x30x1li" — mã định mức SP dùng'],
  'hộp 20x40': [
    'NH-0127',
    '"Nhôm hộp 20x40x1.0" — anh Truyền đã đặt mã này ở PO-2026-0078',
  ],
  'hộp 20x40 t1': [
    'NH-0127',
    '"Nhôm hộp 20x40x1.0" — anh Truyền đã đặt mã này ở PO-2026-0078',
  ],
  'phi 8': ['NH-0322', '"Nhôm ø8 T1.0" — mã ống ø8 dày 1 li duy nhất, kg/m 0,0597'],
  'phi 14': ['NH-0318', '"Nhôm phi 14x1li" — mã định mức SP dùng, kg/m 0,11 khớp'],
  'phi 16': [
    'NH-0168',
    '"Nhôm phi 16x1" — anh Truyền đã đặt (PO-2026-0078) + 33 dòng định mức',
  ],
  'phi 19': ['NH-0031', '"Nhôm phi 19 x1li" — mã gốc sau gộp trùng, 11 dòng định mức'],
  'phi 22': ['NH-0014', '"Nhôm phi 22x1li" — mã gốc sau gộp trùng, 24 dòng định mức'],
  'phi 25': [
    'NH-0003',
    '"Nhôm phi 25x1li" — anh Truyền đã đặt (PO-2026-0077) + 62 dòng định mức',
  ],
  'vuông 14': ['NH-0033', '"Nhôm vuông 14x1li" — mã định mức SP dùng'],
  'vuông 16': ['NH-0069', '"Nhôm vuông 16x1li" — mã định mức SP dùng (12 dòng)'],
  'vuông 20': [
    'NH-0513',
    '"Nhôm vuông 20 x 20 T1.0" — anh Truyền đã đặt 6 dòng mã này (PO-2026-0077/0078)',
  ],
  'vuông 20x20 t1': [
    'NH-0513',
    '"Nhôm vuông 20 x 20 T1.0" — anh Truyền đã đặt 6 dòng mã này (PO-2026-0077/0078)',
  ],
  'hộp 20x80 mềm t1.2': ['NH-0267', '"Nhôm hộp 20x80x1.2li Ủ mềm" — tờ ghi "mềm"'],
  'vuông 40x40 t1.2': [
    'NH-0041',
    '"Nhôm vuông 40x1.2li" — kg/m 0,502 gần tờ (0,51) hơn NH-0536 (0,47); 13 lần đặt trong sổ cũ',
  ],
  'hộp 25x50 mềm t1.2': ['NH-0266', '"Hộp 25x50x1.2li Nhôm mềm" — tờ ghi "mềm"'],
  'hộp 15x35 t1': [
    'NH-0143',
    '"Nhôm hộp 15x35x1.0" — anh Truyền đã đặt mã này ở PO-2026-0078',
  ],
}

// Điều khoản chung cả 5 tờ (mục "ĐIỀU KHOẢN & YÊU CẦU"), chép nguyên văn.
const QUALITY = [
  // Điều khoản 1 trên tờ là câu mẫu SẮT ("thép CT3/SS400… cây dài 3 m") — user bảo thay bằng câu mẫu nhôm (PO_TEMPLATE_META.aluminium) 30/09.
  'Quy cách: Nhôm đã nhiệt luyện, bề mặt phẳng đẹp. Độ cứng và dung sai theo tiêu chuẩn đã thống nhất.',
  'Bề mặt: Phẳng, không móp méo, cong vênh, nứt, rỗ, ba via; không rỉ sét, dính keo/dầu mỡ.',
  'Đóng gói: 1 bó 6 cây trong túi nhựa, có nhãn ghi quy cách – số lượng; bốc xếp không làm biến dạng hàng.',
  'Phương thức giao nhận: Hoàng Gia kiểm tra sơ bộ số lượng cây, quy cách, kiểm tra xác xuất bề mặt Tạm nhập - Khi bóc nilon sử dụng phát hiện lỗi Ẩn/lỗi nặng sẽ thông báo cho bên bán và hai bên tích cực phối hợp giải quyết, khắc phục tốt nhất.',
  'Bảo hành – đổi trả: Khi phát hiện sai quy cách, không đạt chất lượng hoặc thiếu khối lượng ngoài dung sai → NCC đổi hàng/hoàn tiền, chi phí NCC chịu.',
  'Khối lượng thanh toán: Khối lượng thực nhận sau khi hai bên cân đối chứng và xác nhận.',
].join('\n')
const INVOICE =
  'CO/CQ theo lô; phiếu cân ghi rõ quy cách – khối lượng. Hóa đơn GTGT điện tử hợp pháp, hợp lệ.'

/* Bố cục từng sheet. Cột: sp · ct (chi tiết) · kt · dvt · dai · day (độ dày) · sl ·
   kgm · kg (tổng kg — tấm) · gia · tien. `rows` = vùng dòng hàng; dòng không có
   đơn giá bị bỏ (dòng mẫu sót của template). */
const DON = [
  {
    sheet: 'Cattuong_Mer06',
    sup: SUP.CT,
    lsx: '06/26-27 - MX',
    template: 'metal_kg',
    vat: 0,
    so: '03/2026',
    ngay: '2026-09-29',
    leadDays: 2,
    noiGiao: 'Tại Kho bên bán',
    lsxGhi: 'LSX MERXX 06',
    rows: [14, 14],
    col: { sp: 'C', ct: 'D', kt: 'E', dvt: 'F', sl: 'H', kg: 'K', gia: 'L', tien: 'M' },
    tongTo: { hang: 'M15', tt: 'M18' },
  },
  {
    sheet: 'cattuong_Giga',
    sup: SUP.CT,
    lsx: '01/26-27 - GIGA',
    template: 'metal_kg',
    vat: 0,
    so: '02/2026',
    ngay: '2026-09-29',
    leadDays: 2,
    noiGiao: 'Tại Kho bên bán',
    lsxGhi: "LSX GIGA STEVE'S",
    rows: [14, 14],
    col: { sp: 'C', ct: 'D', kt: 'E', dvt: 'F', sl: 'H', kg: 'K', gia: 'L', tien: 'M' },
    tongTo: { hang: 'M15', tt: 'M18' },
  },
  {
    sheet: 'Qminh_aruba',
    sup: SUP.QM,
    lsx: '03/26-27 - ROSCO',
    template: 'aluminium',
    vat: 10,
    so: null,
    ngay: '2026-09-28',
    leadDays: 1,
    noiGiao: null,
    lsxGhi: 'LSX ARUBA 159/AK',
    rows: [14, 32],
    col: {
      sp: 'C',
      ct: 'D',
      kt: 'E',
      dvt: 'F',
      dai: 'G',
      sl: 'H',
      kgm: 'J',
      gia: 'L',
      tien: 'M',
    },
    tongTo: { hang: 'M33', tt: 'M36' },
  },
  {
    sheet: 'QMinh_Giga',
    sup: SUP.QM,
    lsx: '01/26-27 - GIGA',
    template: 'aluminium',
    vat: 10,
    so: '04/2026',
    ngay: '2026-09-29',
    leadDays: 10,
    noiGiao: 'Tại Kho bên bán',
    lsxGhi: "LSX GIGA STEVE'S",
    rows: [14, 27],
    col: {
      sp: 'C',
      ct: 'D',
      kt: 'E',
      dvt: 'F',
      dai: 'G',
      day: 'H',
      sl: 'I',
      kgm: 'J',
      gia: 'L',
      tien: 'M',
    },
    tongTo: { hang: 'M28', tt: 'M31' },
  },
  {
    sheet: 'Taiwan_Giga',
    sup: SUP.DG,
    lsx: '01/26-27 - GIGA',
    template: 'aluminium',
    vat: 0,
    so: '04/2026',
    ngay: '2026-09-29',
    leadDays: 10,
    noiGiao: 'Tại Kho bên bán',
    lsxGhi: "LSX GIGA STEVE'S",
    rows: [14, 20],
    col: {
      sp: 'C',
      ct: 'D',
      kt: 'E',
      dvt: 'F',
      dai: 'G',
      day: 'H',
      sl: 'I',
      kgm: 'J',
      gia: 'L',
      tien: 'M',
    },
    tongTo: { hang: 'M21', tt: 'M24' },
  },
]

const round4 = (n) => Math.round(n * 10000) / 10000
const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const dmy = (iso) => iso.split('-').reverse().join('/')
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const cellVal = (ws, addr) => {
  const v = ws.getCell(addr).value
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result ?? null
    if (v.richText) return v.richText.map((t) => t.text).join('')
  }
  return v ?? null
}
const text = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const num = (v) => (v == null || v === '' ? null : Number(v))

function keyOf(kt, day) {
  let k = text(kt)
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s*x\s*/g, 'x')
    .replace(/\s*\|\s*/g, ' ')
  if (day != null) k += ` t${String(Number(day)).replace(/\.0$/, '')}`
  return k
}

// ── đọc file ────────────────────────────────────────────────────────────────
const ExcelJS = (await import('exceljs')).default
const wb = new ExcelJS.Workbook()
await wb.xlsx.load(readFileSync(FILE))

for (const d of DON) {
  const ws = wb.getWorksheet(d.sheet)
  if (!ws) throw new Error(`thiếu sheet ${d.sheet}`)
  d.lines = []
  d.boQua = []
  for (let r = d.rows[0]; r <= d.rows[1]; r++) {
    const g = (k) => (d.col[k] ? cellVal(ws, `${d.col[k]}${r}`) : null)
    const gia = num(g('gia'))
    if (!gia) {
      if (text(g('kt')) || text(g('ct')) || text(g('sp')))
        d.boQua.push(
          `dòng ${r} (${text(g('sp'))} · ${text(g('ct'))} · ${text(g('kt')) || '—'} · ${fmt(num(g('sl')) ?? 0)} ${text(g('dvt'))}) — không có đơn giá, không nằm trong tổng tờ`,
        )
      continue
    }
    const sl = num(g('sl'))
    const l = {
      r,
      sp: text(g('sp')),
      ct: text(g('ct')),
      kt: text(g('kt')),
      dvt: text(g('dvt')) || 'Cây',
      dai: num(g('dai')),
      day: num(g('day')),
      sl,
      gia,
      tienTo: num(g('tien')),
    }
    if (d.template === 'aluminium') {
      // Ô weight_per_m của DB chỉ giữ 4 số lẻ: tờ ghi 0,24167 thì DB lưu 0,2417.
      // Tính kg từ số ĐÃ LÀM TRÒN để qty2 trùng deriveLine — không thì ai mở dòng
      // ra bấm lưu là tổng kg tự nhảy (PO-2026-0113, hộp 20x30: +853 đ so với tờ).
      l.kgm = round4(num(g('kgm')))
      l.kgCay = round4(l.kgm * l.dai)
      l.kg = round4(l.kgm * l.dai * sl) // cùng công thức deriveLine('aluminium')
    } else {
      l.kgTo = num(g('kg'))
      l.kgCay = round4(l.kgTo / sl)
      l.kg = round4(l.kgCay * sl) // deriveLine('metal_kg')
    }
    l.tien = l.kg * gia
    l.key = keyOf(l.kt, l.day)
    d.lines.push(l)
  }
  d.hangTo = num(cellVal(ws, d.tongTo.hang))
  d.ttTo = num(cellVal(ws, d.tongTo.tt))
}

// ── đối chiếu danh mục / lệnh / người ──────────────────────────────────────
const sb = await client(import.meta.url)
const codes = [...new Set(Object.values(MA).map(([c]) => c))]
const [{ data: mats, error: me }, { data: lsxs }, { data: users }] = await Promise.all([
  sb
    .from('warehouse_materials')
    .select('id, code, name, unit, is_active')
    .in('code', codes),
  sb
    .from('production_orders')
    .select('id, code')
    .in('code', [...new Set(DON.map((d) => d.lsx))]),
  sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
])
if (me) throw me
const owner = users?.[0]
if (!owner) throw new Error('không thấy tài khoản anh Truyền')
const matBy = new Map(mats.map((m) => [m.code, m]))
const lsxBy = new Map(lsxs.map((l) => [l.code, l]))

let loi = 0
for (const d of DON) {
  d.lsxId = lsxBy.get(d.lsx)?.id
  if (!d.lsxId) {
    console.log(`✗ ${d.sheet}: không thấy lệnh ${d.lsx}`)
    loi++
  }
  for (const l of d.lines) {
    const hit = MA[l.key]
    if (!hit) {
      console.log(`✗ ${d.sheet} dòng ${l.r}: chưa có mã cho "${l.key}"`)
      loi++
      continue
    }
    const m = matBy.get(hit[0])
    if (!m || !m.is_active) {
      console.log(`✗ ${d.sheet} dòng ${l.r}: mã ${hit[0]} không có / đã ngưng`)
      loi++
      continue
    }
    l.mat = m
    l.vi = hit[1]
  }
}
if (loi) process.exit(1)

// Đã nạp chưa — dấu nằm trong Trao đổi của đơn.
const dau = (d) => `Nạp từ file "${FILE_NAME}" (sheet ${d.sheet})`
const { data: daNap } = await sb
  .from('doc_notes')
  .select('doc_id, body')
  .eq('doc_type', 'po')
  .ilike('body', `%${FILE_NAME}%`)
for (const d of DON)
  d.daCo = (daNap ?? []).find((n) => n.body.includes(dau(d)))?.doc_id ?? null

// ── in bảng ────────────────────────────────────────────────────────────────
let tongHang = 0
let tongTT = 0
for (const d of DON) {
  const hang = Math.round(d.lines.reduce((s, l) => s + l.tien, 0))
  const thue = Math.round((hang * d.vat) / 100)
  d.hang = hang
  d.tt = hang + thue
  d.hen = addDays(d.ngay, d.leadDays)
  tongHang += hang
  tongTT += d.tt
  console.log(
    `\n══ ${d.sheet} → ${d.lsx} · ${d.template} · VAT ${d.vat}% · tờ ngày ${dmy(d.ngay)} · số ${d.so ?? '(trống)'} · hẹn giao ${dmy(d.hen)}${d.daCo ? '  [ĐÃ NẠP — bỏ qua]' : ''}`,
  )
  for (const l of d.lines)
    console.log(
      `  ${String(l.r).padStart(2)} ${l.mat.code.padEnd(8)} ${l.kt.padEnd(22).slice(0, 22)} ${(l.day ? 'T' + l.day : '').padEnd(4)}` +
        `${fmt(l.sl).padStart(5)} ${l.dvt.padEnd(4)} × ${fmt(l.kgCay).padStart(7)} kg = ${fmt(l.kg).padStart(9)} kg × ${fmt(l.gia)} = ${fmt(Math.round(l.tien)).padStart(11)}` +
        (Math.abs(l.tien - l.tienTo) >= 1 ? `  (tờ ${fmt(Math.round(l.tienTo))})` : ''),
    )
  for (const b of d.boQua) console.log(`  – bỏ ${b}`)
  console.log(
    `  Tiền hàng ${fmt(hang)} (tờ ${fmt(Math.round(d.hangTo))}, lệch ${fmt(hang - Math.round(d.hangTo))}) · thuế ${fmt(thue)} · tổng ${fmt(d.tt)} (tờ ${fmt(Math.round(d.ttTo))})`,
  )
}
console.log(`\nCả 5 đơn: tiền hàng ${fmt(tongHang)} · tổng thanh toán ${fmt(tongTT)}`)
console.log('\nMã vật tư đã chọn:')
for (const [k, [c, vi]] of Object.entries(MA))
  if (DON.some((d) => d.lines.some((l) => l.key === k)))
    console.log(`  ${k.padEnd(22)} ${c}  ${vi}`)

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ── ghi ─────────────────────────────────────────────────────────────────────
console.log('\n── GHI ──')
for (const d of DON) {
  if (d.daCo) {
    console.log(`  = ${d.sheet}: đã nạp trước đó, bỏ qua`)
    continue
  }
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      supplier_id: d.sup,
      production_order_id: d.lsxId,
      status: 'draft',
      template: d.template,
      currency: 'VND',
      vat_rate: d.vat,
      price_includes_vat: false,
      supplier_doc_no: d.so,
      expected_at: d.hen,
      terms_quality: QUALITY,
      terms_delivery_place: d.noiGiao,
      terms_invoice: INVOICE,
      terms_lead_time: `Trong ${String(d.leadDays).padStart(2, '0')} ngày kể từ khi xác nhận đơn hàng.`,
      signer_role: 'NGƯỜI ĐẶT HÀNG',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`${d.sheet}: ${pe.message}`)

  const rows = d.lines.map((l, i) => ({
    po_id: po.id,
    material_id: l.mat.id,
    sort_order: i,
    qty_basis: 'manual',
    qty_ordered: l.sl,
    unit_price: l.gia,
    price_basis: 'unit2',
    qty2: l.kg,
    unit2: 'kg',
    weight_per_unit: l.kgCay,
    line_unit: l.dvt.charAt(0).toUpperCase() + l.dvt.slice(1),
    line_name: [l.sp, l.ct].filter(Boolean).join(' — ') || null,
    spec: l.day ? `${l.kt} T${l.day}` : l.kt,
    ...(d.template === 'aluminium'
      ? { weight_per_m: l.kgm, bar_length_m: l.dai }
      : { dimension_text: l.kt }),
    // Ô Ghi chú dòng IN LÊN PHIẾU — chỉ chữ của tờ (Tên SP · Tên chi tiết).
    note: [l.sp, l.ct].filter(Boolean).join(' · ') || null,
  }))
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(rows)
  if (le) {
    await sb.from('supply_purchase_orders').delete().eq('id', po.id)
    throw new Error(`${d.sheet} dòng: ${le.message} — đã gỡ đầu đơn`)
  }

  const lechTo = d.hang - Math.round(d.hangTo)
  const body = [
    `${dau(d)} ngày 30/09/2026. Ngày trên tờ: ${dmy(d.ngay)}. Số ĐH trên tờ: ${d.so ?? '(để trống)'}. Lệnh ghi trên tờ: "${d.lsxGhi}". Người đặt hàng ký tên: Trương Thanh Truyền.`,
    d.vat
      ? `Tiền hàng ${fmt(d.hang)} + VAT ${d.vat}% = ${fmt(d.tt)} đ (tờ ${fmt(Math.round(d.ttTo))}).`
      : `Tiền hàng ${fmt(d.hang)} đ. Tờ in ô thuế 10% nhưng không tính tiền thuế, dòng TỔNG THANH TOÁN bằng tiền hàng ⇒ ghi VAT 0 (cùng cách các đơn 18/09). NCC xuất hoá đơn 10% thì sửa VAT, tổng thành ${fmt(Math.round(d.hang * 1.1))} đ.`,
    lechTo
      ? `Lệch tờ ${fmt(lechTo)} đ: hệ thống làm tròn tổng kg mỗi dòng 4 số lẻ, tờ để nguyên.`
      : '',
    `Hẹn giao ${dmy(d.hen)} = ngày trên tờ + ${d.leadDays} ngày (điều khoản 6 tính từ khi NCC xác nhận — sửa lại khi NCC xác nhận ngày).`,
    d.noiGiao
      ? ''
      : 'Điều khoản 5 "Địa điểm giao hàng: Tại …" để trống trên tờ — điền trước khi gửi.',
    'Điều khoản 1 trên tờ là câu của mẫu sắt ("thép CT3/SS400… cây dài 3 m… thép tấm") — đã thay bằng câu mẫu nhôm 30/09/2026.',
    ...d.boQua.map((b) => `Không nạp ${b}.`),
    'Chọn mã vật tư:',
    ...d.lines.map(
      (l, i) =>
        `· Dòng ${i + 1} (${l.mat.code}) ${l.kt}${l.day ? ' T' + l.day : ''}: ${l.vi}`,
    ),
  ]
    .filter(Boolean)
    .join('\n')
  const { error: ne } = await sb.from('doc_notes').insert({
    doc_type: 'po',
    doc_id: po.id,
    author_id: owner.id,
    audience: 'internal',
    body,
  })
  if (ne) throw new Error(`${po.code} Trao đổi: ${ne.message}`)
  d.po = po
  console.log(`  + ${po.code}  ${d.sheet.padEnd(15)} ${rows.length} dòng  ${fmt(d.tt)} đ`)
}

// ── đọc lại từ DB ───────────────────────────────────────────────────────────
console.log('\n── ĐỌC LẠI ──')
for (const d of DON) {
  if (!d.po) continue
  const { data: ln } = await sb
    .from('supply_purchase_order_lines')
    .select('qty_ordered, unit_price, qty2, price_basis')
    .eq('po_id', d.po.id)
  const hang = Math.round(
    ln.reduce(
      (s, l) =>
        s +
        Number(l.price_basis === 'unit2' ? l.qty2 : l.qty_ordered) * Number(l.unit_price),
      0,
    ),
  )
  console.log(
    `  ${hang === d.hang ? '✓' : '✗'} ${d.po.code} ${ln.length} dòng · tiền hàng ${fmt(hang)}`,
  )
}
