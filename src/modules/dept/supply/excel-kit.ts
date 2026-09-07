import ExcelJS from 'exceljs'

/**
 * KHUÔN CHUNG CHO FILE EXCEL CỦA CUNG ỨNG (07/09/2026).
 *
 * Trước đó mỗi builder tự bày một kiểu: `lsx-detail-excel` có freeze ở sheet
 * bảng kê nhưng không có ở sheet đơn mua, `lsx-supply-excel` không có cái nào;
 * cả hai đều ghi NGÀY THÀNH CHUỖI nên trong Excel không sắp/lọc/trừ ngày được;
 * không file nào bật lọc tự động hay đặt trang in. Người nhận mở ra là phải tự
 * kéo cột, tự bật Filter, in ra thì mất dòng tiêu đề ở trang 2.
 *
 * Gom về một chỗ để hai file (và file sau này) cùng một nếp. KHÔNG áp cho
 * `po-excel.ts` — đó là PHIẾU IN gửi nhà cung cấp, khuôn cột đã duyệt theo 12
 * mẫu giấy, không phải bảng dữ liệu.
 */

/** Nền tiêu đề — tint của --primary trong theme v3. */
export const ACCENT = 'FFEEF1FC'
const GRID = 'FFD9DEEA'
const MUTED = 'FF6B7280'

export const DATE_FMT = 'dd/mm/yyyy'

/**
 * Số: 0 hiện thành ô TRỐNG nhưng ô VẪN LÀ SỐ.
 *
 * Trước đây các builder ghi `x || ''` cho đẹp mắt, tức là nhét chuỗi rỗng vào
 * cột số — cột thành nửa số nửa chữ, lọc "lớn hơn 0" và SUM đều lệch. Định
 * dạng ba khoảng (dương;âm;không) làm đúng việc đó ở tầng hiển thị.
 *
 * BẪY (user báo 07/09/2026; đã dính một lần ở product-excel): mã `#,##0.##`
 * VẪN in dấu thập phân khi phần lẻ bằng 0 — 297 hiện ra "297," trên Excel
 * tiếng Việt. Đặt numFmt theo CỘT là dính bẫy ngay, vì cột nào cũng có cả số
 * nguyên lẫn số lẻ. Dùng `numberCells()` để chọn mã theo chính giá trị ô.
 */
export const NUM_FMT = '#,##0;-#,##0;""'
/** Chỉ dùng cho ô CÓ phần lẻ — xem bẫy ở trên. */
export const NUM_FMT_LE = '#,##0.##;-#,##0.##;""'
export const MONEY_FMT = '#,##0;-#,##0;""'
export const PCT_FMT = '0%;;""'

/**
 * Ô NGÀY THẬT, không phải chuỗi "31/8/2026".
 *
 * exceljs đổi Date sang số Excel bằng `getTime()` thuần (xem
 * `utils.dateToExcel`), nên phải dựng ở nửa đêm UTC — dùng `new Date(y, m, d)`
 * theo giờ máy thì ở múi +7 ra 17:00 hôm trước và Excel hiển thị lùi một ngày.
 */
export function dateCell(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

/** Tên tệp/tác giả để người nhận biết file ở đâu ra. */
export function stampWorkbook(wb: ExcelJS.Workbook, title: string): void {
  wb.creator = 'HG ERP'
  wb.lastModifiedBy = 'HG ERP'
  wb.created = new Date()
  wb.title = title
  wb.company = 'Hoàng Gia'
}

/** Dòng tiêu đề lớn đầu sheet. */
export function titleRow(ws: ExcelJS.Worksheet, text: string, size = 13): ExcelJS.Row {
  const r = ws.addRow([text])
  r.font = { bold: true, size }
  return r
}

/** Dòng chú thích xám dưới tiêu đề. */
export function noteRow(
  ws: ExcelJS.Worksheet,
  text: string,
  tone: 'muted' | 'warn' = 'muted',
): ExcelJS.Row {
  const r = ws.addRow([text])
  r.getCell(1).font =
    tone === 'warn'
      ? { bold: true, color: { argb: 'FFB45309' } }
      : { color: { argb: MUTED }, size: 10 }
  return r
}

/**
 * BẪY (đo 07/09/2026): `column.alignment = …` / `column.numFmt = …` của exceljs
 * ĐÈ LÊN MỌI Ô ĐANG CÓ trong cột, kể cả ô tiêu đề. Đặt cột số căn phải sau khi
 * dựng tiêu đề là tiêu đề mất `wrapText` — "Còn phải đặt" trong cột rộng 13 bị
 * cắt mất chữ. Vì vậy kiểu của hàng tiêu đề được ĐÓNG LẠI trong `finishTable`,
 * chạy sau cùng.
 */
function styleHeader(head: ExcelJS.Row): void {
  head.font = { bold: true, size: 10 }
  head.height = 30
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    c.border = {
      top: { style: 'thin', color: { argb: GRID } },
      left: { style: 'thin', color: { argb: GRID } },
      right: { style: 'thin', color: { argb: GRID } },
      bottom: { style: 'medium', color: { argb: 'FF9AA6C8' } },
    }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
}

/** Hàng tiêu đề cột: đậm, nền tint, xuống dòng trong ô, viền dưới. */
export function headerRow(ws: ExcelJS.Worksheet, cols: string[]): ExcelJS.Row {
  const head = ws.addRow(cols)
  styleHeader(head)
  return head
}

export function applyWidths(
  ws: ExcelJS.Worksheet,
  widths: number[],
  fallback = 14,
): void {
  ws.columns.forEach((c, i) => {
    c.width = widths[i] ?? fallback
  })
}

/**
 * ĐÓNG BẢNG: lọc tự động + ghim tiêu đề + kẻ lưới + đặt trang in.
 *
 * Gọi SAU khi đã đổ hết dòng. `head` là hàng tiêu đề cột do `headerRow` trả về;
 * mọi thứ tính từ đó nên thêm/bớt dòng mô tả phía trên không phải sửa gì.
 */
export function finishTable(
  ws: ExcelJS.Worksheet,
  opts: {
    head: ExcelJS.Row
    /** Hàng cuối của vùng dữ liệu. Mặc định: hàng cuối của sheet. */
    lastRow?: number
    /** Số cột ghim bên trái (0 = không ghim). */
    freezeCols?: number
    /** Bảng phụ nối dưới cùng sheet thì tắt lọc để khỏi trùm lên nó. */
    autoFilter?: boolean
    landscape?: boolean
  },
): void {
  const { head, freezeCols = 0, autoFilter = true, landscape = true } = opts
  const lastRow = opts.lastRow ?? ws.rowCount
  const lastCol = head.cellCount

  // Đóng lại kiểu tiêu đề SAU khi cột đã đặt numFmt/căn lề — xem styleHeader.
  styleHeader(head)

  if (autoFilter && lastRow > head.number) {
    ws.autoFilter = {
      from: { row: head.number, column: 1 },
      to: { row: lastRow, column: lastCol },
    }
  }

  ws.views = [{ state: 'frozen', xSplit: freezeCols || undefined, ySplit: head.number }]

  // Kẻ lưới nhạt cho vùng dữ liệu — in ra mới dò được dòng, và số căn phải thì
  // không có viền là hai cột số dính vào nhau.
  for (let r = head.number + 1; r <= lastRow; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= lastCol; c++) {
      row.getCell(c).border = {
        top: { style: 'hair', color: { argb: GRID } },
        left: { style: 'hair', color: { argb: GRID } },
        right: { style: 'hair', color: { argb: GRID } },
        bottom: { style: 'hair', color: { argb: GRID } },
      }
    }
  }

  ws.pageSetup = {
    orientation: landscape ? 'landscape' : 'portrait',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    // Lặp hàng tiêu đề ở mọi trang in — bảng vật tư luôn dài hơn một trang.
    printTitlesRow: `${head.number}:${head.number}`,
  }
  ws.headerFooter = {
    oddFooter: '&L&"Calibri,Italic"&9HG ERP&C&9Trang &P/&N&R&9In &D',
  }
}

/** Định dạng số cho một loạt cột (1-based). */
export function numberCols(
  ws: ExcelJS.Worksheet,
  cols: number[],
  fmt: string = NUM_FMT,
): void {
  for (const c of cols) {
    const col = ws.getColumn(c)
    col.numFmt = fmt
    col.alignment = { horizontal: 'right' }
  }
}

/**
 * ĐỊNH DẠNG SỐ THEO TỪNG Ô — số nguyên mang mã không có phần lẻ, số lẻ mới
 * mang mã có phần lẻ. Xem bẫy "297," ở NUM_FMT.
 *
 * Gọi SAU khi đã đổ hết dòng và sau `numberCols` (căn lề vẫn lấy từ cột).
 */
export function numberCells(
  ws: ExcelJS.Worksheet,
  cols: number[],
  opts: { from: number; to: number; digits?: number } & { money?: boolean },
): void {
  const le = opts.digits
    ? `#,##0.${'#'.repeat(opts.digits)};-#,##0.${'#'.repeat(opts.digits)};""`
    : NUM_FMT_LE
  for (let r = opts.from; r <= opts.to; r++) {
    const row = ws.getRow(r)
    for (const c of cols) {
      const cell = row.getCell(c)
      const v = cell.value
      if (typeof v !== 'number') continue
      cell.numFmt = opts.money || Number.isInteger(v) ? MONEY_FMT : le
      cell.alignment = { horizontal: 'right' }
    }
  }
}

/** Định dạng ngày cho một loạt cột (1-based). */
export function dateCols(ws: ExcelJS.Worksheet, cols: number[]): void {
  for (const c of cols) {
    const col = ws.getColumn(c)
    col.numFmt = DATE_FMT
    col.alignment = { horizontal: 'center' }
  }
}

/**
 * DÒNG TỔNG cuối bảng — đậm, gạch trên, nền tint.
 * `cells` là map cột (1-based) → giá trị.
 */
export function totalRow(
  ws: ExcelJS.Worksheet,
  label: string,
  cells: Record<number, ExcelJS.CellValue>,
  labelCol = 2,
): ExcelJS.Row {
  const r = ws.addRow([])
  r.getCell(labelCol).value = label
  for (const [c, v] of Object.entries(cells)) r.getCell(Number(c)).value = v
  r.font = { bold: true }
  r.eachCell({ includeEmpty: true }, (c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    c.border = { top: { style: 'medium', color: { argb: 'FF9AA6C8' } } }
  })
  return r
}

/**
 * DÒNG TIÊU ĐỀ KHỐI trong thân bảng — thay cho việc lặp lại tên nhóm ở mọi dòng.
 *
 * Lặp "Bu lông - vít - đinh - liên kết" xuống 100 dòng làm tờ giấy đọc như một
 * bức tường chữ (user chê "rất thô", 07/09/2026), trong khi chính sổ tay của
 * phòng dùng dòng tiêu đề khối cho danh sách dài (file LSX 06.26.27: "BÀN
 * BALKON - SƠN GRAPHIT - 50 cái" rồi mới tới các dòng vật tư).
 *
 * ĐÁNH ĐỔI: bảng có dòng khối thì lọc tự động của Excel không dùng được nữa —
 * lọc sẽ giấu mất dòng tiêu đề và người đọc mất luôn ngữ cảnh. Tờ này để ĐỌC và
 * IN; ai cần lọc thì lọc trên màn hình.
 */
export function groupRow(
  ws: ExcelJS.Worksheet,
  text: string,
  lastCol: number,
  opts: { sub?: boolean } = {},
): ExcelJS.Row {
  const r = ws.addRow([text])
  ws.mergeCells(r.number, 1, r.number, lastCol)
  const c = r.getCell(1)
  c.font = { bold: !opts.sub, size: opts.sub ? 10 : 11 }
  c.alignment = { vertical: 'middle', indent: opts.sub ? 2 : 0 }
  r.height = opts.sub ? 16 : 20
  // Quét cả dải: tô nền ô CHỦ thôi thì ô gộp chỉ có màu ở nửa bên trái.
  for (let i = 1; i <= lastCol; i++) {
    const cell = r.getCell(i)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: opts.sub ? 'FFF3F5FA' : ACCENT },
    }
    cell.border = {
      top: { style: opts.sub ? 'hair' : 'thin', color: { argb: GRID } },
      bottom: { style: opts.sub ? 'hair' : 'thin', color: { argb: GRID } },
    }
  }
  return r
}

/**
 * ẨN CỘT KHÔNG CÓ GÌ trong vùng dữ liệu.
 *
 * Bảng kê có sẵn cột cho mọi tình huống (đã xuất, tồn, đã đặt, nháp/chờ ký, đã
 * về…), nhưng một lệnh cụ thể thường chỉ dùng vài cột — số còn lại là năm cột
 * trắng chiếm gần một phần ba bề ngang. Ẩn chứ KHÔNG xoá: cột vẫn còn đó, ai
 * cần thì bỏ ẩn trong Excel, và chỉ số cột không đổi nên code không phải tính
 * lại theo dữ liệu.
 */
export function hideEmptyCols(
  ws: ExcelJS.Worksheet,
  cols: number[],
  range: { from: number; to: number },
): void {
  for (const c of cols) {
    let coGi = false
    for (let r = range.from; r <= range.to && !coGi; r++) {
      const cell = ws.getRow(r).getCell(c)
      // BỎ QUA Ô GỘP: dòng tiêu đề khối gộp hết bề ngang, nên đọc ô ở BẤT KỲ
      // cột nào của dòng đó cũng trả về chữ của ô chủ — không bỏ qua thì cột
      // nào cũng "có giá trị" và hàm này chẳng ẩn được gì.
      if (cell.isMerged) continue
      const v = cell.value
      if (v == null || v === '' || v === 0) continue
      coGi = true
    }
    if (!coGi) ws.getColumn(c).hidden = true
  }
}
