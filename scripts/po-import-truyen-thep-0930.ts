/**
 * NẠP 2 ĐƠN THÉP ĐÃ MUA VỀ CỦA ANH TRUYỀN — "Đơn gửi Việt.xlsx" (bản 10:08 30/09/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-truyen-thep-0930.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-truyen-thep-0930.ts --apply   # ghi
 *
 * Hai sheet thêm vào file sau đợt 5 đơn nhôm (po-import-truyen-nhom-0930.mjs):
 *   Visa_mer07     Thép Visa   2 dòng  giá THEO CÂY   LSX MERXX 07 → 07/26-27 - MX
 *   Kimphat_Mer07  Kim Phát    2 dòng  giá theo KG    LSX MERXX 07 → 07/26-27 - MX
 * Tờ ngày 25/09/2026. User (30/09): "đã mua về, đã về ngày 27/09".
 *
 * NÊN KHÁC 5 ĐƠN NHÔM Ở TRẠNG THÁI: không để nháp. Đơn → 'ordered' (ngày trên tờ,
 * không ghi người duyệt — hệ thống không có dấu vết ai ký, giống các đơn anh
 * Truyền nạp 18/09), rồi lập PHIẾU NHẬP ngày 27/09 bằng ĐÚNG `stockService.
 * createReceiptDoc` — để giá vốn, trạng thái đơn (→ received) và đợt giao đi
 * đúng đường app. Script không nạp `@/events/register` nên không phát thông báo.
 *
 * TIỀN:
 *   · Visa: tờ ghi "Đơn giá (VND/cây)", thành tiền = SL × giá/cây ⇒ price_basis
 *     'unit' (giống PO-2026-0073 của Visa), kg/cây vẫn ghi để in tổng kg.
 *   · Kim Phát: cột đơn giá ghi "/cây" nhưng thành tiền = TỔNG KG gõ tay (549, 320
 *     — không phải 151×3,64) × giá/kg (22.000, 23.540 = đơn giá ÷ kg/cây). Tức
 *     NCC tính theo kg thực. Ghi giá/kg, kg/cây = kg tờ ÷ SL (4 lẻ) để qty2 trùng
 *     deriveLine; lệch tờ vài chục đồng do làm tròn — ghi trong Trao đổi.
 *   · VAT 0: tờ in ô 10% nhưng không tính tiền thuế (tiền lệ 18/09).
 *
 * MÃ: ST-0206 (hộp 20x40x1.0 — anh Truyền đã đặt ở PO-2026-0068), ST-0070 (hộp
 * 15x35x8dem). Vuông 25x25x1.0 và oval 17x26x0.85 chỉ có mã ĐVT KG (SAT0385,
 * SAT0426) — nhận 300 cây vào mã tính theo kg là sai tồn ⇒ mở mã ST- mới ĐVT Cây,
 * needs_review.
 */
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { db } from '@/server/db'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { deriveLine } from '@/lib/po-template'
import { poLineAmount } from '@/lib/po-line'
import type { User } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const FILE = 'C:/Users/HP/Downloads/Đơn gửi Việt.xlsx'
const FILE_NAME = 'Đơn gửi Việt.xlsx'
const OWNER_EMAIL = 'kehoach3@hoanggia.de' // Trương Thanh Truyền
const RECEIVER_EMAIL = 'admin@hg.com' // Quản trị viên — ghi hộ, như PNK-2026-0054
const LSX = '07/26-27 - MX'
const NGAY_TO = '2026-09-25'
const NGAY_VE = '2026-09-27'

const MA: Record<string, { code: string; vi: string } | { moi: NewMat; vi: string }> = {
  'hộp 20x40x1.0': {
    code: 'ST-0206',
    vi: '"Thép hộp vuông 20x40x1.0" — anh Truyền đã đặt ở PO-2026-0068',
  },
  'vuông 25x1.0': {
    moi: { name: 'Thép vuông 25x25x1.0', spec: '25x25x1.0', kg: 4.58 },
    vi: 'mở mã mới ĐVT Cây — danh mục chỉ có SAT0385 (mạ kẽm, ĐVT Kg)',
  },
  'hộp 15x35x0.8': {
    code: 'ST-0070',
    vi: '"Sắt hộp 15x35x8dem" — mã ĐVT Cây duy nhất của quy cách này',
  },
  'oval 17x26x0.85': {
    moi: { name: 'Thép oval 17x26x0.85', spec: '17x26x0.85', kg: 3.77 },
    vi: 'mở mã mới ĐVT Cây — danh mục chỉ có SAT0426 (mạ kẽm, ĐVT Kg)',
  },
}
type NewMat = { name: string; spec: string; kg: number }

const QUALITY = [
  'Quy cách: Đúng kích thước, độ dày cột E; thép CT3/SS400, mới 100%; cây dài 3 m ±5 mm. Dung sai ±3% theo TCVN 1656:1993 (la dẹt) & TCVN 6523:2006 (thép tấm).',
  'Bề mặt: Phẳng, không móp méo, cong vênh, nứt, rỗ, ba via; không rỉ sét, dính keo/dầu mỡ.',
  'Đóng gói: 1 bó 6 cây trong túi nhựa, có nhãn ghi quy cách – số lượng; bốc xếp không làm biến dạng hàng.',
  'Phương thức giao nhận: Hoàng Gia kiểm tra sơ bộ số lượng cây, quy cách, kiểm tra xác xuất bề mặt Tạm nhập - Khi bóc nilon sử dụng phát hiện lỗi Ẩn/lỗi nặng sẽ thông báo cho bên bán và hai bên tích cực phối hợp giải quyết, khắc phục tốt nhất.',
  'Bảo hành – đổi trả: Khi phát hiện sai quy cách, không đạt chất lượng hoặc thiếu khối lượng ngoài dung sai → NCC đổi hàng/hoàn tiền, chi phí NCC chịu.',
  'Khối lượng thanh toán: Khối lượng thực nhận sau khi hai bên cân đối chứng và xác nhận.',
].join('\n')
const INVOICE =
  'CO/CQ theo lô; phiếu cân ghi rõ quy cách – khối lượng. Hóa đơn GTGT điện tử hợp pháp, hợp lệ.'

type Don = {
  sheet: string
  sup: string
  so: string | null
  theoKg: boolean
  lines: Line[]
  hangTo: number
  poId?: string
  poCode?: string
}
type Line = {
  r: number
  sp: string
  ct: string
  kt: string
  dvt: string
  dai: number
  sl: number
  kgCayTo: number
  kgTo: number
  giaTo: number
  tienTo: number
  key: string
  wpu: number
  gia: number
  basis: 'unit' | 'unit2'
  qty2: number
  tien: number
  matId?: string
  matCode?: string
  vi?: string
}

const DON: Don[] = [
  {
    sheet: 'Visa_mer07',
    sup: 'e8a22500-0763-418c-bcd3-707b65b58be7',
    so: null,
    theoKg: false,
    lines: [],
    hangTo: 0,
  },
  {
    sheet: 'Kimphat_Mer07',
    sup: '4df1e369-c973-4047-9218-550e778f4170',
    so: '03/2026',
    theoKg: true,
    lines: [],
    hangTo: 0,
  },
]

const round4 = (n: number) => Math.round(n * 10000) / 10000
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const text = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
function val(ws: ExcelJS.Worksheet, addr: string): unknown {
  const v = ws.getCell(addr).value as unknown
  if (v && typeof v === 'object' && 'result' in (v as object))
    return (v as { result: unknown }).result
  return v
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(readFileSync(FILE) as unknown as ArrayBuffer)
  for (const d of DON) {
    const ws = wb.getWorksheet(d.sheet)
    if (!ws) throw new Error(`thiếu sheet ${d.sheet}`)
    for (let r = 14; r <= 15; r++) {
      const sl = Number(val(ws, `H${r}`))
      const kgCayTo = Number(val(ws, `J${r}`))
      const kgTo = Number(val(ws, `K${r}`))
      const giaTo = Number(val(ws, `L${r}`))
      const tienTo = Number(val(ws, `M${r}`))
      const kt = text(val(ws, `E${r}`))
      const key = kt.toLowerCase().normalize('NFC')
      // Kim Phát: giá/kg = thành tiền ÷ tổng kg (khớp đơn giá/cây ÷ kg/cây).
      const gia = d.theoKg ? Math.round(tienTo / kgTo) : giaTo
      const wpu = d.theoKg ? round4(kgTo / sl) : kgCayTo
      const basis = d.theoKg ? 'unit2' : 'unit'
      const der = deriveLine('metal_kg', {
        qty_ordered: sl,
        weight_per_unit: wpu,
        price_per: basis,
      })
      if (der.price_basis !== basis || der.qty2 == null)
        throw new Error(`${d.sheet} dòng ${r}: deriveLine không ra ${basis}`)
      d.lines.push({
        r,
        sp: text(val(ws, `C${r}`)),
        ct: text(val(ws, `D${r}`)),
        kt,
        dvt: text(val(ws, `F${r}`)) || 'Cây',
        dai: Number(val(ws, `G${r}`)),
        sl,
        kgCayTo,
        kgTo,
        giaTo,
        tienTo,
        key,
        wpu,
        gia,
        basis,
        qty2: der.qty2,
        tien: basis === 'unit' ? sl * gia : der.qty2 * gia,
      })
    }
    d.hangTo = Number(val(ws, 'M16'))
  }

  const sb = db()
  const [{ data: owner }, { data: receiver }, { data: lsx }] = await Promise.all([
    sb.from('users').select('*').eq('email', OWNER_EMAIL).single(),
    sb.from('users').select('*').eq('email', RECEIVER_EMAIL).single(),
    sb.from('production_orders').select('id, code').eq('code', LSX).single(),
  ])
  if (!owner || !receiver || !lsx) throw new Error('thiếu người / lệnh')

  // Đã nạp chưa — dấu trong Trao đổi.
  const dau = (d: Don) => `Nạp từ file "${FILE_NAME}" (sheet ${d.sheet})`
  const { data: daNap } = await sb
    .from('doc_notes')
    .select('doc_id, body')
    .eq('doc_type', 'po')
    .ilike('body', `%${FILE_NAME}%`)

  const codes = Object.values(MA).flatMap((m) => ('code' in m ? [m.code] : []))
  const { data: mats } = await sb
    .from('warehouse_materials')
    .select('id, code, name, unit, is_active')
    .in('code', codes)
  for (const m of mats ?? [])
    if (m.unit !== 'Cây' || !m.is_active)
      throw new Error(`${m.code}: ĐVT ${m.unit} / ngưng`)

  let tong = 0
  for (const d of DON) {
    const hang = Math.round(d.lines.reduce((s, l) => s + l.tien, 0))
    tong += hang
    const da = (daNap ?? []).find((n) => n.body.includes(dau(d)))
    console.log(
      `\n══ ${d.sheet} → ${LSX} · ${d.theoKg ? 'giá/kg' : 'giá/cây'} · VAT 0 · số ${d.so ?? '(trống)'}${da ? '  [ĐÃ NẠP — bỏ qua]' : ''}`,
    )
    for (const l of d.lines) {
      const ma = MA[l.key]
      if (!ma) throw new Error(`chưa có mã cho "${l.key}"`)
      console.log(
        `  ${l.r} ${('code' in ma ? ma.code : '+ mới').padEnd(8)} ${l.kt.padEnd(18)} ${fmt(l.sl).padStart(4)} ${l.dvt} × ${fmt(l.wpu)} kg = ${fmt(l.qty2)} kg · ` +
          `${fmt(l.gia)} đ/${l.basis === 'unit' ? 'cây' : 'kg'} = ${fmt(Math.round(l.tien))} (tờ ${fmt(l.tienTo)})  — ${ma.vi}`,
      )
    }
    console.log(
      `  Tiền hàng ${fmt(hang)} (tờ ${fmt(d.hangTo)}, lệch ${fmt(hang - d.hangTo)})`,
    )
    if (da) d.poId = da.doc_id
  }
  console.log(
    `\nCả 2 đơn: ${fmt(tong)} đ · phiếu nhập ngày ${NGAY_VE}, người lập ${receiver.name}`,
  )
  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  // ── vật tư mới ──
  const { data: stMax } = await sb
    .from('warehouse_materials')
    .select('code')
    .like('code', 'ST-%')
    .order('code', { ascending: false })
    .limit(1)
  let stNo = Number(String(stMax?.[0]?.code ?? 'ST-0000').slice(3))
  const matOf = new Map<string, { id: string; code: string }>()
  for (const [key, m] of Object.entries(MA)) {
    if ('code' in m) {
      const hit = mats!.find((x) => x.code === m.code)!
      matOf.set(key, hit)
      continue
    }
    const { data: again } = await sb
      .from('warehouse_materials')
      .select('id, code')
      .eq('name', m.moi.name)
      .maybeSingle()
    if (again) {
      matOf.set(key, again)
      continue
    }
    const code = `ST-${String(++stNo).padStart(4, '0')}`
    const { data, error } = await sb
      .from('warehouse_materials')
      .insert({
        code,
        name: m.moi.name,
        unit: 'Cây',
        spec: m.moi.spec,
        group_name: 'Sắt thép - tôn - tấm',
        kg_per_unit: m.moi.kg,
        kg_per_m: round4(m.moi.kg / 6),
        default_bar_length_m: 6,
        po_template: 'metal_kg',
        min_stock: 0,
        is_active: true,
        needs_review: true,
        created_by: owner.id,
        note: `Mở từ đơn anh Truyền (${FILE_NAME}, 30/09/2026): danh mục chỉ có bản ĐVT Kg. Barem ${m.moi.kg} kg/cây 6 m theo tờ NCC.`,
      })
      .select('id, code')
      .single()
    if (error) throw new Error(`vật tư ${m.moi.name}: ${error.message}`)
    console.log(`  + vật tư ${data.code} ${m.moi.name}`)
    matOf.set(key, data)
  }

  for (const d of DON) {
    if (d.poId) {
      console.log(`  = ${d.sheet}: đã nạp, bỏ qua`)
      continue
    }
    const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
    if (ce) throw new Error(ce.message)
    const { data: po, error: pe } = await sb
      .from('supply_purchase_orders')
      .insert({
        code: code as string,
        supplier_id: d.sup,
        production_order_id: lsx.id,
        status: 'draft',
        template: 'metal_kg',
        currency: 'VND',
        vat_rate: 0,
        price_includes_vat: false,
        supplier_doc_no: d.so,
        terms_quality: QUALITY,
        terms_invoice: INVOICE,
        signer_role: 'NGƯỜI ĐẶT HÀNG',
        created_by: owner.id,
        assigned_to: owner.id,
      })
      .select('id, code')
      .single()
    if (pe) throw new Error(`${d.sheet}: ${pe.message}`)
    d.poId = po.id
    d.poCode = po.code

    const rows = d.lines.map((l, i) => {
      const m = matOf.get(l.key)!
      l.matId = m.id
      l.matCode = m.code
      l.vi = MA[l.key].vi
      return {
        po_id: po.id,
        material_id: m.id,
        sort_order: i,
        qty_basis: 'manual',
        qty_ordered: l.sl,
        unit_price: l.gia,
        price_basis: l.basis,
        qty2: l.qty2,
        unit2: 'kg',
        weight_per_unit: l.wpu,
        bar_length_m: l.dai,
        line_unit: l.dvt,
        spec: l.kt,
        dimension_text: l.kt,
        line_name: `${l.sp} — ${l.ct}`,
        // Ô ghi chú dòng IN LÊN PHIẾU — chỉ chữ của tờ.
        note: `${l.sp} · ${l.ct}`,
      }
    })
    const { data: ins, error: le } = await sb
      .from('supply_purchase_order_lines')
      .insert(rows)
      .select('id, sort_order')
    if (le) {
      await sb.from('supply_purchase_orders').delete().eq('id', po.id)
      throw new Error(`${d.sheet} dòng: ${le.message} — đã gỡ đầu đơn`)
    }

    // Đã mua: → ordered theo ngày trên tờ (08:00 giờ VN). Không bịa người duyệt.
    const { error: oe } = await sb
      .from('supply_purchase_orders')
      .update({ status: 'ordered', ordered_at: `${NGAY_TO}T01:00:00Z` })
      .eq('id', po.id)
    if (oe) throw new Error(`${po.code} → ordered: ${oe.message}`)

    const hang = Math.round(d.lines.reduce((s, l) => s + l.tien, 0))
    const body = [
      `${dau(d)} ngày 30/09/2026. Ngày trên tờ: 25/09/2026. Số ĐH trên tờ: ${d.so ?? '(để trống)'}. Lệnh ghi trên tờ: "LSX MERXX 07". Người đặt hàng ký tên: Trương Thanh Truyền.`,
      `Đơn ĐÃ MUA trước khi lên hệ thống — anh Việt xác nhận 30/09: hàng về 27/09/2026. Trạng thái ghi hộ: Đã gửi NCC (25/09) rồi nhập kho đủ ngày 27/09. Hệ thống không có dấu vết ai duyệt nên không ghi người duyệt.`,
      `Tiền hàng ${fmt(hang)} đ (tờ ${fmt(d.hangTo)}). Tờ in ô thuế 10% nhưng không tính tiền thuế, TỔNG THANH TOÁN = tiền hàng ⇒ VAT 0. NCC xuất hoá đơn 10% thì sửa VAT.`,
      d.theoKg
        ? `Tờ ghi cột đơn giá "/cây" (80.080 · 88.746) nhưng thành tiền = tổng kg gõ tay (549 · 320 kg, không phải SL × kg/cây 549,64 · 320,45) × giá/kg (22.000 · 23.540). Hệ thống ghi giá/kg; kg/cây = kg tờ ÷ SL làm tròn 4 lẻ (3,6358 · 3,7647; barem NCC trên tờ 3,64 · 3,77) nên tổng kg 549,0058 · 319,9995, lệch tờ ${fmt(hang - d.hangTo)} đ.`
        : 'Giá theo CÂY như tờ (Đơn giá VND/cây); kg/cây ghi để in tổng kg.',
      'Tờ để trống nơi giao (Tại …) và số ngày giao; điều khoản 1 ghi "cây dài 3 m" trong khi hàng cây 6 m — chép nguyên văn tờ.',
      'Chọn mã vật tư:',
      ...d.lines.map((l, i) => `· Dòng ${i + 1} (${l.matCode}) ${l.kt}: ${l.vi}`),
    ].join('\n')
    const { error: ne } = await sb
      .from('doc_notes')
      .insert({
        doc_type: 'po',
        doc_id: po.id,
        author_id: owner.id,
        audience: 'internal',
        body,
      })
    if (ne) throw new Error(`${po.code} Trao đổi: ${ne.message}`)

    // Phiếu nhập qua đúng service của Kho.
    const rec = await stockService.createReceiptDoc(receiver as User, {
      po_id: po.id,
      doc_date: NGAY_VE,
      note: `Hàng về 27/09/2026 — ghi nhận hộ 30/09 theo xác nhận của anh Việt (đơn anh Truyền, ${FILE_NAME}).`,
      lines: d.lines.map((l, i) => ({
        material_id: l.matId!,
        qty: l.sl,
        po_line_id: ins!.find((x) => x.sort_order === i)!.id,
      })),
    })
    console.log(
      `  + ${po.code} ${d.sheet} ${rows.length} dòng ${fmt(hang)} đ · ${rec.code} → đơn ${rec.po_status}`,
    )
  }

  // ── đọc lại ──
  console.log('\n── ĐỌC LẠI ──')
  for (const d of DON) {
    const { data: po } = await sb
      .from('supply_purchase_orders')
      .select('code, status, ordered_at')
      .eq('id', d.poId!)
      .single()
    const { data: ln } = await sb
      .from('supply_purchase_order_lines')
      .select('*')
      .eq('po_id', d.poId!)
    const hang = Math.round(ln!.reduce((s, l) => s + poLineAmount(l as never), 0))
    const drift = ln!.filter((l) => {
      const x = deriveLine('metal_kg', {
        qty_ordered: Number(l.qty_ordered),
        weight_per_unit: Number(l.weight_per_unit),
        price_per: l.price_basis as 'unit' | 'unit2',
      })
      return x.qty2 !== Number(l.qty2) || x.price_basis !== l.price_basis
    }).length
    const { data: mv } = await sb
      .from('warehouse_movements')
      .select('qty, unit_cost, doc_id')
      .in(
        'po_line_id',
        ln!.map((l) => l.id),
      )
    const nhan = (mv ?? []).reduce((s, m) => s + Number(m.qty), 0)
    const giaTri = Math.round(
      (mv ?? []).reduce((s, m) => s + Number(m.qty) * Number(m.unit_cost ?? 0), 0),
    )
    console.log(
      `  ${po!.code} [${po!.status}] tiền hàng ${fmt(hang)} · lệch deriveLine ${drift} · nhập ${fmt(nhan)} cây · giá trị nhập ${fmt(giaTri)}`,
    )
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
