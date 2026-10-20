import ExcelJS from 'exceljs'
import { createHash } from 'node:crypto'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import {
  SP_COLS,
  SP_FIRST_ROW,
  SP_HEADER_ROW,
  SP_MAX_ROWS,
  SP_NOTE_ROW,
  SP_SHEET,
  columnForHeader,
  currentValue,
  imageRef,
  optionText,
  type ExistingSp,
  type RawRow,
} from '@/lib/sp-excel'
import { cellValue } from './bom-workbook'

/**
 * FILE EXCEL của luồng thêm + cập nhật SP (09/10/2026) — ghi file xuất (ảnh
 * nhúng trong ô Ảnh, neo một ô) và đọc lại file đã sửa (ô theo TIÊU ĐỀ hàng 2,
 * ảnh nổi neo vào cột Ảnh). Byte → byte, không chạm DB.
 *
 * Chưa đọc ảnh "Đặt trong ô" của Excel 365 (cần lần xl/richData) — dán ảnh
 * thường (Ctrl+V) là ảnh nổi, đọc được.
 */

export type ImageBytes = { buffer: Buffer; ext: 'png' | 'jpeg' }
export class SpFileError extends Error {}

const LIST_SHEET = 'Danh mục'
const GUIDE_SHEET = 'Hướng dẫn'
const FILL = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
})
const LINE = { style: 'thin' as const, color: { argb: 'FFB9C2D0' } }
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE }
const letter = (n: number) => String.fromCharCode(64 + n)
const colOf = (key: string) => SP_COLS.findIndex((c) => c.key === key) + 1

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Sheet "Sản phẩm" (+ Danh mục + Hướng dẫn). `products` rỗng = file mẫu trống. */
export async function buildSpWorkbook(
  products: readonly ExistingSp[],
  images: ReadonlyMap<string, ImageBytes>,
  customers: readonly string[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const ws = wb.addWorksheet(SP_SHEET, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: SP_NOTE_ROW }],
  })
  const lists = wb.addWorksheet(LIST_SHEET)
  const guide = wb.addWorksheet(GUIDE_SHEET)
  ws.columns = SP_COLS.map((c) => ({ width: c.width }))

  let start = 1
  SP_COLS.forEach((c, i) => {
    const next = SP_COLS[i + 1]
    if (next && next.group === c.group) return
    if (c.group) {
      if (i + 1 > start) ws.mergeCells(1, start, 1, i + 1)
      const cell = ws.getCell(1, start)
      cell.value = c.group
      cell.font = { bold: true, size: 9, color: { argb: 'FF3A4252' } }
      cell.fill = FILL('FFDCE4F7')
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    start = i + 2
  })
  SP_COLS.forEach((c, i) => {
    const h = ws.getCell(SP_HEADER_ROW, i + 1)
    h.value = c.header
    h.font = { bold: true }
    h.fill = FILL('FFE8EEFB')
    h.alignment = { vertical: 'middle', wrapText: true }
    h.border = BORDER
    const n = ws.getCell(SP_NOTE_ROW, i + 1)
    n.value = c.note ?? null
    n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    n.fill = FILL('FFF1F3F7')
    n.alignment = { vertical: 'top', wrapText: true }
    if (c.kind === 'hidden') ws.getColumn(i + 1).hidden = true
    if (c.kind === 'code') ws.getColumn(i + 1).numFmt = '@'
  })
  ws.getRow(SP_HEADER_ROW).height = 30
  ws.getRow(SP_NOTE_ROW).height = 26

  let r = SP_FIRST_ROW
  for (const p of products) {
    const img = images.get(p.id)
    SP_COLS.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.border = BORDER
      cell.alignment = {
        vertical: 'middle',
        horizontal: c.kind === 'num' ? 'right' : 'left',
      }
      if (c.kind === 'image') return
      if (c.key === 'image_ref') {
        cell.value =
          img && p.image_file_id ? imageRef(p.image_file_id, sha256(img.buffer)) : null
        return
      }
      const v = currentValue(p, c.key)
      cell.value = v == null || v === '' ? null : v
    })
    if (img) {
      const id = wb.addImage({
        buffer: img.buffer as unknown as ExcelJS.Buffer,
        extension: img.ext,
      })
      ws.addImage(id, {
        tl: { col: colOf('image') - 1 + 0.06, row: r - 1 + 0.06 },
        ext: { width: 70, height: 52 },
        editAs: 'oneCell',
      })
      ws.getRow(r).height = 42
    } else ws.getRow(r).height = 24
    r++
  }
  for (let k = 0; k < 20; k++, r++)
    SP_COLS.forEach((c, i) => (ws.getCell(r, i + 1).border = BORDER))

  const listCols: [string, string[]][] = [
    ['Loại SP', PRODUCT_TYPES.map((t) => optionText(PRODUCT_TYPES, t.code))],
    ['Vật liệu khung', FRAME_MATERIALS.map((t) => optionText(FRAME_MATERIALS, t.code))],
    ['Khách / nhóm', [...customers]],
    ['ĐVT', ['cái', 'bộ']],
    ['Có / không', ['có', 'không']],
  ]
  lists.columns = listCols.map(() => ({ width: 28 }))
  listCols.forEach(([t, vals], i) => {
    lists.getCell(1, i + 1).value = t
    lists.getCell(1, i + 1).font = { bold: true }
    vals.forEach((v, j) => (lists.getCell(j + 2, i + 1).value = v))
  })
  const dv = (i: number, count: number, strict: boolean) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [`'${LIST_SHEET}'!$${letter(i)}$2:$${letter(i)}$${Math.max(2, count + 1)}`],
    showErrorMessage: strict,
    errorStyle: 'warning' as const,
    errorTitle: 'Ngoài danh sách',
    error: 'Chọn trong danh sách (gõ "-" để xoá trắng)',
  })
  const kinds: Record<string, ReturnType<typeof dv>> = {
    type: dv(1, PRODUCT_TYPES.length, true),
    mat: dv(2, FRAME_MATERIALS.length, true),
    cust: dv(3, customers.length, false),
    unit: dv(4, 2, false),
    bool: dv(5, 2, false),
  }
  SP_COLS.forEach((c, i) => {
    const v = kinds[c.kind]
    if (!v) return
    for (let rr = SP_FIRST_ROW; rr <= r + 300; rr++)
      ws.getCell(rr, i + 1).dataValidation = v
  })

  guide.columns = [{ width: 120 }]
  ;[
    'THÊM VÀ CẬP NHẬT SẢN PHẨM BẰNG EXCEL — HG-ERP',
    '',
    `1. Sheet "${SP_SHEET}": mỗi dòng một sản phẩm, dữ liệu từ hàng ${SP_FIRST_ROW}. Hàng 1–3 là nhóm, tiêu đề, ghi chú — đừng xoá.`,
    '2. Dòng CÓ "Mã nội bộ" → CẬP NHẬT sản phẩm đó. Dòng KHÔNG mã → THÊM MỚI, hệ thống tự cấp mã theo Loại + Vật liệu khung.',
    '3. Ô TRỐNG = GIỮ NGUYÊN giá trị đang có. Muốn xoá trắng một ô thì gõ dấu "-".',
    '4. Ảnh: dán ảnh (Ctrl+V) vào ô Ảnh. Ảnh có sẵn để nguyên = không đổi; dán ảnh khác = thay ảnh đại diện (ảnh cũ vẫn ở Tài liệu).',
    '5. Đóng gói: 8 ô là thùng của phương án MẶC ĐỊNH. SP nhiều phương án / nhiều kiện thì sửa trên hồ sơ.',
    '6. Số gõ kiểu Việt Nam: 1.390 = một nghìn ba trăm chín mươi; 2,5 = hai phẩy năm. Ô có/không: gõ "có" hoặc "không".',
    `7. Cột thừa có thể xoá — cột vắng thì hệ thống không đụng. Đừng sửa hai cột ẩn cuối. Tối đa ${SP_MAX_ROWS} dòng một lần.`,
    '',
    'Tải lên: Thư viện sản phẩm → Excel → Nhập file đã sửa. Hệ thống soi từng dòng (thêm / cập nhật ô nào / lỗi), CHƯA ghi gì cho tới khi bấm Ghi.',
    'Ghi xong, tải lại file đã có mã để lần sau sửa tiếp trên chính file đó.',
  ].forEach((t, i) => {
    guide.getCell(i + 1, 1).value = t
    if (i === 0) guide.getCell(1, 1).font = { bold: true, size: 13 }
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Ô → chuỗi thô (số giữ là số). Chỉ cắt hai đầu + thống nhất xuống dòng. */
function raw(v: unknown): string | number {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v : ''
  if (typeof v === 'boolean') return v ? 'có' : 'không'
  if (v instanceof Date) return v.toISOString()
  return String(v).replace(/\r\n?/g, '\n').trim()
}

async function loadSheet(buffer: Buffer) {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new SpFileError('Không đọc được file — lưu lại thành .xlsx rồi tải lên lại')
  }
  const ws = wb.getWorksheet(SP_SHEET) ?? wb.worksheets[0]
  if (!ws) throw new SpFileError('File không có sheet nào')
  const cols = new Map<string, number>()
  ws.getRow(SP_HEADER_ROW).eachCell((cell, colNo) => {
    const c = columnForHeader(String(raw(cellValue(cell.value))))
    if (c && !cols.has(c.key)) cols.set(c.key, colNo)
  })
  if (!cols.has('name') || !cols.has('code'))
    throw new SpFileError(
      `File không dùng mẫu: hàng ${SP_HEADER_ROW} phải có cột "Mã nội bộ" và "Tên SP". Tải file mẫu từ Thư viện sản phẩm rồi điền vào đó.`,
    )
  return { wb, ws, cols }
}

/** Ảnh nổi neo vào cột Ảnh — theo hàng của góc trên-trái. */
function rowImages(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  imageCol: number | undefined,
) {
  const out = new Map<number, ImageBytes>()
  if (!imageCol) return out
  for (const im of ws.getImages()) {
    const tl = im.range.tl as unknown as { nativeCol: number; nativeRow: number }
    const br = im.range.br as unknown as { nativeCol: number } | undefined
    const left = tl.nativeCol + 1
    const right = br ? br.nativeCol + 1 : left
    if (left > imageCol || right < imageCol) continue
    const row = tl.nativeRow + 1
    if (row < SP_FIRST_ROW || out.has(row)) continue
    const media = wb.getImage(Number(im.imageId)) as unknown as {
      buffer?: Buffer
      extension?: string
    }
    const ext = (media?.extension ?? '').toLowerCase()
    if (!media?.buffer || !['png', 'jpeg', 'jpg'].includes(ext)) continue
    out.set(row, {
      buffer: Buffer.from(media.buffer),
      ext: ext === 'png' ? 'png' : 'jpeg',
    })
  }
  return out
}

/** Đọc các dòng có dữ liệu từ hàng 4 (+ ảnh theo hàng). Quá giới hạn → lỗi, không cắt ngầm. */
export async function readSpWorkbook(buffer: Buffer): Promise<{
  rows: RawRow[]
  images: Map<number, ImageBytes>
  columns: string[]
}> {
  const { wb, ws, cols } = await loadSheet(buffer)
  const images = rowImages(wb, ws, cols.get('image'))
  const rows: RawRow[] = []
  const last = Math.max(ws.rowCount, ...images.keys(), SP_FIRST_ROW - 1)
  for (let r = SP_FIRST_ROW; r <= last; r++) {
    const cells: Record<string, string | number> = {}
    let any = images.has(r)
    for (const [key, colNo] of cols) {
      const v = raw(cellValue(ws.getCell(r, colNo).value))
      cells[key] = v
      if (v !== '' && key !== 'version' && key !== 'image_ref') any = true
    }
    if (!any) continue
    const img = images.get(r)
    rows.push({
      row: r,
      cells,
      image: img
        ? { sha: sha256(img.buffer), ext: img.ext, bytes: img.buffer.byteLength }
        : undefined,
    })
  }
  if (rows.length > SP_MAX_ROWS)
    throw new SpFileError(
      `File có ${rows.length} dòng — tối đa ${SP_MAX_ROWS} dòng một lần. Chia làm nhiều file.`,
    )
  return { rows, images, columns: [...cols.keys()] }
}

/** Chính file người dùng gửi: điền mã vừa cấp + phiên bản + vân tay ảnh vừa ghi. */
export async function fillWritten(
  buffer: Buffer,
  written: readonly {
    row: number
    code: string
    version: string
    imageRef?: string | null
  }[],
): Promise<Buffer> {
  const { wb, ws, cols } = await loadSheet(buffer)
  const codeCol = cols.get('code')!
  const verCol = cols.get('version')
  const refCol = cols.get('image_ref')
  for (const w of written) {
    const c = ws.getCell(w.row, codeCol)
    c.numFmt = '@'
    c.value = w.code
    if (verCol) ws.getCell(w.row, verCol).value = w.version
    if (refCol && w.imageRef) ws.getCell(w.row, refCol).value = w.imageRef
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
