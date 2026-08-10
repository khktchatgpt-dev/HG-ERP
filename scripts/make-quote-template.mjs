// SINH FILE MẪU "BÁO GIÁ — SẢN PHẨM MỚI" (.xlsx) cho phòng Bán hàng.
//
//   node scripts/make-quote-template.mjs [đường/dẫn/ra.xlsx]
//
// Vì sao sinh bằng script chứ không commit một file nhị phân chết: cột của mẫu
// còn đổi (thêm/bớt thông số), và mẫu phải khớp với bộ đọc `src/lib/quote-excel.ts`
// — để cả hai cùng một nguồn thì sửa cột là chạy lại script, không lệch.
//
// Bố cục MỘT DÒNG = MỘT SẢN PHẨM, khác với bảng kê quy cách (BKQC) vốn một sheet
// một sản phẩm: báo giá thường có nhiều mặt hàng, và Sale cần dán cả bảng.
//
// Quy ước kích thước lấy đúng bảng kê quy cách của công ty:
//   "KTTT: 548 x 565 x 876   (L/D x W x H) mm"
// tức DÀI(sâu) × RỘNG × CAO, đơn vị **mm**. Không dùng cm cho kích thước SP nữa
// (xem docs/bao-gia-upload-excel-plan.md §2).

import ExcelJS from 'exceljs'
import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

const OUT = resolve(process.argv[2] ?? 'docs/mau/MAU_BAO_GIA_SP_MOI.xlsx')

/**
 * Cột của mẫu. `key` là thứ bộ đọc dùng; `label` là chữ Sale nhìn thấy.
 * Giữ ĐỒNG BỘ với HEADER_RULES trong src/lib/quote-excel.ts.
 */
export const COLUMNS = [
  {
    key: 'code',
    label: 'Mã SP (HG)',
    width: 16,
    hint: 'Để TRỐNG nếu là sản phẩm mới — hệ thống sẽ tạo mã.',
  },
  { key: 'customer_item_code', label: 'Mã khách (Item code)', width: 18 },
  { key: 'name', label: 'Tên SP (tiếng Việt)', width: 34, required: true },
  { key: 'description_en', label: 'Description (EN)', width: 34 },
  {
    key: 'image',
    label: 'Ảnh (Photo)',
    width: 22,
    hint: 'Chèn ảnh ĐÈ LÊN Ô của đúng dòng sản phẩm (Insert → Picture).',
  },
  {
    key: 'length_mm',
    label: 'Dài/Sâu D (mm)',
    width: 14,
    required: true,
    hint: 'Theo bảng kê quy cách: (L/D x W x H) mm.',
  },
  { key: 'width_mm', label: 'Rộng W (mm)', width: 13, required: true },
  { key: 'height_mm', label: 'Cao H (mm)', width: 12, required: true },
  { key: 'material', label: 'Chất liệu', width: 22, hint: 'VD: ALU + PE rattan' },
  { key: 'colour', label: 'Mã màu (Colour code)', width: 20 },
  { key: 'qty_per_carton', label: 'SL / thùng', width: 11 },
  { key: 'carton_l_cm', label: 'Carton dài (cm)', width: 14 },
  { key: 'carton_w_cm', label: 'Carton rộng (cm)', width: 15 },
  { key: 'carton_h_cm', label: 'Carton cao (cm)', width: 14 },
  { key: 'nw_kg', label: 'NW (kg)', width: 10 },
  { key: 'gw_kg', label: 'GW (kg)', width: 10 },
  { key: 'loading_40hc', label: "Loading 40'HC", width: 13 },
  {
    key: 'unit',
    label: 'ĐVT',
    width: 9,
    hint: 'cai / bo / set — bỏ trống thì lấy "cai".',
  },
  { key: 'unit_price', label: 'Đơn giá (FOB)', width: 14, required: true },
  { key: 'note', label: 'Ghi chú', width: 26 },
]

const HEADER_ROW = 3

const wb = new ExcelJS.Workbook()
wb.creator = 'HG Manager'
wb.created = new Date(0) // cố định để chạy lại không đổi metadata

// ── Sheet 1: bảng nhập ──────────────────────────────────────────────────────
const ws = wb.addWorksheet('Báo giá', {
  views: [{ state: 'frozen', ySplit: HEADER_ROW }],
})

ws.mergeCells(1, 1, 1, COLUMNS.length)
const title = ws.getCell(1, 1)
title.value = 'BÁO GIÁ — SẢN PHẨM MỚI'
title.font = { size: 14, bold: true }
title.alignment = { vertical: 'middle', horizontal: 'center' }
ws.getRow(1).height = 24

ws.mergeCells(2, 1, 2, COLUMNS.length)
const guide = ws.getCell(2, 1)
guide.value =
  'Mỗi dòng = một sản phẩm. Ô có dấu * là bắt buộc. Kích thước SP theo (L/D x W x H) mm như bảng kê quy cách. ' +
  'Ảnh: chèn đè lên ô cột "Ảnh" của đúng dòng. Xem sheet "Hướng dẫn".'
guide.font = { size: 10, italic: true, color: { argb: 'FF555555' } }
guide.alignment = { vertical: 'middle', wrapText: true }
ws.getRow(2).height = 28

const header = ws.getRow(HEADER_ROW)
COLUMNS.forEach((c, i) => {
  const cell = header.getCell(i + 1)
  cell.value = c.required ? `${c.label} *` : c.label
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = { bottom: { style: 'thin' } }
  if (c.hint) cell.note = c.hint
  ws.getColumn(i + 1).width = c.width
})
header.height = 34

// Dòng trống có viền sẵn để Sale gõ vào — 30 dòng là đủ cho một tờ báo giá.
for (let r = HEADER_ROW + 1; r <= HEADER_ROW + 30; r++) {
  ws.getRow(r).height = 56 // cao để ảnh chèn vào nhìn được
  for (let c = 1; c <= COLUMNS.length; c++) {
    ws.getCell(r, c).border = {
      top: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      left: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
      right: { style: 'hair', color: { argb: 'FFDDDDDD' } },
    }
  }
}

// ── Sheet 2: ví dụ (KHÔNG nạp — để Sale nhìn cho biết điền kiểu gì) ─────────
const ex = wb.addWorksheet('Ví dụ')
ex.addRow(COLUMNS.map((c) => c.label))
ex.getRow(1).font = { bold: true }
ex.addRow([
  '',
  'H24-206',
  'Ghế đan mây Rattan',
  'Rattan armchair with cushion',
  '(chèn ảnh)',
  548,
  565,
  876,
  'ALU + PE rattan',
  'PM363_PE+PM24',
  2,
  59.5,
  91,
  78,
  12.5,
  14,
  910,
  'cai',
  45.9,
  'SP mới — chưa có mã HG',
])
ex.addRow([
  'CH0065HG-AL',
  'H24-206',
  'Ghế đan mây Rattan',
  '',
  '',
  548,
  565,
  876,
  '',
  '',
  2,
  '',
  '',
  '',
  '',
  '',
  '',
  'cai',
  47.5,
  'SP đã có — chỉ báo giá mới',
])
COLUMNS.forEach((c, i) => (ex.getColumn(i + 1).width = c.width))

// ── Sheet 3: hướng dẫn ──────────────────────────────────────────────────────
const hd = wb.addWorksheet('Hướng dẫn')
hd.getColumn(1).width = 110
const lines = [
  ['MẪU BÁO GIÁ — SẢN PHẨM MỚI', true],
  ['', false],
  ['1. Mỗi dòng là MỘT sản phẩm. Điền từ dòng 4 của sheet "Báo giá".', false],
  ['2. Cột có dấu * là bắt buộc: Tên SP, ba số kích thước, Đơn giá.', false],
  ['', false],
  ['3. KÍCH THƯỚC — theo đúng bảng kê quy cách của công ty:', true],
  ['      KTTT: 548 x 565 x 876   (L/D x W x H) mm', false],
  ['   tức Dài (hay Sâu) × Rộng × Cao, đơn vị MILIMÉT.', false],
  ['   Không điền cm. Nếu bản vẽ ghi cm thì nhân 10 trước khi điền.', false],
  ['', false],
  ['4. ẢNH: Insert → Picture → thả đè lên ô cột "Ảnh" của đúng dòng sản phẩm.', false],
  ['   Mỗi dòng một ảnh. Ảnh nằm lệch dòng thì hệ thống gắn nhầm sản phẩm.', false],
  ['', false],
  ['5. Mã SP (HG): để TRỐNG nếu là sản phẩm mới — hệ thống tự tạo hồ sơ và mã.', false],
  [
    '   Nếu sản phẩm đã có trong thư viện thì điền mã để hệ thống khớp, không tạo trùng.',
    false,
  ],
  ['', false],
  [
    '6. Sau khi tải lên, hệ thống hiện MÀN XEM TRƯỚC: dòng nào khớp SP cũ, dòng nào',
    false,
  ],
  ['   sẽ tạo SP mới, dòng nào thiếu thông tin. Kiểm xong bấm Lưu thì mới ghi.', false],
  ['', false],
  ['7. Sheet "Ví dụ" chỉ để tham khảo — hệ thống KHÔNG đọc sheet đó.', false],
]
lines.forEach(([text, bold]) => {
  const row = hd.addRow([text])
  row.getCell(1).font = { bold: Boolean(bold), size: bold ? 12 : 11 }
  row.getCell(1).alignment = { wrapText: true }
})

mkdirSync(dirname(OUT), { recursive: true })
await wb.xlsx.writeFile(OUT)
console.log('✓ đã tạo', OUT)
console.log(
  '  cột:',
  COLUMNS.length,
  '· dòng nhập sẵn: 30 · sheet: Báo giá / Ví dụ / Hướng dẫn',
)
