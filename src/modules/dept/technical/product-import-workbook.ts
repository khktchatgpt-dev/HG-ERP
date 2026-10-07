import ExcelJS from 'exceljs'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import {
  ASSEMBLY_OPTIONS,
  DEFAULT_UNIT,
  GROUP_ROW,
  HEADER_ROW,
  IMPORT_COLUMNS,
  IMPORT_FIRST_ROW,
  IMPORT_MAX_ROWS,
  IMPORT_SHEET,
  NOTE_ROW,
  columnForHeader,
  currentValue,
  exportValue,
  optionText,
  type CellValue,
  type ExistingProduct,
  type RawRow,
} from '@/lib/product-import'
import { cellValue } from './bom-workbook'

/**
 * FILE EXCEL của luồng thêm + cập nhật SP (07/10/2026) — xuất, đọc file đã sửa,
 * ghi mã vừa cấp trở lại. Tách khỏi service để test được cả vòng mà không nạp DB
 * (cùng lý do `bom-workbook.ts`).
 *
 * Bố cục: hàng 1 tên NHÓM (như trang chi tiết), hàng 2 TIÊU ĐỀ (đọc lại theo chữ
 * này), hàng 3 ghi chú, dữ liệu từ hàng 4. Ghim 2 cột trái (Mã · Tên) và 3 hàng
 * đầu — 46 cột mà cuộn mất tên SP thì không biết đang sửa dòng nào.
 */

const LIST_SHEET = 'Danh mục'
const GUIDE_SHEET = 'Hướng dẫn'
const letter = (n: number): string => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s // prettier-ignore
  return s
}

/** Lỗi hình dạng file — service dịch sang 400 với đúng câu này. */
export class ImportFileError extends Error {}

const FILL_HEAD = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8EEFB' } } // prettier-ignore
const FILL_GROUP = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDCE4F7' } } // prettier-ignore

/**
 * File Excel: sheet "Sản phẩm" (có thể rỗng = file mẫu để thêm mới) + "Danh mục"
 * (nguồn ô thả xuống) + "Hướng dẫn". `products` rỗng = file mẫu trống.
 */
export async function buildProductWorkbook(
  products: readonly ExistingProduct[],
  customerLabels: readonly string[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const ws = wb.addWorksheet(IMPORT_SHEET, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: NOTE_ROW }],
  })
  const lists = wb.addWorksheet(LIST_SHEET)
  const guide = wb.addWorksheet(GUIDE_SHEET)

  ws.columns = IMPORT_COLUMNS.map((c) => ({ width: c.width }))

  // Hàng NHÓM — gộp ô theo từng nhóm liền nhau.
  let start = 1
  IMPORT_COLUMNS.forEach((c, i) => {
    const next = IMPORT_COLUMNS[i + 1]
    if (next && next.group === c.group) return
    const end = i + 1
    if (c.group) {
      if (end > start) ws.mergeCells(GROUP_ROW, start, GROUP_ROW, end)
      const cell = ws.getCell(GROUP_ROW, start)
      cell.value = c.group.toUpperCase()
      cell.font = { bold: true, size: 9, color: { argb: 'FF3F4756' } }
      cell.fill = FILL_GROUP
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    start = end + 1
  })

  IMPORT_COLUMNS.forEach((c, i) => {
    const h = ws.getCell(HEADER_ROW, i + 1)
    h.value = c.required
      ? { richText: [{ text: `${c.header} ` }, { text: '*', font: { bold: true, color: { argb: 'FFB0241A' } } }] } // prettier-ignore
      : c.header
    h.font = { bold: true }
    h.fill = FILL_HEAD
    h.alignment = { vertical: 'middle', wrapText: true }
    const n = ws.getCell(NOTE_ROW, i + 1)
    n.value = c.note ?? (c.kind === 'version' ? 'Hệ thống dùng — đừng sửa' : null)
    n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    n.alignment = { vertical: 'top', wrapText: true }
  })
  ws.getRow(HEADER_ROW).height = 32
  ws.getRow(NOTE_ROW).height = 24
  ws.getCell(NOTE_ROW, 2).value = 'Ô trống = giữ nguyên · gõ "-" = xoá trắng'

  // Dữ liệu.
  products.forEach((p, r) => {
    const rowNo = IMPORT_FIRST_ROW + r
    IMPORT_COLUMNS.forEach((c, i) => {
      const cell = ws.getCell(rowNo, i + 1)
      if (c.kind === 'code') cell.value = p.code
      else if (c.kind === 'version') cell.value = p.updated_at
      else cell.value = exportValue(c, currentValue(p, c))
    })
  })

  // Danh mục — nguồn ô thả xuống. Tải file lúc nào thì danh sách mới lúc đó.
  const listCols: [string, string[]][] = [
    ['Loại sản phẩm', PRODUCT_TYPES.map(optionText)],
    ['Vật liệu khung', FRAME_MATERIALS.map(optionText)],
    ['Khách hàng / nhóm đang dùng', [...customerLabels]],
    ['ĐVT', [DEFAULT_UNIT, 'bộ']],
    ['Lắp ráp', ASSEMBLY_OPTIONS.map((o) => o.label)],
    ['Có / không', ['có', 'không']],
  ]
  lists.columns = listCols.map(() => ({ width: 30 }))
  listCols.forEach(([title, values], i) => {
    const c = lists.getCell(1, i + 1)
    c.value = title
    c.font = { bold: true }
    values.forEach((v, r) => (lists.getCell(r + 2, i + 1).value = v))
  })
  const range = (listCol: number, count: number) =>
    `'${LIST_SHEET}'!$${letter(listCol)}$2:$${letter(listCol)}$${Math.max(2, count + 1)}`
  /*
    Ô thả xuống. Loại / Vật liệu / Lắp ráp CẢNH BÁO khi gõ ngoài danh sách — server
    vẫn nhận "Bàn", "TB"… nên gõ tay lọt qua cũng không sao. Khách / ĐVT / có-không
    chỉ GỢI Ý (tắt báo lỗi): nhãn khách gõ tự do (0091), và "-" phải gõ được.
  */
  const list = (formula: string, strict: boolean) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: strict,
    errorStyle: 'warning' as const,
    errorTitle: 'Ngoài danh sách',
    error: 'Chọn trong danh sách thả xuống (gõ "-" để xoá trắng)',
  })
  const validation: Partial<Record<string, ReturnType<typeof list>>> = {
    type: list(range(1, PRODUCT_TYPES.length), true),
    material: list(range(2, FRAME_MATERIALS.length), true),
    customer: list(range(3, customerLabels.length), false),
    unit: list(range(4, 2), false),
    assembly: list(range(5, ASSEMBLY_OPTIONS.length), true),
  }
  const lastRow = IMPORT_FIRST_ROW + Math.max(products.length, 0) + 300
  IMPORT_COLUMNS.forEach((c, i) => {
    const v = c.kind === 'bool' ? list(range(6, 2), false) : validation[c.key]
    const colNo = i + 1
    if (c.kind === 'code') ws.getColumn(colNo).numFmt = '@' // "0052" không thành 52
    if (c.kind === 'version') ws.getColumn(colNo).hidden = true
    if (!v) return
    for (let r = IMPORT_FIRST_ROW; r <= lastRow; r++)
      ws.getCell(r, colNo).dataValidation = v
  })

  guide.columns = [{ width: 120 }]
  const lines = [
    'THÊM VÀ CẬP NHẬT SẢN PHẨM BẰNG EXCEL — HG-ERP',
    '',
    `1. Sheet "${IMPORT_SHEET}": mỗi dòng một sản phẩm, dữ liệu từ hàng ${IMPORT_FIRST_ROW}. Hàng 1–3 là nhóm, tiêu đề, ghi chú — đừng xoá.`,
    '2. Dòng CÓ "Mã nội bộ" → CẬP NHẬT sản phẩm đó. Dòng KHÔNG mã → THÊM MỚI, hệ thống tự cấp mã [loại][số]HG-[vật liệu].',
    '3. Ô TRỐNG = GIỮ NGUYÊN giá trị đang có. Muốn xoá trắng một ô thì gõ dấu "-".',
    '4. Số gõ kiểu Việt Nam: 1.390 = một nghìn ba trăm chín mươi, 2,5 = hai phẩy năm. Ô có/không: gõ "có" hoặc "không".',
    '5. SP mới bắt buộc: Tên SP (tiếng Việt), Loại sản phẩm, Vật liệu khung. ĐVT trống = "cái".',
    '6. Cột thừa có thể xoá — cột vắng thì hệ thống không đụng tới. Đừng sửa cột ẩn "Phiên bản" (dùng để biết SP có bị sửa trên web sau khi xuất).',
    `7. Tối đa ${IMPORT_MAX_ROWS} dòng một lần. Dòng trống bị bỏ qua.`,
    '',
    'Tải lên: Thư viện sản phẩm → Excel → Tải lên file đã sửa. Hệ thống soi trước từng dòng (thêm mới / cập nhật ô nào, cũ → mới / lỗi),',
    'CHƯA ghi gì cho tới khi bấm Ghi. Còn dòng lỗi thì chưa ghi được: sửa trong file rồi tải lại.',
    'Ghi xong, bấm "Tải file đã có mã" để lấy lại chính file này với mã SP mới đã điền — lưu đè bên mình để lần sau sửa tiếp.',
  ]
  lines.forEach((t, i) => {
    const c = guide.getCell(i + 1, 1)
    c.value = t
    if (i === 0) c.font = { bold: true, size: 13 }
  })

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Ô → giá trị thô: số giữ là SỐ (1,234 kg không thành "1.234" rồi bị đọc 1234). */
function raw(v: unknown): CellValue {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v : ''
  if (typeof v === 'boolean') return v ? 'có' : 'không'
  if (v instanceof Date) return v.toISOString()
  /*
    CHỈ cắt hai đầu + thống nhất xuống dòng. Bản đầu gộp MỌI khoảng trắng (cả
    xuống dòng) → xuất 807 SP thật rồi đọc lại ra 469 dòng "cập nhật" chỉ vì ghi
    chú nhiều dòng bị dồn thành một (đo 07/10) — ghi vào là phá ghi chú của
    người ta mà không ai sửa gì.
  */
  return String(v)
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .trim()
}

async function loadSheet(buffer: Buffer) {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new ImportFileError(
      'Không đọc được file — hãy lưu lại thành .xlsx rồi tải lên lại',
    )
  }
  const ws = wb.getWorksheet(IMPORT_SHEET) ?? wb.worksheets[0]
  if (!ws) throw new ImportFileError('File không có sheet nào')
  // Cột nào là gì: đọc theo TIÊU ĐỀ hàng 2, không theo vị trí.
  const colOf = new Map<string, number>()
  ws.getRow(HEADER_ROW).eachCell((cell, colNo) => {
    const c = columnForHeader(String(raw(cellValue(cell.value))))
    if (c && !colOf.has(c.key)) colOf.set(c.key, colNo)
  })
  if (!colOf.has('name') || !colOf.has('code')) {
    throw new ImportFileError(
      `File không dùng mẫu: hàng ${HEADER_ROW} phải có cột "Mã nội bộ" và "Tên SP (tiếng Việt)". Xuất file từ Thư viện sản phẩm rồi sửa trên đó.`,
    )
  }
  return { wb, ws, colOf }
}

/** Đọc các dòng có dữ liệu từ hàng 4. Quá giới hạn → lỗi, không cắt ngầm. */
export async function readImportRows(
  buffer: Buffer,
): Promise<{ rows: RawRow[]; blank: number; sheet: string; columns: string[] }> {
  const { ws, colOf } = await loadSheet(buffer)
  const rows: RawRow[] = []
  for (let r = IMPORT_FIRST_ROW; r <= ws.rowCount; r++) {
    const cells: Record<string, CellValue> = {}
    let any = false
    for (const [key, colNo] of colOf) {
      const v = raw(cellValue(ws.getCell(r, colNo).value))
      cells[key] = v
      // Cột "Phiên bản" một mình không làm dòng thành có dữ liệu.
      if (v !== '' && key !== 'version') any = true
    }
    if (any) rows.push({ row: r, cells })
  }
  // Dòng trống GIỮA các dòng dữ liệu — dòng trống đuôi (định dạng kéo dài) không tính.
  const lastData = rows.at(-1)?.row ?? IMPORT_FIRST_ROW - 1
  const blank = Math.max(0, lastData - (IMPORT_FIRST_ROW - 1) - rows.length)
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `File có ${rows.length} dòng — tối đa ${IMPORT_MAX_ROWS} dòng một lần. Chia làm nhiều file.`,
    )
  }
  return { rows, blank, sheet: ws.name, columns: [...colOf.keys()] }
}

/**
 * Chính file người dùng gửi, ô Mã nội bộ điền mã vừa cấp + ô Phiên bản điền
 * phiên bản mới — để lần sửa tiếp theo trên chính file đó không bị báo "đã sửa
 * trên web sau khi xuất".
 */
export async function fillWritten(
  buffer: Buffer,
  written: readonly { row: number; code: string; version: string }[],
): Promise<Buffer> {
  const { wb, ws, colOf } = await loadSheet(buffer)
  const codeCol = colOf.get('code')!
  const verCol = colOf.get('version')
  for (const w of written) {
    const c = ws.getCell(w.row, codeCol)
    c.numFmt = '@'
    c.value = w.code
    if (verCol) ws.getCell(w.row, verCol).value = w.version
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
