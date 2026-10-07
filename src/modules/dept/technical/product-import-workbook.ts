import ExcelJS from 'exceljs'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import {
  DEFAULT_UNIT,
  IMPORT_COLUMNS,
  IMPORT_FIRST_ROW,
  IMPORT_MAX_ROWS,
  IMPORT_SHEET,
  isBlankCells,
  optionText,
  type ImportField,
  type RawRow,
} from '@/lib/product-import'
import { cellValue } from './bom-workbook'

/**
 * FILE EXCEL của luồng thêm SP hàng loạt (07/10/2026) — dựng mẫu, đọc file đã
 * điền, ghi mã vừa cấp trở lại. Tách khỏi service để test được cả vòng mà không
 * nạp DB (cùng lý do `bom-workbook.ts`).
 */

const LIST_SHEET = 'Danh mục'
const GUIDE_SHEET = 'Hướng dẫn'
const LAST_ROW = IMPORT_FIRST_ROW + IMPORT_MAX_ROWS - 1
const colOf = (key: ImportField) => IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1
const letter = (n: number) => String.fromCharCode(64 + n)

/** Lỗi hình dạng file — service dịch sang 400 với đúng câu này. */
export class ImportFileError extends Error {}

/**
 * File mẫu: sheet "Nhập SP" (tiêu đề + ghi chú + ô thả xuống), "Danh mục"
 * (nguồn của ô thả xuống — tải lúc nào thì danh sách mới lúc đó), "Hướng dẫn".
 */
export async function buildImportTemplate(
  customerLabels: readonly string[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const ws = wb.addWorksheet(IMPORT_SHEET, {
    views: [{ state: 'frozen', ySplit: IMPORT_FIRST_ROW - 1 }],
  })
  const lists = wb.addWorksheet(LIST_SHEET)
  const guide = wb.addWorksheet(GUIDE_SHEET)

  ws.columns = IMPORT_COLUMNS.map((c) => ({ width: c.width }))
  const head = ws.getRow(1)
  const note = ws.getRow(2)
  IMPORT_COLUMNS.forEach((c, i) => {
    const h = head.getCell(i + 1)
    h.value = c.required
      ? { richText: [{ text: `${c.header} ` }, { text: '*', font: { bold: true, color: { argb: 'FFB0241A' } } }] } // prettier-ignore
      : c.header
    h.font = { bold: true }
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFB' } }
    h.alignment = { vertical: 'middle', wrapText: true }
    const n = note.getCell(i + 1)
    n.value = c.note
    n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    n.alignment = { vertical: 'top', wrapText: true }
  })
  head.height = 32
  note.height = 30

  // Danh mục — cột A loại, B vật liệu, C nhãn khách, D ĐVT.
  const listCols: [string, string[]][] = [
    ['Loại sản phẩm', PRODUCT_TYPES.map(optionText)],
    ['Vật liệu khung', FRAME_MATERIALS.map(optionText)],
    ['Khách hàng / nhóm đang dùng', [...customerLabels]],
    ['ĐVT', [DEFAULT_UNIT, 'bộ']],
  ]
  lists.columns = listCols.map(() => ({ width: 30 }))
  listCols.forEach(([title, values], i) => {
    const c = lists.getCell(1, i + 1)
    c.value = title
    c.font = { bold: true }
    values.forEach((v, r) => (lists.getCell(r + 2, i + 1).value = v))
  })
  const range = (col: number, count: number) =>
    `'${LIST_SHEET}'!$${letter(col)}$2:$${letter(col)}$${Math.max(2, count + 1)}`

  /*
    Ô thả xuống. Loại / Vật liệu BẮT chọn trong danh sách (cảnh báo dừng của
    Excel) — server vẫn nhận "Bàn", "TB"… nên gõ tay lọt qua cũng không sao.
    Khách / ĐVT chỉ GỢI Ý (tắt thông báo lỗi): nhãn khách gõ tự do (0091).
  */
  const strict = (formula: string, title: string) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: 'warning' as const,
    errorTitle: title,
    error: 'Chọn trong danh sách thả xuống',
  })
  const loose = (formula: string) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: false,
  })
  for (let r = IMPORT_FIRST_ROW; r <= LAST_ROW; r++) {
    ws.getCell(r, colOf('type')).dataValidation = strict(range(1, PRODUCT_TYPES.length), 'Loại sản phẩm') // prettier-ignore
    ws.getCell(r, colOf('material')).dataValidation = strict(range(2, FRAME_MATERIALS.length), 'Vật liệu khung') // prettier-ignore
    ws.getCell(r, colOf('customer')).dataValidation = loose(
      range(3, customerLabels.length),
    )
    ws.getCell(r, colOf('unit')).dataValidation = loose(range(4, 2))
    // Mã là CHỮ: "0052" không được thành số 52.
    ws.getCell(r, colOf('code')).numFmt = '@'
  }

  guide.columns = [{ width: 110 }]
  const lines = [
    'THÊM SẢN PHẨM HÀNG LOẠT — HG-ERP',
    '',
    '1. Điền ở sheet "Nhập SP", mỗi dòng một sản phẩm, bắt đầu từ hàng 3. Hàng 1–2 là tiêu đề và ghi chú, đừng xoá.',
    '2. Bắt buộc: Loại sản phẩm, Vật liệu khung, Tên SP (tiếng Việt). Chọn Loại / Vật liệu trong danh sách thả xuống.',
    '3. Mã nội bộ: để TRỐNG thì hệ thống tự cấp theo quy tắc [loại][số thứ tự]HG-[vật liệu], ví dụ TB0301HG-AL.',
    '   Chỉ gõ mã khi SP đã có mã cũ không theo quy tắc. Gõ mã đã có trong thư viện là lỗi — file này chỉ THÊM MỚI.',
    '4. Khách hàng / nhóm: gõ tự do, hệ thống viết hoa. Danh sách gợi ý ở sheet "Danh mục". Trống = mẫu chung.',
    '5. ĐVT bán: trống thì lấy "cái".',
    `6. Tối đa ${IMPORT_MAX_ROWS} dòng một lần. Dòng trống bị bỏ qua.`,
    '',
    'Tải lên: Thư viện sản phẩm → Nhập từ Excel → Tải lên file đã điền.',
    'Hệ thống soi trước từng dòng (mã sẽ cấp, lỗi, cảnh báo), CHƯA ghi gì cho tới khi bấm "Thêm".',
    'Còn dòng lỗi thì chưa thêm được cả lô: sửa trong file rồi tải lại.',
    'Thêm xong, bấm "Tải file đã có mã" để lấy lại chính file này với ô Mã nội bộ đã điền — lưu đè bên mình.',
  ]
  lines.forEach((t, i) => {
    const c = guide.getCell(i + 1, 1)
    c.value = t
    if (i === 0) c.font = { bold: true, size: 13 }
  })

  return Buffer.from(await wb.xlsx.writeBuffer())
}

const text = (v: unknown): string => {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
    .replace(/[\s ]+/g, ' ')
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
  // Nhận diện mẫu bằng tiêu đề cột Tên — chữ người dùng ít khi sửa nhất.
  const nameHead = text(cellValue(ws.getCell(1, colOf('name')).value))
  if (!nameHead.startsWith('Tên SP')) {
    throw new ImportFileError(
      `File không dùng mẫu: ô ${letter(colOf('name'))}1 phải là "Tên SP (tiếng Việt)". Tải file mẫu rồi chép dữ liệu sang.`,
    )
  }
  return { wb, ws }
}

/** Đọc các dòng có dữ liệu từ hàng 3. Quá giới hạn → lỗi, không cắt ngầm. */
export async function readImportRows(
  buffer: Buffer,
): Promise<{ rows: RawRow[]; blank: number; sheet: string }> {
  const { ws } = await loadSheet(buffer)
  const rows: RawRow[] = []
  let blank = 0
  for (let r = IMPORT_FIRST_ROW; r <= ws.rowCount; r++) {
    const cells = Object.fromEntries(
      IMPORT_COLUMNS.map((c, i) => [c.key, text(cellValue(ws.getCell(r, i + 1).value))]),
    ) as Record<ImportField, string>
    if (isBlankCells(cells)) {
      blank++
      continue
    }
    rows.push({ row: r, cells })
  }
  // Dòng trống ĐUÔI (định dạng kéo dài tới hàng 502) không phải dòng người ta bỏ trống.
  const lastData = rows.at(-1)?.row ?? IMPORT_FIRST_ROW - 1
  blank = Math.max(0, lastData - (IMPORT_FIRST_ROW - 1) - rows.length)
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `File có ${rows.length} dòng — tối đa ${IMPORT_MAX_ROWS} dòng một lần. Chia làm nhiều file.`,
    )
  }
  return { rows, blank, sheet: ws.name }
}

/** Chính file người dùng gửi, ô Mã nội bộ điền mã vừa cấp — để họ lưu đè bên mình. */
export async function fillCodes(
  buffer: Buffer,
  codes: readonly { row: number; code: string }[],
): Promise<Buffer> {
  const { wb, ws } = await loadSheet(buffer)
  const col = colOf('code')
  for (const { row, code } of codes) {
    const c = ws.getCell(row, col)
    c.numFmt = '@'
    c.value = code
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
