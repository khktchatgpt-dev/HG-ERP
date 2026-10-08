/**
 * XUẤT FILE EXCEL MẪU "Sản phẩm" cho các SP trên MỘT LỆNH SX — bản chạy tay
 * (09/10/2026) theo bản vẽ https://claude.ai/artifact/ArSSNepoFvD4LgBSc4G7t1:
 * một sheet, mỗi dòng một SP, ảnh đại diện nhúng trong ô Ảnh, 3 hàng đầu là
 * nhóm / tiêu đề / ghi chú, dữ liệu từ hàng 4. Dùng làm file thật để Kỹ thuật
 * điền + để duyệt bố cục trước khi dựng màn nhập.
 *
 *   node scripts/sp-excel-lsx.mjs "02/26-27 - ROSCO"            → exports/SanPham_<lệnh>.xlsx
 *   node scripts/sp-excel-lsx.mjs --trong                         → file mẫu trống
 */
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { client } from './products-lib.mjs'

const arg = process.argv[2]
const sb = await client(import.meta.url)

const TYPES = [
  ['TB', 'Bàn'],
  ['CH', 'Ghế'],
  ['BN', 'Băng ghế / sofa bank'],
  ['ST', 'Bộ sản phẩm'],
  ['SL', 'Giường tắm nắng'],
  ['OT', 'Ngoài trời khác'],
  ['AC', 'Phụ kiện'],
]
const MATS = [
  ['AL', 'Nhôm'],
  ['IR', 'Sắt'],
  ['IN', 'Inox'],
  ['WD', 'Gỗ'],
  ['RA', 'Mây / nhựa đan'],
  ['GL', 'Kính'],
  ['MX', 'Hỗn hợp'],
  ['XX', 'Chưa xác định'],
]
const opt = (pairs, code) => {
  const p = pairs.find((x) => x[0] === code)
  return p ? `${p[0]} — ${p[1]}` : (code ?? '')
}

/** Cột: [nhóm, tiêu đề, ghi chú hàng 3, rộng, lấy giá trị, kiểu] */
const COLS = [
  ['NHẬN DIỆN', 'Mã nội bộ', 'trống = thêm mới', 14, (p) => p.code, 'code'],
  ['NHẬN DIỆN', 'Ảnh', 'dán ảnh vào ô', 11, () => null, 'image'],
  [
    'NHẬN DIỆN',
    'Tên SP *',
    'Ô trống = giữ nguyên · gõ "-" = xoá trắng',
    42,
    (p) => p.name,
  ],
  ['NHẬN DIỆN', 'Loại SP *', 'chọn', 16, (p) => opt(TYPES, p.product_type), 'type'],
  [
    'NHẬN DIỆN',
    'Vật liệu khung *',
    'chọn',
    16,
    (p) => opt(MATS, p.frame_material),
    'mat',
  ],
  ['NHẬN DIỆN', 'Tên theo khách', 'in LSX', 32, (p) => p.name_foreign],
  ['NHẬN DIỆN', 'Khách / nhóm', 'gợi ý', 14, (p) => p.customer_name, 'cust'],
  ['NHẬN DIỆN', 'Mã KH đặt', '', 14, (p) => p.customer_item_code],
  ['NHẬN DIỆN', 'ĐVT', 'cái / bộ', 8, (p) => p.unit, 'unit'],
  [
    'KÍCH THƯỚC · KHỐI LƯỢNG',
    'Dài (mm)',
    'số kiểu VN: 1.390',
    10,
    (p) => p.length_mm,
    'num',
  ],
  ['KÍCH THƯỚC · KHỐI LƯỢNG', 'Rộng (mm)', '', 10, (p) => p.width_mm, 'num'],
  ['KÍCH THƯỚC · KHỐI LƯỢNG', 'Cao (mm)', '', 10, (p) => p.height_mm, 'num'],
  ['KÍCH THƯỚC · KHỐI LƯỢNG', 'KL tịnh (kg)', '2,5', 11, (p) => p.net_weight_kg, 'num'],
  ['KÍCH THƯỚC · KHỐI LƯỢNG', 'KL cân (kg)', '', 11, (p) => p.actual_weight_kg, 'num'],
  [
    'ĐÓNG GÓI (phương án mặc định)',
    'SP / thùng',
    'thùng của phương án mặc định',
    10,
    (p) => p.pk.qty,
    'num',
  ],
  ['ĐÓNG GÓI (phương án mặc định)', 'Thùng D (cm)', '', 11, (p) => p.pk.l, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'Thùng R (cm)', '', 11, (p) => p.pk.w, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'Thùng C (cm)', '', 11, (p) => p.pk.h, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'NW / thùng (kg)', '', 12, (p) => p.pk.nw, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'GW / thùng (kg)', '', 12, (p) => p.pk.gw, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'CBM / thùng', '', 11, (p) => p.pk.cbm, 'num'],
  ['ĐÓNG GÓI (phương án mặc định)', 'Xếp 40HC (thùng)', '', 12, (p) => p.pk.hc, 'num'],
  ['THÔNG SỐ IN LSX', 'Chất liệu chính', 'trống nếu SP không có', 18, (p) => p.material],
  ['THÔNG SỐ IN LSX', 'Gỗ', '', 16, (p) => p.tech_spec?.wood],
  ['THÔNG SỐ IN LSX', 'Sơn (mã màu)', '', 16, (p) => p.tech_spec?.paint],
  ['THÔNG SỐ IN LSX', 'Vải', '', 16, (p) => p.tech_spec?.fabric],
  ['THÔNG SỐ IN LSX', 'Kính', '', 16, (p) => p.tech_spec?.glass],
  ['THÔNG SỐ IN LSX', 'Nệm / mút', '', 16, (p) => p.tech_spec?.cushion],
  ['THÔNG SỐ IN LSX', 'Ngũ kim', '', 16, (p) => p.tech_spec?.hardware],
  ['THÔNG SỐ IN LSX', 'Màu hoàn thiện', '', 16, (p) => p.tech_spec?.finish],
  ['KHÁC', 'Barcode', '', 14, (p) => p.barcode],
  ['KHÁC', 'Mô tả EN', 'in báo giá', 28, (p) => p.description_en],
  ['KHÁC', 'Ghi chú', '', 24, (p) => p.notes],
  ['KHÁC', 'Đang dùng', 'có / không', 10, (p) => (p.is_active ? 'có' : 'không'), 'bool'],
  ['', 'Phiên bản (đừng sửa)', 'hệ thống dùng', 10, (p) => p.updated_at, 'hidden'],
  ['', 'Ảnh gốc (đừng sửa)', 'hệ thống dùng', 10, (p) => p.image_file_id, 'hidden'],
]
const col = (title) => COLS.findIndex((c) => c[1] === title) + 1

async function loadProducts() {
  if (arg === '--trong') return { products: [], label: 'mau' }
  const lsx = await sb
    .from('production_orders')
    .select('id,code')
    .eq('code', arg)
    .maybeSingle()
  if (!lsx.data) throw new Error(`Không thấy lệnh "${arg}"`)
  const lines = await sb
    .from('production_order_lines')
    .select('product_id,product_code,sort_order')
    .eq('production_order_id', lsx.data.id)
    .order('sort_order')
  const ids = [...new Set(lines.data.map((l) => l.product_id).filter(Boolean))]
  const pr = await sb.from('technical_products').select('*').in('id', ids)
  if (pr.error) throw new Error(pr.error.message)
  const byId = new Map(pr.data.map((p) => [p.id, p]))
  const products = ids.map((id) => byId.get(id)).filter(Boolean)
  // phương án đóng gói mặc định (bảng thật) — thiếu thì lấy ô tóm tắt jsonb
  const po = await sb
    .from('technical_packing_options')
    .select(
      'product_id,is_default,option_no,cartons_per_set,loading_40hc,packages:technical_packages(carton_l_mm,carton_w_mm,carton_h_mm,net_weight_kg,gross_weight_kg,sort_order)',
    )
    .in('product_id', ids)
  for (const p of products) {
    const opts = (po.data ?? []).filter((o) => o.product_id === p.id)
    const def =
      opts.find((o) => o.is_default) ?? opts.sort((a, b) => a.option_no - b.option_no)[0]
    const k = def?.packages?.[0]
    const j = p.packing ?? {}
    const cm = (v) => (v == null ? null : v / 10)
    p.pk = def
      ? {
          qty: def.cartons_per_set ?? j.qty_per_carton ?? null,
          l: cm(k?.carton_l_mm),
          w: cm(k?.carton_w_mm),
          h: cm(k?.carton_h_mm),
          nw: k?.net_weight_kg ?? null,
          gw: k?.gross_weight_kg ?? null,
          cbm:
            k && k.carton_l_mm && k.carton_w_mm && k.carton_h_mm
              ? +((k.carton_l_mm * k.carton_w_mm * k.carton_h_mm) / 1e9).toFixed(4)
              : (j.cbm ?? null),
          hc: def.loading_40hc ?? j.loading_40hc ?? null,
        }
      : {
          qty: j.qty_per_carton ?? null,
          l: j.carton_l_cm ?? null,
          w: j.carton_w_cm ?? null,
          h: j.carton_h_cm ?? null,
          nw: j.nw_kg ?? null,
          gw: j.gw_kg ?? null,
          cbm: j.cbm ?? null,
          hc: j.loading_40hc ?? null,
        }
  }
  return { products, label: arg.replace(/[^\w-]+/g, '-') }
}

async function loadImage(fileId) {
  if (!fileId) return null
  const f = await sb
    .from('files')
    .select('bucket,path,mime_type')
    .eq('id', fileId)
    .maybeSingle()
  if (!f.data) return null
  const dl = await sb.storage.from(f.data.bucket).download(f.data.path)
  if (dl.error) return null
  const ext =
    f.data.mime_type === 'image/png'
      ? 'png'
      : f.data.mime_type === 'image/jpeg'
        ? 'jpeg'
        : null
  if (!ext) return null
  return { buffer: Buffer.from(await dl.data.arrayBuffer()), ext }
}

const { products, label } = await loadProducts()
const names = await sb
  .from('technical_products')
  .select('customer_name')
  .not('customer_name', 'is', null)
const customers = [...new Set((names.data ?? []).map((x) => x.customer_name))].sort()

const wb = new ExcelJS.Workbook()
wb.creator = 'HG-ERP'
const ws = wb.addWorksheet('Sản phẩm', {
  views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }],
})
const lists = wb.addWorksheet('Danh mục')
const guide = wb.addWorksheet('Hướng dẫn')
ws.columns = COLS.map((c) => ({ width: c[3] }))

const FILL = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const BORDER = {
  top: { style: 'thin', color: { argb: 'FFB9C2D0' } },
  left: { style: 'thin', color: { argb: 'FFB9C2D0' } },
  bottom: { style: 'thin', color: { argb: 'FFB9C2D0' } },
  right: { style: 'thin', color: { argb: 'FFB9C2D0' } },
}

// hàng 1: nhóm (gộp ô)
let start = 1
COLS.forEach((c, i) => {
  const next = COLS[i + 1]
  if (next && next[0] === c[0]) return
  if (c[0]) {
    if (i + 1 > start) ws.mergeCells(1, start, 1, i + 1)
    const cell = ws.getCell(1, start)
    cell.value = c[0]
    cell.font = { bold: true, size: 9, color: { argb: 'FF3A4252' } }
    cell.fill = FILL('FFDCE4F7')
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  start = i + 2
})
// hàng 2–3
COLS.forEach((c, i) => {
  const h = ws.getCell(2, i + 1)
  h.value = c[1]
  h.font = { bold: true }
  h.fill = FILL('FFE8EEFB')
  h.alignment = { vertical: 'middle', wrapText: true }
  h.border = BORDER
  const n = ws.getCell(3, i + 1)
  n.value = c[2] || null
  n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
  n.fill = FILL('FFF1F3F7')
  n.alignment = { vertical: 'top', wrapText: true }
  if (c[5] === 'hidden') ws.getColumn(i + 1).hidden = true
  if (c[5] === 'code') ws.getColumn(i + 1).numFmt = '@'
})
ws.getRow(2).height = 30
ws.getRow(3).height = 26

// dữ liệu
let r = 4
for (const p of products) {
  COLS.forEach((c, i) => {
    if (c[5] === 'image') return
    const v = c[4](p)
    const cell = ws.getCell(r, i + 1)
    cell.value = v == null || v === '' ? null : v
    cell.border = BORDER
    cell.alignment = { vertical: 'middle' }
    if (c[5] === 'num') cell.alignment = { vertical: 'middle', horizontal: 'right' }
  })
  const img = await loadImage(p.image_file_id)
  if (img) {
    const id = wb.addImage({ buffer: img.buffer, extension: img.ext })
    ws.addImage(id, {
      tl: { col: col('Ảnh') - 1 + 0.06, row: r - 1 + 0.06 },
      ext: { width: 70, height: 52 },
      editAs: 'oneCell',
    })
    ws.getRow(r).height = 42
  } else ws.getRow(r).height = 24
  r++
}
// 20 dòng trống kẻ sẵn để thêm mới
for (let k = 0; k < 20; k++, r++)
  COLS.forEach((c, i) => (ws.getCell(r, i + 1).border = BORDER))

// danh mục + ô thả xuống
const listCols = [
  ['Loại SP', TYPES.map((t) => `${t[0]} — ${t[1]}`)],
  ['Vật liệu khung', MATS.map((t) => `${t[0]} — ${t[1]}`)],
  ['Khách / nhóm', customers],
  ['ĐVT', ['cái', 'bộ']],
  ['Có / không', ['có', 'không']],
]
lists.columns = listCols.map(() => ({ width: 28 }))
listCols.forEach(([t, vals], i) => {
  lists.getCell(1, i + 1).value = t
  lists.getCell(1, i + 1).font = { bold: true }
  vals.forEach((v, j) => (lists.getCell(j + 2, i + 1).value = v))
})
const L = (n) => String.fromCharCode(64 + n)
const dv = (i, count, strict) => ({
  type: 'list',
  allowBlank: true,
  formulae: [`'Danh mục'!$${L(i)}$2:$${L(i)}$${Math.max(2, count + 1)}`],
  showErrorMessage: strict,
  errorStyle: 'warning',
  errorTitle: 'Ngoài danh sách',
  error: 'Chọn trong danh sách (gõ "-" để xoá trắng)',
})
const kinds = {
  type: dv(1, TYPES.length, true),
  mat: dv(2, MATS.length, true),
  cust: dv(3, customers.length, false),
  unit: dv(4, 2, false),
  bool: dv(5, 2, false),
}
COLS.forEach((c, i) => {
  const v = kinds[c[5]]
  if (!v) return
  for (let rr = 4; rr <= r + 300; rr++) ws.getCell(rr, i + 1).dataValidation = v
})

guide.columns = [{ width: 120 }]
;[
  'THÊM VÀ CẬP NHẬT SẢN PHẨM BẰNG EXCEL — HG-ERP (bản mẫu 09/10/2026)',
  '',
  '1. Sheet "Sản phẩm": mỗi dòng một sản phẩm, dữ liệu từ hàng 4. Hàng 1–3 là nhóm, tiêu đề, ghi chú — đừng xoá.',
  '2. Dòng CÓ "Mã nội bộ" → CẬP NHẬT sản phẩm đó. Dòng KHÔNG mã → THÊM MỚI, hệ thống tự cấp mã theo Loại + Vật liệu khung.',
  '3. Ô TRỐNG = GIỮ NGUYÊN giá trị đang có. Muốn xoá trắng một ô thì gõ dấu "-".',
  '4. Ảnh: dán ảnh (Ctrl+V) vào ô Ảnh hoặc dùng "Đặt trong ô" của Excel 365. Ảnh có sẵn để nguyên = không đổi.',
  '5. Đóng gói: 8 ô là thùng của phương án MẶC ĐỊNH. SP nhiều phương án / nhiều kiện thì sửa trên hồ sơ.',
  '6. Số gõ kiểu Việt Nam: 1.390 = một nghìn ba trăm chín mươi; 2,5 = hai phẩy năm.',
  '7. Cột thừa có thể xoá — cột vắng thì hệ thống không đụng. Đừng sửa hai cột ẩn cuối (Phiên bản, Ảnh gốc).',
].forEach((t, i) => {
  guide.getCell(i + 1, 1).value = t
  if (i === 0) guide.getCell(1, 1).font = { bold: true, size: 13 }
})

fs.mkdirSync('exports', { recursive: true })
const out = path.join('exports', `SanPham_${label}.xlsx`)
await wb.xlsx.writeFile(out)
console.log(`Đã ghi ${out} — ${products.length} SP`)
