// NẠP ĐƠN ĐẶT VẬT TƯ TỪ FILE CỦA CUNG ỨNG (chị Nga, 15/09/2026).
//
//   node scripts/nap-don-nga-0915.mjs            # DRY-RUN
//   node scripts/nap-don-nga-0915.mjs --apply    # ghi thật
//
// NGUỒN: hai workbook "lệnh sản xuất kèm đơn mua", mỗi nhà cung cấp một sheet.
//   · LSX 06.26.27( 18023 HG-MX).xls   → lệnh 06/26-27 - MX   (14 đơn)
//   · LSX ROSCO CHELSEA - IBIZA.xls    → lệnh 02/26-27 - ROSCO (14 đơn)
//
// VÌ SAO BIẾT FILE ROSCO THUỘC LỆNH 02 chứ không phải 01: tên file có chữ
// CHELSEA (lệnh 01) nhưng NỘI DUNG toàn IBIZA — ghi chú từng dòng ghi "8960 ghế
// xoay", "2126 bàn vuông", "5628 ghế bank 1", khớp đúng số lượng bản Ver 2 của
// lệnh 02 (2722875=8.960, 2723874=2.126, 2723875=5.628). Không đoán theo tên.
//
// CHỈ TẠO ĐƠN CÒN THIẾU, KHÔNG ĐỤNG ĐƠN ĐÃ CÓ. Trùng một đơn là công nợ đếm
// đôi, nên gặp nhà cung cấp đã có đơn ở cùng lệnh thì BÁO ra rồi bỏ qua — để
// người đối chiếu quyết, không tự gộp.
//
// Dòng đơn nạp dạng TỰ DO (`line_name`, `material_id` null) — đúng cách 65/207
// dòng đang có trong hệ thống. Ghép 200+ tên hàng vào danh mục 13.226 mã bằng
// máy là mời lỗi vào chỗ tiền.
import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'

const XLSX = createRequire(import.meta.url)('xlsx')
const APPLY = process.argv.includes('--apply')
const DIR = 'C:/Users/HGPC/Downloads/Nga'
const NGUON = [
  { file: `${DIR}/LSX 06.26.27( 18023 HG-MX).xls`, lsx: '06/26-27 - MX' },
  { file: `${DIR}/LSX ROSCO CHELSEA - IBIZA.xls`, lsx: '02/26-27 - ROSCO' },
]

const n = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const bo = (s) =>
  n(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
const num = (s) => {
  const t = n(s).replace(/[,\s]/g, '')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
/** Bỏ mọi thứ không phải chữ/số — để so tên công ty bất kể dấu, "Cty/Công ty". */
const key = (s) =>
  bo(s)
    .replace(
      /\b(cong ty|cty|tnhh|mtv|co phan|cp|sx|tm|dv|th|xnk|dntn|co so|doanh nghiep tu nhan)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]/g, '')

// ── Bóc một workbook thành danh sách đơn ────────────────────────────────────
function bocFile(file) {
  const wb = XLSX.readFile(file)
  const out = []
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
      header: 1,
      raw: false,
      defval: '',
    })
    const flat = rows.map((r) => r.map(n).join(' | '))
    if (!flat.some((l) => /ĐƠN ĐẶT HÀNG|PURCHASE ORDER/i.test(l))) continue
    const grab = (re) => {
      for (const r of rows)
        for (let j = 0; j < r.length; j++) {
          const m = re.exec(n(r[j]))
          if (m) {
            if (m[1] && n(m[1])) return n(m[1])
            for (let k = j + 1; k < r.length; k++) if (n(r[k])) return n(r[k])
          }
        }
      return null
    }
    const hi = rows.findIndex((r) => r.some((c) => /^stt$/i.test(n(c))))
    if (hi < 0) continue
    const H = rows[hi].map(bo)
    const col = (...ks) => {
      for (const k of ks) {
        const i = H.findIndex((h) => h.includes(k))
        if (i >= 0) return i
      }
      return -1
    }
    /*
      CỘT SỐ LƯỢNG — chỗ dễ sai nhất. Sheet thật có HAI cột cạnh nhau: "SL Đơn
      Hàng" (số của LỆNH SẢN XUẤT) và "SL đặt hàng" (số thật sự đi mua). Bắt
      nhầm cột đầu là sai số đặt nhiều lần: sheet Đ1 của ROSCO ghi 980 ở cột
      lệnh và 1.617 mét ở cột đặt. Nên cột ĐẶT dò TRƯỚC, đủ mọi cách viết.
      Tiêu đề trong file còn gõ thiếu dấu ("SL Cần đăt") nên so khớp phải BỎ DẤU.
    */
    const cQty = col(
      'sl dat hang',
      'so luong dat hang',
      'sl don hang can dat',
      'tong dh can dat',
      'sl met can dat',
      'sl can dat',
      'sl dat',
    )
    const cQty2 = col('so luong', 'sl dh', 'sl don hang')
    const cName = col('ten san pham', 'ten hang hoa', 'ten vat tu')
    const cPrice = col('don gia', 'dgia/ thung', 'dgia')
    const cAmt = col('thanh tien')
    const cUnit = col('dvt')
    const cSpec = col('quy cach')
    const cNote = col('ghi chu')

    const lines = []
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i]
      const joined = n(r.map(n).join(' '))
      if (!joined) continue
      if (/^(cộng tiền hàng|tổng cộng|tổng thanh toán|thuế|chiết khấu)/i.test(joined))
        continue
      if (/^(người lập|giám đốc|đại diện|nơi nhận)/i.test(joined)) break
      const ten = cName >= 0 ? n(r[cName]) : ''
      if (!ten) continue
      let sl = cQty >= 0 ? num(r[cQty]) : null
      if (sl == null && cQty2 >= 0) sl = num(r[cQty2])
      if (sl == null || sl <= 0) continue
      const gia = cPrice >= 0 ? num(r[cPrice]) : null
      const tt = cAmt >= 0 ? num(r[cAmt]) : null
      lines.push({
        ten,
        sl,
        dvt: cUnit >= 0 ? n(r[cUnit]) || null : null,
        quy_cach: cSpec >= 0 ? n(r[cSpec]) || null : null,
        gia,
        thanh_tien: tt,
        ghi_chu: cNote >= 0 ? n(r[cNote]) || null : null,
        // Giá theo ĐƠN VỊ KHÁC (m³ nệm, m² bao bì): giá × SL ≠ thành tiền.
        gia_khac_dvt:
          gia != null &&
          tt != null &&
          Math.abs(gia * sl - tt) > Math.max(2, Math.abs(tt) * 0.005),
      })
    }
    out.push({
      sheet: sn,
      so_dh: grab(/^Số\s*ĐH\s*[:.]?\s*(.*)$/i),
      ncc: grab(/^Kính gửi\s*[:.]?\s*(.*)$/i),
      mst: grab(/^MST\s*[:.]?\s*(.*)$/i),
      lines,
    })
  }
  return out
}

// ── Nạp dữ liệu nền ─────────────────────────────────────────────────────────
const db = await client(import.meta.url)
const { data: ncc } = await db.from('supply_suppliers').select('id, code, name, tax_no')
const { data: lsxs } = await db.from('production_orders').select('id, code')
const { data: pos } = await db
  .from('supply_purchase_orders')
  .select('id, code, supplier_id, production_order_id, status')

const timNcc = (ten, mst) => {
  if (mst) {
    const t = ncc.find((s) => n(s.tax_no) && n(s.tax_no) === n(mst))
    if (t) return t
  }
  const k = key(ten)
  if (!k) return null
  return (
    ncc.find((s) => key(s.name) === k) ??
    ncc.find((s) => key(s.name).includes(k) || k.includes(key(s.name))) ??
    null
  )
}

console.log(
  `\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — nạp đơn từ file chị Nga\n`,
)

let taoMoi = 0
let boQua = 0
let khongRoNcc = 0
const viec = []

for (const { file, lsx: lsxCode } of NGUON) {
  const lsx = lsxs.find((x) => x.code === lsxCode)
  if (!lsx) throw new Error(`Chưa có lệnh ${lsxCode}`)
  const dons = bocFile(file)
  console.log(
    `── ${file.split('/').pop()} → lệnh ${lsxCode} · ${dons.length} đơn trong file`,
  )

  for (const d of dons) {
    const s = timNcc(d.ncc, d.mst)
    if (!s) {
      khongRoNcc++
      console.log(
        `   ? [${d.sheet}] KHÔNG TRA RA NCC: "${String(d.ncc ?? '').slice(0, 44)}"`,
      )
      continue
    }
    const daCo = pos.find(
      (p) => p.supplier_id === s.id && p.production_order_id === lsx.id,
    )
    const tien = d.lines.reduce((a, b) => a + (b.thanh_tien ?? (b.gia ?? 0) * b.sl), 0)
    if (daCo) {
      boQua++
      console.log(
        `   = [${d.sheet.padEnd(13)}] ${s.name.slice(0, 34).padEnd(36)} đã có đơn ${daCo.code} (${daCo.status}) — bỏ qua`,
      )
      continue
    }
    taoMoi++
    console.log(
      `   + [${d.sheet.padEnd(13)}] ${s.name.slice(0, 34).padEnd(36)} ĐH ${String(d.so_dh ?? '—').padEnd(16)} ` +
        `${String(d.lines.length).padStart(3)} dòng · ${Math.round(tien).toLocaleString('vi-VN')} đ`,
    )
    viec.push({ lsxId: lsx.id, lsxCode, supplier: s, d, tien })
  }
}

console.log(
  `\n  tạo mới ${taoMoi} đơn · bỏ qua ${boQua} đơn đã có · ${khongRoNcc} sheet chưa tra ra NCC`,
)
const nhieuDvt = viec.flatMap((v) => v.d.lines.filter((l) => l.gia_khac_dvt)).length
if (nhieuDvt)
  console.log(
    `  ${nhieuDvt} dòng có giá tính theo ĐƠN VỊ KHÁC (m³/m²) — nạp nguyên giá và thành tiền của file, không tự quy đổi`,
  )

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

for (const v of viec) {
  const { data: po, error } = await db
    .from('supply_purchase_orders')
    .insert({
      code:
        n(v.d.so_dh) || `${v.supplier.code ?? 'NCC'}-${Date.now().toString().slice(-6)}`,
      production_order_id: v.lsxId,
      supplier_id: v.supplier.id,
      status: 'draft',
      currency: 'VND',
      vat_rate: 8,
      note:
        `Nạp từ file Cung ứng (chị Nga) 15/09/2026, sheet "${v.d.sheet}". ` +
        `Chị Nga ghi: toàn bộ đơn đã ký. Dòng nạp dạng tự do, chưa nối danh mục vật tư.`,
    })
    .select('id, code')
    .single()
  if (error) throw new Error(`${v.d.sheet}: ${error.message}`)

  const rows = v.d.lines.map((l, i) => ({
    po_id: po.id,
    material_id: null,
    line_name: l.ten.slice(0, 300),
    line_unit: l.dvt,
    spec: l.quy_cach,
    qty_ordered: l.sl,
    unit_price: l.gia ?? 0,
    price_basis: 'unit',
    qty_basis: 'manual',
    note: l.ghi_chu,
    sort_order: i,
  }))
  const e = (await db.from('supply_purchase_order_lines').insert(rows)).error
  if (e) throw new Error(`${v.d.sheet} dòng: ${e.message}`)
  console.log(`  + ${po.code} — ${rows.length} dòng`)
}
console.log('\n✓ Xong. Đơn mới ở trạng thái NHÁP — Cung ứng soát rồi gửi duyệt.\n')
