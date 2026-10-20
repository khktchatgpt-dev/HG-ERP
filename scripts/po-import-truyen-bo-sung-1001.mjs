// BỔ SUNG ĐƠN ANH TRUYỀN TỪ "Đơn gửi Việt (2).xlsx" + TÁCH MÃ NHÔM THEO CHIỀU DÀI — 01/10/2026.
//
//   node scripts/po-import-truyen-bo-sung-1001.mjs           # dò khô
//   node scripts/po-import-truyen-bo-sung-1001.mjs --apply   # ghi
//
// 1. File bản (2) có 10 tờ; 7 tờ đã nạp 30/09 (PO-2026-0111…0117, tiền khớp tờ).
//    3 tờ CHƯA CÓ → tạo NHÁP cho anh Truyền (chủ dự án chọn 01/10):
//      VietEco_Giga      → Việt Eco, 03/2026, lệnh 01/26-27 - GIGA, nhôm 5 dòng
//      Minhthang_laura01 → Minh Thắng, 02/2026, lệnh 01/26-27 - LAURA, ắc gai 8x31
//      Minh thang_mer07  → Minh Thắng, 01/2026, lệnh 07/26-27 - MX, ắc gai 8x70
//    Dòng mẫu sót "T-HOP-20X40X0.8 593 cây" (không giá) ở hai tờ Minh Thắng bị bỏ —
//    cùng cách lần nạp 30/09.
// 2. "Vật tư trùng tên nhưng khác quy cách → vật tư mới, tên kèm quy cách" (chủ dự
//    án 01/10: tách theo CHIỀU DÀI + ĐỘ DÀY, phạm vi = các đơn trong file này).
//    Độ dày đã nằm trong mã gốc (NH-0513 "vuông 20x20 T1.0"); cái gom chung là
//    CHIỀU DÀI CÂY CẮT SẴN. Mã gốc có ≥ 2 chiều dài trong phạm vi thì mỗi chiều
//    dài KHÁC chiều dài chuẩn của mã gốc (default_bar_length_m, trống = 6 m) thành
//    một mã mới "<tên gốc> dài 5.48m"; chiều dài chuẩn giữ mã gốc. Đơn đã nhập kho
//    (0116/0117) không có mã nào bị tách nên tồn kho không phải sửa.
import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const FILE = 'C:/Users/HP/Downloads/Đơn gửi Việt (2).xlsx'
const sb = await client(import.meta.url)
const round4 = (n) => Math.round(n * 10000) / 10000
const fmt = (n) => Math.round(n).toLocaleString('vi-VN')
const dmy = (d) => d.split('-').reverse().join('/')
const must = async (q, what) => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

const OWNER = await must(sb.from('users').select('id,name').eq('email', 'kehoach3@hoanggia.de').single(), 'anh Truyền') // prettier-ignore
const lsxRows = await must(sb.from('production_orders').select('id,code').in('code', ['01/26-27 - GIGA', '01/26-27 - LAURA', '07/26-27 - MX']), 'lệnh') // prettier-ignore
const LSX = Object.fromEntries(lsxRows.map((l) => [l.code, l.id]))
const SUP = {
  VEC: '55630a18-66ea-4c48-882f-5ff3dabd99a0',
  MT: '6923f995-e481-4847-a740-d4152050923e',
}

// Điều khoản: nhôm dùng câu mẫu nhôm (chủ dự án chốt 30/09 thay câu mẫu SẮT của tờ);
// tờ Minh Thắng (ắc sắt) chép nguyên văn khối ĐIỀU KHOẢN của tờ.
const Q_NHOM = [
  'Quy cách: Nhôm đã nhiệt luyện, bề mặt phẳng đẹp. Độ cứng và dung sai theo tiêu chuẩn đã thống nhất.',
  'Bề mặt: Phẳng, không móp méo, cong vênh, nứt, rỗ, ba via; không rỉ sét, dính keo/dầu mỡ.',
  'Đóng gói: 1 bó 6 cây trong túi nhựa, có nhãn ghi quy cách – số lượng; bốc xếp không làm biến dạng hàng.',
  'Phương thức giao nhận: Hoàng Gia kiểm tra sơ bộ số lượng cây, quy cách, kiểm tra xác xuất bề mặt Tạm nhập - Khi bóc nilon sử dụng phát hiện lỗi Ẩn/lỗi nặng sẽ thông báo cho bên bán và hai bên tích cực phối hợp giải quyết, khắc phục tốt nhất.',
  'Bảo hành – đổi trả: Khi phát hiện sai quy cách, không đạt chất lượng hoặc thiếu khối lượng ngoài dung sai → NCC đổi hàng/hoàn tiền, chi phí NCC chịu.',
  'Khối lượng thanh toán: Khối lượng thực nhận sau khi hai bên cân đối chứng và xác nhận.',
].join('\n')
const Q_TO = [
  'Quy cách: Đúng kích thước, độ dày cột E; thép CT3/SS400, mới 100%; cây dài 3 m ±5 mm. Dung sai ±3% theo TCVN 1656:1993 (la dẹt) & TCVN 6523:2006 (thép tấm).',
  'Bề mặt: Phẳng, không móp méo, cong vênh, nứt, rỗ, ba via; không rỉ sét, dính keo/dầu mỡ.',
  'Đóng gói: 1 bó 6 cây trong túi nhựa, có nhãn ghi quy cách – số lượng; bốc xếp không làm biến dạng hàng.',
  'Phương thức giao nhận: Hoàng Gia kiểm tra sơ bộ số lượng cây, quy cách, kiểm tra xác xuất bề mặt Tạm nhập - Khi bóc nilon sử dụng phát hiện lỗi Ẩn/lỗi nặng sẽ thông báo cho bên bán và hai bên tích cực phối hợp giải quyết, khắc phục tốt nhất.',
  'Bảo hành – đổi trả: Khi phát hiện sai quy cách, không đạt chất lượng hoặc thiếu khối lượng ngoài dung sai → NCC đổi hàng/hoàn tiền, chi phí NCC chịu.',
  'Khối lượng thanh toán: Khối lượng thực nhận sau khi hai bên cân đối chứng và xác nhận.',
].join('\n')
const INVOICE =
  'CO/CQ theo lô; phiếu cân ghi rõ quy cách – khối lượng. Hóa đơn GTGT điện tử hợp pháp, hợp lệ.'

// ───────── đọc 3 tờ ─────────
const wb = XLSX.read(fs.readFileSync(FILE))
const rows = (n) =>
  XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true })
const s = (v) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()

// Mã gốc theo KT trên tờ (giống luật nạp 30/09: mã định mức SP dùng / mã đã đặt).
const BASE = { 'hộp 20x30': 'NH-0079', 'hộp 20x45 mềm': 'NH-0135' }
const viet = rows('VietEco_Giga')
  .slice(13)
  .filter((r) => typeof r[0] === 'number' && Number(r[11]) > 0)
  .map((r) => {
    const kt = s(r[4])
    const base = BASE[kt.toLowerCase()]
    if (!base) throw new Error(`VietEco: chưa có mã cho "${kt}"`)
    const kgm = round4(Number(r[9]))
    const dai = Number(r[6])
    const sl = Number(r[7])
    return { sp: s(r[2]), ct: s(r[3]), kt, dvt: 'Cây', dai, sl, kgm, gia: Number(r[11]), base, kg: round4(kgm * dai * sl), tienTo: Number(r[12]) } // prettier-ignore
  })
const mtLine = (sheet, lsx) =>
  rows(sheet)
    .slice(13)
    .filter((r) => typeof r[0] === 'number' && Number(r[10]) > 0)
    .map((r) => ({ lsx: s(r[1]), sp: s(r[2]), ct: s(r[3]), kt: s(r[4]), dvt: s(r[5]), sl: Number(r[7]), gia: Number(r[10]), tienTo: Number(r[11]) })) // prettier-ignore

const NEW_ACC = {
  'ắc gai 8x31': { name: 'Ắc gai 8x31 taro gai 6x20', spec: '8x31 · taro gai 6x20' },
  'ắc gai 8x70': { name: 'Ắc gai 8x70 taro gai 6x20', spec: '8x70 · taro gai 6x20' },
}
const DON = [
  {
    sheet: 'VietEco_Giga',
    sup: SUP.VEC,
    lsx: '01/26-27 - GIGA',
    lsxGhi: "LSX GIGA STEVE'S",
    template: 'aluminium',
    vat: 10,
    so: '03/2026',
    ngay: '2026-09-30',
    leadDays: 1, // prettier-ignore
    quality: Q_NHOM,
    paper: { hang: 116_743_903, tt: 128_418_294 },
    lines: viet,
  },
  {
    sheet: 'Minhthang_laura01',
    sup: SUP.MT,
    lsx: '01/26-27 - LAURA',
    lsxGhi: 'LSX 01/2026-2027 HG-LAURA',
    template: 'accessory',
    vat: 8,
    so: '02/2026',
    ngay: '2026-10-01',
    leadDays: 1, // prettier-ignore
    quality: Q_TO,
    paper: { hang: 1_690_000, tt: 1_825_200 },
    lines: mtLine('Minhthang_laura01'),
    acc: 'ắc gai 8x31',
  },
  {
    sheet: 'Minh thang_mer07',
    sup: SUP.MT,
    lsx: '07/26-27 - MX',
    lsxGhi: 'LSX MERXX 07',
    template: 'accessory',
    vat: 8,
    so: '01/2026',
    ngay: '2026-10-01',
    leadDays: 1, // prettier-ignore
    quality: Q_TO,
    paper: { hang: 3_400_000, tt: 3_672_000 },
    lines: mtLine('Minh thang_mer07'),
    acc: 'ắc gai 8x70',
  },
]

// ───────── danh mục ─────────
const mats = []
for (let f = 0; ; f += 1000) {
  const data = await must(sb.from('warehouse_materials').select('*').order('code').range(f, f + 999), 'danh mục') // prettier-ignore
  mats.push(...data)
  if (data.length < 1000) break
}
const byCode = new Map(mats.map((m) => [m.code, m]))
const byId = new Map(mats.map((m) => [m.id, m]))
const maxNo = (p) =>
  mats.reduce((mx, { code }) => (code.startsWith(p) && /^\d+$/.test(code.slice(p.length)) ? Math.max(mx, Number(code.slice(p.length))) : mx), 0) // prettier-ignore
const next = {}
const newCode = (p) => {
  next[p] = (next[p] ?? maxNo(p)) + 1
  return `${p}${String(next[p]).padStart(4, '0')}`
}

// ───────── in 3 đơn mới ─────────
let bad = 0
for (const d of DON) {
  const dup = await must(sb.from('supply_purchase_orders').select('code').eq('supplier_id', d.sup).eq('supplier_doc_no', d.so).eq('production_order_id', LSX[d.lsx]), 'trùng') // prettier-ignore
  d.daCo = dup.length > 0
  d.hen = new Date(Date.parse(d.ngay + 'T00:00:00Z') + d.leadDays * 864e5)
    .toISOString()
    .slice(0, 10)
  d.hang = d.lines.reduce(
    (t, l) => t + (d.template === 'aluminium' ? l.kg : l.sl) * l.gia,
    0,
  )
  d.tt = d.hang + Math.round((d.hang * d.vat) / 100)
  const ok = Math.abs(d.hang - d.paper.hang) <= 5 && Math.abs(d.tt - d.paper.tt) <= 5
  if (!ok) bad++
  console.log(`\n══ ${d.sheet} → ${d.lsx} · ${d.template} · VAT ${d.vat}% · tờ ${dmy(d.ngay)} · số ${d.so} · hẹn ${dmy(d.hen)} · tiền hàng ${fmt(d.hang)} (tờ ${fmt(d.paper.hang)}) · tổng ${fmt(d.tt)} (tờ ${fmt(d.paper.tt)})${ok ? '' : '  ⟵ LỆCH'}${d.daCo ? '  [ĐÃ CÓ — bỏ qua]' : ''}`) // prettier-ignore
  for (const l of d.lines)
    console.log(`   ${l.sp} · ${l.ct} · ${l.kt} · ${l.dai ? `${l.dai}m · ` : ''}${l.sl} ${l.dvt}${l.kgm ? ` · ${l.kgm} kg/m = ${l.kg} kg` : ''} @${fmt(l.gia)}`) // prettier-ignore
}
if (bad) throw new Error('Lệch tiền với tờ — dừng')

// ───────── TÁCH MÃ THEO CHIỀU DÀI (phạm vi: đơn trong file) ─────────
const SCOPE = ['PO-2026-0111', 'PO-2026-0112', 'PO-2026-0113', 'PO-2026-0114', 'PO-2026-0115', 'PO-2026-0116', 'PO-2026-0117'] // prettier-ignore
const scopePos = await must(sb.from('supply_purchase_orders').select('id,code,status').in('code', SCOPE), 'đơn cũ') // prettier-ignore
const scopeLines = await must(sb.from('supply_purchase_order_lines').select('id,po_id,material_id,bar_length_m,weight_per_m,spec').in('po_id', scopePos.map((p) => p.id)), 'dòng cũ') // prettier-ignore
// Dòng giả cho 3 đơn mới (chưa có id) để gom chung.
const all = [
  ...scopeLines.map((l) => ({ ...l, po: scopePos.find((p) => p.id === l.po_id) })),
  ...DON.flatMap((d) => (d.template === 'aluminium' ? d.lines.map((l) => ({ id: null, ref: l, material_id: byCode.get(l.base).id, bar_length_m: l.dai, weight_per_m: l.kgm, po: { code: `(mới ${d.sheet})`, status: 'draft' } })) : [])), // prettier-ignore
].filter((l) => l.material_id && l.bar_length_m)
const groups = new Map()
for (const l of all) {
  if (!groups.has(l.material_id)) groups.set(l.material_id, [])
  groups.get(l.material_id).push(l)
}
const lenTxt = (n) => String(Number(n)).replace(/\.?0+$/, '') || '0'
const plan = [] // { base, len, code, name, lines[] }
console.log('\n══ TÁCH MÃ THEO CHIỀU DÀI ══')
for (const [mid, arr] of groups) {
  const lens = [...new Set(arr.map((l) => Number(l.bar_length_m)))].sort((a, b) => a - b)
  const base = byId.get(mid)
  const std = Number(base.default_bar_length_m ?? 6)
  // Tách khi mã gốc có >= 2 chiều dài, HOẶC một chiều dài khác chiều dài chuẩn của mã
  // gốc (cây cắt sẵn 5,57 m vẫn khác quy cách với cây chuẩn 6 m cùng tên).
  if (lens.length < 2 && lens[0] === std) continue
  console.log(
    `\n${base.code} ${base.name} [${base.spec ?? ''}] — chuẩn ${std} m · ${lens.length} chiều dài trong phạm vi`,
  )
  for (const len of lens) {
    const ls = arr.filter((l) => Number(l.bar_length_m) === len)
    const where = ls.map((l) => l.po.code.replace('PO-2026-', '')).join(', ')
    if (len === std) {
      console.log(`   ${lenTxt(len)} m → giữ ${base.code} (${where})`)
      continue
    }
    // Tờ ghi "mềm" mà tên mã gốc không có (NH-0135 "Nhôm hộp 20x45") → tên mã mới kèm "mềm".
    const soft = ls.some((l) => /mềm/i.test(l.ref?.kt ?? l.spec ?? '')) && !/mềm/i.test(base.name) // prettier-ignore
    const name = `${base.name}${soft ? ' mềm' : ''} dài ${lenTxt(len)}m`
    const again = mats.find((m) => m.name === name)
    const code = again?.code ?? newCode(base.code.replace(/\d+$/, ''))
    plan.push({ base, len, code, name, exists: !!again, lines: ls })
    console.log(
      `   ${lenTxt(len)} m → ${code} ${name}${again ? ' (đã có)' : ' [MỚI]'} (${where})`,
    )
  }
}
if (
  scopeLines.some(
    (l) =>
      plan.some((p) => p.lines.some((x) => x.id === l.id)) &&
      ['received', 'partial'].includes(scopePos.find((p) => p.id === l.po_id).status),
  )
)
  // prettier-ignore
  throw new Error('Có dòng của đơn đã nhập kho bị tách mã — phải sửa cả phiếu nhập, dừng')

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ───────── GHI ─────────
fs.mkdirSync('backups', { recursive: true })
const BK = fs.existsSync('backups/po-truyen-bo-sung-1001.json')
  ? 'backups/po-truyen-bo-sung-1001-lan2.json'
  : 'backups/po-truyen-bo-sung-1001.json'
fs.writeFileSync(BK, JSON.stringify({ at: new Date().toISOString(), scopeLines }, null, 1)) // prettier-ignore

// mã nhôm theo chiều dài
for (const p of plan) {
  if (!p.exists) {
    const b = p.base
    const row = await must(
      sb
        .from('warehouse_materials')
        .insert({
          code: p.code,
          name: p.name,
          unit: b.unit,
          group_name: b.group_name,
          sub_group: b.sub_group,
          po_template: b.po_template,
          material_grade: b.material_grade,
          finish: b.finish,
          kg_per_m: b.kg_per_m,
          spec: `${b.spec ?? ''} · dài ${lenTxt(p.len)}m`.replace(/^ · /, ''),
          default_bar_length_m: p.len,
          default_supplier_id: b.default_supplier_id,
          note: `Tách từ ${b.code} theo chiều dài cây cắt sẵn ${lenTxt(p.len)} m (01/10/2026 — chủ dự án: vật tư trùng tên khác quy cách thành mã riêng, tên kèm quy cách).`,
          needs_review: true,
          is_active: true,
        })
        .select('id,code,name')
        .single(),
      `vật tư ${p.name}`,
    )
    byCode.set(row.code, { ...row })
    console.log(`✓ vật tư ${row.code} ${row.name}`)
  }
  p.id = byCode.get(p.code).id
  for (const l of p.lines) {
    if (l.id)
      await must(sb.from('supply_purchase_order_lines').update({ material_id: p.id }).eq('id', l.id), 'đổi mã dòng') // prettier-ignore
    else l.ref.mat = p.id
  }
  console.log(`  ↳ ${p.lines.filter((l) => l.id).length} dòng cũ đổi sang ${p.code}`)
}

// mã ắc gai
for (const [k, n] of Object.entries(NEW_ACC)) {
  const again = mats.find((m) => m.name === n.name)
  if (again) {
    n.id = again.id
    continue
  }
  const row = await must(
    sb
      .from('warehouse_materials')
      .insert({
        code: newCode('PKN'),
        name: n.name,
        unit: 'Cái',
        group_name: 'Phụ kiện nội thất',
        po_template: 'accessory',
        spec: n.spec,
        default_supplier_id: SUP.MT,
        note: `Khai từ đơn Minh Thắng của anh Truyền 01/10/2026 (tờ ghi "${k} taro gai 6x20"). Khác PKN0386 "Ắc 8x31, Ren 6" / REN0034 "Ắc phi 8x70 ren trong 6" ở phần ren.`,
        needs_review: true,
        is_active: true,
      })
      .select('id,code,name')
      .single(),
    `vật tư ${n.name}`,
  )
  n.id = row.id
  console.log(`✓ vật tư ${row.code} ${row.name}`)
}

// 3 đơn nháp
for (const d of DON) {
  if (d.daCo) continue
  const code = await must(sb.rpc('next_doc_code', { p_kind: 'PO' }), 'cấp số')
  const po = await must(
    sb
      .from('supply_purchase_orders')
      .insert({
        code,
        supplier_id: d.sup,
        production_order_id: LSX[d.lsx],
        status: 'draft',
        template: d.template,
        currency: 'VND',
        vat_rate: d.vat,
        price_includes_vat: false,
        supplier_doc_no: d.so,
        expected_at: d.hen,
        terms_quality: d.quality,
        terms_invoice: INVOICE,
        terms_lead_time: 'Trong 01 ngày kể từ khi xác nhận đơn hàng.',
        signer_role: 'NGƯỜI ĐẶT HÀNG',
        created_by: OWNER.id,
        assigned_to: OWNER.id,
      })
      .select('id,code')
      .single(),
    `đơn ${d.sheet}`,
  )
  const lines = d.lines.map((l, i) =>
    d.template === 'aluminium'
      ? {
          po_id: po.id,
          material_id: l.mat ?? byCode.get(l.base).id,
          sort_order: i,
          qty_basis: 'manual',
          qty_ordered: l.sl,
          unit_price: l.gia,
          price_basis: 'unit2',
          qty2: l.kg,
          unit2: 'kg',
          weight_per_unit: round4(l.kgm * l.dai),
          weight_per_m: l.kgm,
          bar_length_m: l.dai,
          line_unit: 'Cây',
          line_name: `${l.sp} — ${l.ct}`,
          spec: l.kt,
          note: `${l.sp} · ${l.ct}`,
        }
      : {
          po_id: po.id,
          material_id: NEW_ACC[d.acc].id,
          sort_order: i,
          qty_basis: 'manual',
          qty_ordered: l.sl,
          unit_price: l.gia,
          price_basis: 'unit',
          spec: l.kt,
          note: `${l.sp} · ${l.ct}`,
        },
  )
  await must(sb.from('supply_purchase_order_lines').insert(lines), `dòng ${d.sheet}`)
  await must(
    sb.from('doc_notes').insert({
      doc_type: 'po',
      doc_id: po.id,
      author_id: OWNER.id,
      audience: 'internal',
      kind: 'note',
      body: [
        `Nạp từ file "Đơn gửi Việt (2).xlsx" (tờ ${d.sheet}) ngày 01/10/2026. Ngày trên tờ ${dmy(d.ngay)}, số ĐH ${d.so}, lệnh ghi "${d.lsxGhi}". Người đặt hàng ký: Trương Thanh Truyền.`,
        `Tiền hàng ${fmt(d.hang)} + VAT ${d.vat}% = ${fmt(d.tt)} đ (tờ ${fmt(d.paper.tt)}).`,
        `Hẹn giao ${dmy(d.hen)} = ngày tờ + 1 (điều khoản "Trong 01 ngày kể từ khi xác nhận") — sửa khi NCC hẹn ngày. Tờ ghi "Địa điểm giao hàng: Tại ….." (để trống).`,
        d.template === 'accessory'
          ? 'Bỏ dòng mẫu sót "Ghế 2. · Cụm mê/ thanh mê ngoài · T-HOP-20X40X0.8 · 593 cây" (không giá, có ở cả hai tờ Minh Thắng). Điều khoản 1 của tờ là câu mẫu SẮT — chép nguyên văn, nhờ anh Truyền soát.'
          : 'Mã nhôm theo chiều dài cây: mỗi chiều dài cắt sẵn một mã riêng (tên kèm "dài …m").',
        'Khối "Theo dõi tiến độ" trên tờ mang ngày đặt hàng 04/09 và Đợt 1 (31.08.26) của mẫu cũ — bỏ qua.',
      ].join(' '),
    }),
    'ghi chú',
  )
  console.log(
    `✓ ${po.code} ${d.sheet} — ${lines.length} dòng · ${fmt(d.hang)} đ (nháp, anh Truyền)`,
  )
}
console.log(`\nXONG — sao lưu dòng cũ: ${BK}`)
