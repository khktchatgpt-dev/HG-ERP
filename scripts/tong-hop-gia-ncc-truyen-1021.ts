/**
 * TỔNG HỢP ĐƠN MUA của anh Truyền (Trương Thanh Truyền, kehoach3@) từ tháng 9 →
 * so sánh giá nhà cung cấp (21/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/tong-hop-gia-ncc-truyen-1021.ts
 *
 * Ra thư mục `xuat/tong-hop-gia-ncc-truyen-1021/`:
 *   - Tong-hop-gia-NCC-anh-Truyen.xlsx — 4 tờ: So sánh NCC · So sánh mặt hàng ·
 *     Chi tiết dòng · Danh sách đơn
 *   - don-hang/<PO>.xlsx — từng đơn, dựng bằng CHÍNH hàm xuất Excel của app
 *     (loadPoPrint + buildPoExcel) nên giống hệt phiếu in.
 *
 * Quy giá về cùng đơn vị để so: nhôm/thép theo ĐỒNG/KG (thành tiền ÷ kg của dòng —
 * kể cả dòng tính giá theo cây); xốp theo ĐỒNG/M³ (giá/m³, hoặc giá thanh ÷ thể tích
 * D×R×C). Mặt hàng gom theo QUY CÁCH đọc từ tên (dạng + kích thước + độ dày, bỏ
 * chiều dài cây): mỗi NCC đặt tên một kiểu nên gom theo mã vật tư là không so được.
 * Chỉ ĐỌC dữ liệu, không ghi gì vào DB.
 */
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { db } from '@/server/db'
import { poLineAmount, type PoLineAmountInput } from '@/lib/po-line'
import { poStatusLabel } from '@/lib/po-status'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { loadPoPrint } from '@/modules/dept/supply/po-print.service'
import { buildPoExcel } from '@/modules/dept/supply/po-excel'

const TRUYEN = 'kehoach3@hoanggia.de'
const TU_NGAY = '2026-09-01'
const OUT = path.resolve('xuat/tong-hop-gia-ncc-truyen-1021')

// ── Đọc quy cách từ tên vật tư ────────────────────────────────────────────────
type Item = { nhom: string; key: string; label: string; dv: 'kg' | 'm³' | null }

const num = (s: string) => Number(s.replace(',', '.'))
const fmtT = (t: number) => (Number.isInteger(t) ? t.toFixed(1) : String(t))

export function docQuyCach(name: string, template: string, finish: string | null): Item {
  const s0 = name.toLowerCase().normalize('NFC')
  if (template === 'foam') return { nhom: 'Xốp', key: `xốp|${s0}`, label: name, dv: 'm³' }
  if (template === 'accessory') return { nhom: 'Phụ kiện', key: `pk|${s0}`, label: name, dv: null } // prettier-ignore
  if (template === 'paint')
    return { nhom: 'Khác', key: `khac|${s0}`, label: name, dv: null }

  const nhom0 = /nhôm/.test(s0) ? 'Nhôm' : 'Thép'
  // Bỏ chiều dài cây: "dài 5.48m", "(dài 5.8 mét)", "(5.5m)", "mềm 4.6m", "x6m".
  const s = s0
    .replace(/\(?\s*dài\s*[\d.,]+\s*m(ét)?\s*\)?/g, ' ')
    .replace(/\(\s*[\d.,]+\s*m\s*\)/g, ' ')
    .replace(/\s[\d.,]+\s*m\s*$/g, ' ')
    .replace(/x\s*[\d.,]+\s*m\b/g, ' ')
    .replace(/\*/g, 'x')
    .replace(/(\d+)\s*dem/g, (_, d) => String(Number(d) / 10))
  const mem = /mềm/.test(s) ? ' mềm' : ''
  const gan = /gân/.test(s) ? ' có gân' : ''
  const kem = /kẽm/.test(s) || /kẽm/i.test(finish ?? '') ? ' kẽm' : ''
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(num)

  // Profile riêng của NCC (TD-A648, QM-HGGL-…, DTBD05) — không có quy cách chung.
  if (/\b(td|qm|dtbd)[\s-]?[a-z]*\d/.test(s))
    return { nhom: 'Nhôm thanh', key: `profile|${s0}`, label: `${name} (profile riêng)`, dv: 'kg' } // prettier-ignore

  if (/tấm/.test(s)) {
    const t = nums.find((n) => n <= 20) ?? null
    const nhom = `${nhom0} tấm`
    return { nhom, key: `${nhom}|${t}`, label: `${nhom} dày ${t ?? '?'} mm`, dv: 'kg' }
  }
  let dang = /oval/.test(s) ? 'oval' : /ống|phi|ø/.test(s) ? 'tròn' : /vuông/.test(s) ? 'vuông' : /hộp/.test(s) ? 'hộp' : '' // prettier-ignore
  let dims: number[] = []
  let t: number | null = null
  if (dang === 'tròn') {
    dims = nums.slice(0, 1)
    t = nums[1] ?? null
  } else if (dang === 'vuông' && nums.length <= 2) {
    dims = [nums[0], nums[0]]
    t = nums[1] ?? null
  } else {
    dims = nums.slice(0, 2)
    t = nums[2] ?? null
    // "Nhôm 25x25xT1.0R1.5": không ghi dạng — hai cạnh bằng nhau là vuông.
    // "Thép hộp vuông 20x40": hai cạnh khác nhau thì là hộp, dù tên có chữ vuông.
    if (!dang || dang === 'vuông') dang = dims[0] === dims[1] ? 'vuông' : 'hộp'
  }
  const nhom = nhom0 === 'Nhôm' ? 'Nhôm thanh' : 'Thép thanh/ống'
  const kt = dang === 'tròn' ? `phi ${dims[0]}` : `${dang} ${dims.join('×')}`
  const label = `${nhom0} ${kt}${t != null ? ` T${fmtT(t)}` : ''}${mem}${gan}${kem}`
  return { nhom, key: `${nhom}|${label}`, label, dv: 'kg' }
}

// ── Dữ liệu ──────────────────────────────────────────────────────────────────
type Row = {
  po: string
  poId: string
  ngay: string
  status: string
  ncc: string
  nccCode: string
  lsx: string
  template: string
  vat: number
  code: string
  name: string
  spec: string
  qty: number
  dvt: string
  price: number
  priceUnit: string
  amount: number
  kg: number | null
  m3: number | null
  giaQuy: number | null
  item: Item
}

async function main() {
  const { data: u } = await db()
    .from('users')
    .select('id,name')
    .eq('email', TRUYEN)
    .single()
  if (!u) throw new Error('không thấy anh Truyền')
  const { data: pos, error } = await db()
    .from('supply_purchase_orders')
    .select(
      'id,code,status,template,created_at,ordered_at,supplier_doc_no,vat_rate,price_includes_vat,currency,supplier_id,production_order_id',
    ) // prettier-ignore
    .or(`created_by.eq.${u.id},assigned_to.eq.${u.id}`)
    .gte('created_at', TU_NGAY)
    .neq('status', 'cancelled')
    .order('created_at')
  if (error || !pos) throw error
  const { data: sups } = await db()
    .from('supply_suppliers')
    .select('id,code,name,short_name')
  const sup = new Map((sups ?? []).map((s) => [s.id, s]))

  fs.mkdirSync(path.join(OUT, 'don-hang'), { recursive: true })
  const rows: Row[] = []
  const heads: (string | number | null)[][] = []
  for (const p of pos) {
    const d = await loadPoPrint(p.id)
    if (!d) throw new Error(`không nạp được ${p.code}`)
    const s = sup.get(p.supplier_id)
    const nccName = s?.name ?? '—'
    const lsx = d.po.lsx_code ?? 'Ngoài lệnh'
    const ngay = (p.ordered_at ?? p.created_at).slice(0, 10)

    // File từng đơn — đúng hàm xuất Excel của app.
    const file = `${p.code}.xlsx`
    const buf = await buildPoExcel({ company: d.company, tpl: d.tpl, po: d.po, supplier: d.supplier, lines: d.lines, shipments: d.shipments, orientation: 'landscape' }) // prettier-ignore
    fs.writeFileSync(path.join(OUT, 'don-hang', file), buf)

    const { data: ls } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'qty_ordered,unit_price,qty2,unit2,price_basis,spec,dimension_text,finish,line_unit,line_name,inner_l_mm,inner_w_mm,inner_h_mm,sort_order, m:warehouse_materials(code,name,unit)',
      ) // prettier-ignore
      .eq('po_id', p.id)
      .order('sort_order')
    let hang = 0
    for (const l of ls ?? []) {
      const m = l.m as unknown as { code: string; name: string; unit: string } | null
      const name = m?.name ?? l.line_name ?? '—'
      const amount = poLineAmount(l as PoLineAmountInput)
      hang += amount
      const kg = l.unit2 === 'kg' && l.qty2 ? Number(l.qty2) : null
      const vol = l.inner_l_mm && l.inner_w_mm && l.inner_h_mm ? (l.inner_l_mm * l.inner_w_mm * l.inner_h_mm) / 1e9 : null // prettier-ignore
      const m3 =
        l.unit2 === 'm³' && l.qty2 ? Number(l.qty2) : vol ? vol * l.qty_ordered : null
      const item = docQuyCach(
        name,
        p.template as PoTemplate,
        [l.finish, l.spec].filter(Boolean).join(' '),
      )
      const giaQuy = item.dv === 'kg' && kg ? amount / kg : item.dv === 'm³' && m3 ? amount / m3 : null // prettier-ignore
      const dvt = l.line_unit ?? m?.unit ?? ''
      rows.push({
        po: p.code,
        poId: p.id,
        ngay,
        status: poStatusLabel(p.status),
        ncc: nccName,
        nccCode: s?.code ?? '',
        lsx,
        template: poTemplateMeta(p.template as PoTemplate).label,
        vat: Number(p.vat_rate ?? 0), // prettier-ignore
        code: m?.code ?? '',
        name,
        spec: l.spec ?? l.dimension_text ?? '',
        qty: Number(l.qty_ordered),
        dvt, // prettier-ignore
        price: Number(l.unit_price ?? 0),
        priceUnit: l.price_basis === 'unit2' ? (l.unit2 ?? '') : dvt, // prettier-ignore
        amount,
        kg,
        m3,
        giaQuy,
        item,
      })
    }
    hang = Math.round(hang) // tiền đơn làm tròn về đồng như poMoney của app
    const vatAmt = p.price_includes_vat
      ? 0
      : Math.round((hang * Number(p.vat_rate ?? 0)) / 100)
    heads.push([p.code, p.supplier_doc_no, ngay, nccName, lsx, poTemplateMeta((p.template as PoTemplate)).label, poStatusLabel(p.status), ls?.length ?? 0, hang, Number(p.vat_rate ?? 0), vatAmt, hang + vatAmt, `don-hang/${file}`]) // prettier-ignore
  }

  // ── Workbook ───────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  const VND = '#,##0'
  const KG = '#,##0.0'
  const head = (ws: ExcelJS.Worksheet, r: number) => {
    const row = ws.getRow(r)
    row.font = { bold: true }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }
      c.border = { bottom: { style: 'thin' } }
    })
  }
  const nhomOrder = ['Nhôm thanh', 'Nhôm tấm', 'Thép thanh/ống', 'Thép tấm', 'Xốp', 'Phụ kiện', 'Khác'] // prettier-ignore
  const byNhom = (a: string, b: string) => nhomOrder.indexOf(a) - nhomOrder.indexOf(b)
  const dvLabel = (n: string) => (n === 'Xốp' ? 'đ/m³' : 'đ/kg')
  const tuNgay = heads.map((h) => h[2] as string).sort()

  // 1) SO SÁNH NCC theo nhóm hàng
  const ws1 = wb.addWorksheet('So sánh NCC', { views: [{ state: 'frozen', ySplit: 4 }] })
  ws1.getCell('A1').value = `SO SÁNH GIÁ NHÀ CUNG CẤP — đơn mua của ${u.name} (${pos.length} đơn, đặt ${tuNgay[0].split('-').reverse().join('/')} → ${tuNgay.at(-1)!.split('-').reverse().join('/')})` // prettier-ignore
  ws1.getCell('A1').font = { bold: true, size: 13 }
  ws1.getCell('A2').value = 'Giá BQ = tổng tiền hàng (chưa VAT) ÷ tổng kg (hoặc m³) của nhóm — dòng tính giá theo cây cũng quy về đồng/kg. "Chênh" = so với NCC rẻ nhất cùng nhóm. Dòng không có kg/m³ (phụ kiện, thép tấm tính theo tấm) không vào giá BQ.' // prettier-ignore
  ws1.getCell('A2').font = { italic: true, size: 9 }
  ws1.mergeCells('A2:L2')
  ws1.getRow(2).height = 30
  ws1.getCell('A2').alignment = { wrapText: true, vertical: 'top' }
  ws1.addRow([])
  ws1.addRow(['Nhóm hàng', 'Nhà cung cấp', 'Số đơn', 'Số dòng', 'Khối lượng (kg / m³)', 'Tiền hàng (VND)', 'Giá BQ', 'ĐV giá', 'Thấp nhất', 'Cao nhất', 'Xếp hạng', 'Chênh so rẻ nhất']) // prettier-ignore
  head(ws1, 4)
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.item.nhom}§${r.ncc}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const g1 = [...groups.entries()].map(([k, rs]) => {
    const [nhom, ncc] = k.split('§')
    const q = rs.filter((r) => r.giaQuy != null)
    const kl = q.reduce((s, r) => s + (r.item.dv === 'm³' ? r.m3! : r.kg!), 0)
    const tienQ = q.reduce((s, r) => s + r.amount, 0)
    return { nhom, ncc, don: new Set(rs.map((r) => r.po)).size, dong: rs.length, kl, tien: rs.reduce((s, r) => s + r.amount, 0), bq: kl ? tienQ / kl : null, min: q.length ? Math.min(...q.map((r) => r.giaQuy!)) : null, max: q.length ? Math.max(...q.map((r) => r.giaQuy!)) : null } // prettier-ignore
  })
  g1.sort((a, b) => byNhom(a.nhom, b.nhom) || (a.bq ?? 9e15) - (b.bq ?? 9e15))
  let prev = ''
  for (const g of g1) {
    const cung = g1.filter((x) => x.nhom === g.nhom && x.bq != null)
    const re = cung.length ? Math.min(...cung.map((x) => x.bq!)) : null
    const hang = g.bq != null ? cung.filter((x) => x.bq! < g.bq!).length + 1 : null
    if (prev && prev !== g.nhom) ws1.addRow([])
    prev = g.nhom
    const row = ws1.addRow([g.nhom, g.ncc, g.don, g.dong, g.kl || null, g.tien, g.bq, g.bq != null ? dvLabel(g.nhom) : '', g.min, g.max, hang != null && cung.length > 1 ? `${hang}/${cung.length}` : '', g.bq != null && re && cung.length > 1 ? g.bq / re - 1 : null]) // prettier-ignore
    row.getCell(5).numFmt = KG
    for (const c of [6, 7, 9, 10]) row.getCell(c).numFmt = VND
    row.getCell(12).numFmt = '+0.0%;-0.0%;"rẻ nhất"'
    if (hang === 1 && cung.length > 1) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } } // prettier-ignore
  }
  ws1.columns.forEach(
    (c, i) => (c.width = [16, 46, 8, 8, 14, 16, 12, 8, 12, 12, 10, 14][i]),
  )

  // 2) SO SÁNH MẶT HÀNG — cùng quy cách, mỗi NCC một dòng
  const ws2 = wb.addWorksheet('So sánh mặt hàng', {
    views: [{ state: 'frozen', ySplit: 3 }],
  })
  ws2.getCell('A1').value =
    'SO SÁNH GIÁ THEO MẶT HÀNG (cùng quy cách) — mặt hàng mua của ≥ 2 NCC xếp trước'
  ws2.getCell('A1').font = { bold: true, size: 13 }
  ws2.getCell('A2').value = 'Quy cách đọc từ tên vật tư (dạng + kích thước + độ dày, bỏ chiều dài cây). Cột "Tên trên đơn" để soát lại cách gom.' // prettier-ignore
  ws2.getCell('A2').font = { italic: true, size: 9 }
  ws2.addRow(['Nhóm', 'Mặt hàng (quy cách)', 'Số NCC', 'Nhà cung cấp', 'Số lần mua', 'Khối lượng', 'Giá thấp', 'Giá cao', 'ĐV giá', 'Lần gần nhất', 'Giá lần gần nhất', 'Chênh so rẻ nhất', 'Tên trên đơn']) // prettier-ignore
  head(ws2, 3)
  const items = new Map<string, Row[]>()
  for (const r of rows.filter((x) => x.giaQuy != null)) items.set(r.item.key, [...(items.get(r.item.key) ?? []), r]) // prettier-ignore
  const its = [...items.values()].map((rs) => ({
    rs,
    nccs: [...new Set(rs.map((r) => r.ncc))],
  }))
  its.sort((a, b) => Number(b.nccs.length > 1) - Number(a.nccs.length > 1) || byNhom(a.rs[0].item.nhom, b.rs[0].item.nhom) || a.rs[0].item.label.localeCompare(b.rs[0].item.label, 'vi')) // prettier-ignore
  let soMatHang2 = 0
  for (const it of its) {
    const per = it.nccs.map((ncc) => {
      const rs = it.rs
        .filter((r) => r.ncc === ncc)
        .sort((a, b) => a.ngay.localeCompare(b.ngay))
      const kl = rs.reduce((s, r) => s + (r.item.dv === 'm³' ? r.m3! : r.kg!), 0)
      return { ncc, rs, kl, min: Math.min(...rs.map((r) => r.giaQuy!)), max: Math.max(...rs.map((r) => r.giaQuy!)), last: rs.at(-1)! } // prettier-ignore
    })
    per.sort((a, b) => a.min - b.min)
    const re = per[0].min
    if (per.length > 1) soMatHang2++
    per.forEach((p, i) => {
      const row = ws2.addRow([i === 0 ? it.rs[0].item.nhom : '', i === 0 ? it.rs[0].item.label : '', i === 0 ? per.length : '', p.ncc, p.rs.length, p.kl, p.min, p.max, dvLabel(it.rs[0].item.nhom), `${p.last.ngay.split('-').reverse().join('/')} · ${p.last.po}`, p.last.giaQuy, per.length > 1 ? p.min / re - 1 : null, [...new Set(p.rs.map((r) => r.name))].join(' · ')]) // prettier-ignore
      row.getCell(6).numFmt = KG
      for (const c of [7, 8, 11]) row.getCell(c).numFmt = VND
      row.getCell(12).numFmt = '+0.0%;-0.0%;"rẻ nhất"'
      if (per.length > 1 && i === 0) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } } // prettier-ignore
      if (i === per.length - 1) row.border = { bottom: { style: 'hair' } }
    })
  }
  ws2.columns.forEach(
    (c, i) => (c.width = [14, 34, 7, 40, 8, 12, 11, 11, 7, 24, 12, 12, 60][i]),
  )

  // 3) CHI TIẾT DÒNG
  const ws3 = wb.addWorksheet('Chi tiết dòng', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  ws3.addRow(['Mã đơn', 'Ngày đặt', 'Trạng thái', 'Nhà cung cấp', 'Lệnh SX', 'Nhóm hàng', 'Mặt hàng (quy cách)', 'Mã VT', 'Tên vật tư', 'Quy cách trên đơn', 'SL đặt', 'ĐVT', 'Đơn giá', 'ĐV giá', 'Thành tiền (chưa VAT)', 'Khối lượng kg', 'Thể tích m³', 'Giá quy đổi', 'ĐV quy đổi', 'VAT %']) // prettier-ignore
  head(ws3, 1)
  ws3.autoFilter = 'A1:T1'
  for (const r of rows) {
    const row = ws3.addRow([r.po, r.ngay.split('-').reverse().join('/'), r.status, r.ncc, r.lsx, r.item.nhom, r.item.label, r.code, r.name, r.spec, r.qty, r.dvt, r.price, r.priceUnit, r.amount, r.kg, r.m3, r.giaQuy, r.giaQuy != null ? dvLabel(r.item.nhom) : '', r.vat]) // prettier-ignore
    for (const c of [13, 15, 18]) row.getCell(c).numFmt = VND
    row.getCell(16).numFmt = KG
    row.getCell(17).numFmt = '0.0000'
  }
  ws3.columns.forEach(
    (c, i) =>
      (c.width = [
        14, 11, 13, 36, 16, 14, 28, 10, 34, 18, 9, 7, 11, 7, 15, 11, 10, 11, 8, 6,
      ][i]),
  )

  // 4) DANH SÁCH ĐƠN
  const ws4 = wb.addWorksheet('Danh sách đơn', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  ws4.addRow(['Mã đơn', 'Số đơn NCC', 'Ngày đặt', 'Nhà cung cấp', 'Lệnh SX', 'Mẫu đơn', 'Trạng thái', 'Số dòng', 'Tiền hàng', 'VAT %', 'Tiền VAT', 'Tổng thanh toán', 'File đơn']) // prettier-ignore
  head(ws4, 1)
  ws4.autoFilter = 'A1:M1'
  for (const h of heads) {
    const row = ws4.addRow([h[0], h[1], (h[2] as string).split('-').reverse().join('/'), ...h.slice(3)]) // prettier-ignore
    for (const c of [9, 11, 12]) row.getCell(c).numFmt = VND
    row.getCell(13).value = { text: h[12] as string, hyperlink: h[12] as string }
    row.getCell(13).font = { color: { argb: 'FF1D4ED8' }, underline: true }
  }
  const tot = ws4.addRow(['TỔNG', '', '', '', '', '', '', rows.length, heads.reduce((s, h) => s + (h[8] as number), 0), '', heads.reduce((s, h) => s + (h[10] as number), 0), heads.reduce((s, h) => s + (h[11] as number), 0)]) // prettier-ignore
  tot.font = { bold: true }
  for (const c of [9, 11, 12]) tot.getCell(c).numFmt = VND
  ws4.columns.forEach(
    (c, i) => (c.width = [14, 20, 11, 40, 18, 16, 16, 8, 16, 6, 14, 16, 26][i]),
  )

  const file = path.join(OUT, 'Tong-hop-gia-NCC-anh-Truyen.xlsx')
  await wb.xlsx.writeFile(file)
  console.log(`${pos.length} đơn · ${rows.length} dòng · ${items.size} mặt hàng có giá quy đổi (${soMatHang2} mua của ≥ 2 NCC)`) // prettier-ignore
  console.log(`Tiền hàng ${heads.reduce((s, h) => s + (h[8] as number), 0).toLocaleString('vi-VN')} · tổng thanh toán ${heads.reduce((s, h) => s + (h[11] as number), 0).toLocaleString('vi-VN')}`) // prettier-ignore
  console.log('Nhóm × NCC:')
  for (const g of g1) console.log(`  ${g.nhom.padEnd(15)} ${g.ncc.slice(0, 40).padEnd(40)} ${g.bq != null ? Math.round(g.bq).toLocaleString('vi-VN') : '—'}`) // prettier-ignore
  console.log('Mặt hàng ≥2 NCC:')
  for (const it of its.filter((x) => x.nccs.length > 1)) console.log(`  ${it.rs[0].item.label}: ${it.nccs.map((n) => `${n.slice(0, 22)} ${Math.round(Math.min(...it.rs.filter((r) => r.ncc === n).map((r) => r.giaQuy!))).toLocaleString('vi-VN')}`).join(' | ')}`) // prettier-ignore
  console.log('→', file)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
