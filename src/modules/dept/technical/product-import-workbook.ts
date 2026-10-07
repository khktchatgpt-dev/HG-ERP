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
  knownImage,
  parseImageRef,
  exportValue,
  optionText,
  type CellValue,
  type ExistingProduct,
  type RawRow,
  type RowImage,
} from '@/lib/product-import'
import { cellValue } from './bom-workbook'
import {
  PACKING_COLUMNS,
  PACKING_SHEET,
  packingColumnForHeader,
  type OptionData,
  type PackingRawRow,
} from '@/lib/product-packing-import'
import {
  IMAGE_MIME,
  imageHash,
  imageSize,
  previewDataUrl,
  readInCellImages,
} from './product-images'

/**
 * FILE EXCEL của luồng thêm + cập nhật SP (07/10/2026) — xuất, đọc file đã sửa,
 * ghi mã vừa cấp trở lại. Tách khỏi service để test được cả vòng mà không nạp DB
 * (cùng lý do `bom-workbook.ts`).
 *
 * Bố cục: hàng 1 tên NHÓM (như trang chi tiết), hàng 2 TIÊU ĐỀ (đọc lại theo chữ
 * này), hàng 3 ghi chú, dữ liệu từ hàng 4. Ghim 3 cột trái (Mã · Ảnh · Tên) và 3
 * hàng đầu — 46 cột mà cuộn mất tên SP thì không biết đang sửa dòng nào.
 *
 * ẢNH (B2): xuất ảnh THU NHỎ neo vào ô Ảnh + ghi "Ảnh gốc" (id file | vân tay).
 * Đọc lại: ảnh nổi neo vào ô Ảnh (góc trên-trái) + ảnh "Đặt trong ô" của Excel 365.
 */

/** Ảnh thu nhỏ của một SP khi xuất: byte JPEG + ô "Ảnh gốc". */
export type ExportThumb = { buffer: Buffer; ref: string }
/** Byte gốc của ảnh trong file — thứ tự khớp `RawRow.images`. */
export type RowImageBytes = { buffer: Buffer; ext: string }[]

const IMAGE_ROW_PT = 40 // ~53px — vừa ảnh thu nhỏ 64×48
const IMG_W = 64
const IMG_H = 48

const LIST_SHEET = 'Danh mục'
const GUIDE_SHEET = 'Hướng dẫn'
const letter = (n: number): string => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s // prettier-ignore
  return s
}

const colOf = (key: string) => IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1

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
  /** productId → ảnh thu nhỏ. Thiếu = SP chưa có ảnh (hoặc chưa kịp thu nhỏ). */
  thumbs: ReadonlyMap<string, ExportThumb> = new Map(),
  /** productId → phương án đóng gói nhiều kiện (sheet "Đóng gói"). */
  packing: ReadonlyMap<string, OptionData[]> = new Map(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const ws = wb.addWorksheet(IMPORT_SHEET, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: NOTE_ROW }],
  })
  const pws = wb.addWorksheet(PACKING_SHEET, {
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
    n.value =
      c.note ??
      (c.kind === 'version' || c.kind === 'imageref' ? 'Hệ thống dùng — đừng sửa' : null)
    n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    n.alignment = { vertical: 'top', wrapText: true }
  })
  ws.getRow(HEADER_ROW).height = 32
  ws.getRow(NOTE_ROW).height = 24
  ws.getCell(NOTE_ROW, colOf('name')).value = 'Ô trống = giữ nguyên · gõ "-" = xoá trắng'

  // Dữ liệu.
  products.forEach((p, r) => {
    const rowNo = IMPORT_FIRST_ROW + r
    IMPORT_COLUMNS.forEach((c, i) => {
      const cell = ws.getCell(rowNo, i + 1)
      if (c.kind === 'code') cell.value = p.code
      else if (c.kind === 'version') cell.value = p.updated_at
      else if (c.kind === 'imageref') cell.value = thumbs.get(p.id)?.ref ?? null
      else if (c.kind !== 'image') cell.value = exportValue(c, currentValue(p, c))
    })
    const t = thumbs.get(p.id)
    if (t) {
      // Neo MỘT ô (oneCell): kéo giãn hàng/cột thì ảnh đi theo ô, không trôi sang dòng khác.
      const id = wb.addImage({
        buffer: t.buffer as unknown as ExcelJS.Buffer,
        extension: 'jpeg',
      })
      ws.addImage(id, {
        tl: { col: colOf('image') - 1 + 0.08, row: rowNo - 1 + 0.08 },
        ext: { width: IMG_W, height: IMG_H },
        editAs: 'oneCell',
      })
      ws.getRow(rowNo).height = IMAGE_ROW_PT
    }
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
    if (c.kind === 'version' || c.kind === 'imageref') ws.getColumn(colNo).hidden = true
    if (!v) return
    for (let r = IMPORT_FIRST_ROW; r <= lastRow; r++)
      ws.getCell(r, colNo).dataValidation = v
  })

  // ── Sheet "Đóng gói": mỗi dòng một KIỆN, ô phương án lặp lại trên các dòng kiện.
  pws.columns = PACKING_COLUMNS.map((c) => ({ width: c.width }))
  pws.mergeCells(GROUP_ROW, 1, GROUP_ROW, PACKING_COLUMNS.length)
  const band = pws.getCell(GROUP_ROW, 1)
  band.value =
    'PHƯƠNG ÁN ĐÓNG GÓI — mỗi dòng một kiện. SP có mặt ở sheet này thì đóng gói của SP đó được THAY TRỌN BỘ bằng các dòng ở đây; SP không có dòng nào thì giữ nguyên.' // prettier-ignore
  band.font = { bold: true, size: 9, color: { argb: 'FF3F4756' } }
  band.fill = FILL_GROUP
  band.alignment = { vertical: 'middle', wrapText: true }
  pws.getRow(GROUP_ROW).height = 30
  PACKING_COLUMNS.forEach((c, i) => {
    const h = pws.getCell(HEADER_ROW, i + 1)
    h.value = c.header
    h.font = { bold: true }
    h.fill = FILL_HEAD
    h.alignment = { vertical: 'middle', wrapText: true }
    const n = pws.getCell(NOTE_ROW, i + 1)
    n.value = c.note ?? null
    n.font = { italic: true, size: 9, color: { argb: 'FF5D6675' } }
    n.alignment = { vertical: 'top', wrapText: true }
  })
  pws.getRow(HEADER_ROW).height = 32
  pws.getRow(NOTE_ROW).height = 24
  let prow = IMPORT_FIRST_ROW
  for (const p of products) {
    for (const o of packing.get(p.id) ?? []) {
      const opt = {
        code: p.code,
        option_no: o.option_no,
        label: o.label,
        is_default: o.is_default ? 'có' : 'không',
        cartons_per_set: o.cartons_per_set,
        loading_40hc: o.loading_40hc,
        note: o.note,
      }
      for (const pk of o.packages.length ? o.packages : [null]) {
        const vals: Record<string, unknown> = { ...opt, ...(pk ?? {}) }
        PACKING_COLUMNS.forEach((c, i) => {
          const v = vals[c.key]
          pws.getCell(prow, i + 1).value = v == null ? null : (v as ExcelJS.CellValue)
        })
        prow++
      }
    }
  }
  pws.getColumn(1).numFmt = '@'
  const defCol = PACKING_COLUMNS.findIndex((c) => c.key === 'is_default') + 1
  for (let r = IMPORT_FIRST_ROW; r <= prow + 200; r++) {
    pws.getCell(r, defCol).dataValidation = list(range(6, 2), false)
  }

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
    '8. Ảnh: ảnh thu nhỏ xuất ra để nguyên = không đổi ảnh. Dán ảnh khác vào ô Ảnh (dán đè hoặc "Đặt trong ô") = thay ảnh đại diện; ảnh cũ vẫn giữ ở tab Tài liệu.',
    `9. Sheet "${PACKING_SHEET}": mỗi dòng một KIỆN. SP có mặt ở sheet này thì đóng gói của SP đó được THAY TRỌN BỘ; SP vắng mặt giữ nguyên.`,
    '   Các dòng cùng "Phương án số" là cùng một phương án (ô Tên / Mặc định / Số thùng / Xếp cont chỉ cần ghi ở dòng đầu). Phương án không kiện = một dòng, để trống Tên kiện.',
    '   Mỗi SP đúng MỘT phương án "Mặc định" (không đánh dấu thì lấy phương án số nhỏ nhất). Gõ "-" ở ô Phương án số = xoá hết phương án của SP.',
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
  return String(v).replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim()
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
export async function readImportRows(buffer: Buffer): Promise<{
  rows: RawRow[]
  blank: number
  sheet: string
  columns: string[]
  /** Byte gốc của ảnh theo hàng — chỉ service dùng khi ghi, màn soi không cần. */
  imageBytes: Map<number, RowImageBytes>
  /** Sheet "Đóng gói" — rỗng khi file không có sheet đó (file cũ / người dùng xoá). */
  packingRows: PackingRawRow[]
}> {
  const { wb, ws, colOf: cols } = await loadSheet(buffer)
  const imageBytes = await readRowImages(buffer, wb, ws, cols.get('image'))
  const rows: RawRow[] = []
  const last = Math.max(ws.rowCount, ...imageBytes.keys())
  for (let r = IMPORT_FIRST_ROW; r <= last; r++) {
    const cells: Record<string, CellValue> = {}
    let any = imageBytes.has(r)
    for (const [key, colNo] of cols) {
      const v = raw(cellValue(ws.getCell(r, colNo).value))
      cells[key] = v
      // Cột máy (Phiên bản, Ảnh gốc) một mình không làm dòng thành có dữ liệu.
      if (v !== '' && key !== 'version' && key !== 'image_ref' && key !== 'image')
        any = true
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
  // Vân tay + cỡ cho MỌI ảnh; ảnh nhỏ xem trước chỉ cho ảnh KHÁC "Ảnh gốc" (ảnh
  // thu nhỏ để nguyên khỏi tốn công — tải lên cả thư viện là 680 ảnh như thế).
  for (const r of rows) {
    const bytes = imageBytes.get(r.row)
    if (!bytes) continue
    const ref = parseImageRef(r.cells.image_ref)
    r.images = await Promise.all(bytes.map(async ({ buffer: b, ext }) => describeImage(b, ext, ref?.hashes ?? []))) // prettier-ignore
  }
  return {
    rows,
    blank,
    sheet: ws.name,
    columns: [...cols.keys()],
    imageBytes,
    packingRows: readPackingRows(wb),
  }
}

/** Một ảnh trong ô → thông tin để lib quyết (vân tay, cỡ) + câu lỗi nếu không dùng được. */
async function describeImage(
  buf: Buffer,
  ext: string,
  known: readonly string[],
): Promise<RowImage> {
  const base = { hash: '', bytes: buf.byteLength, width: 0, height: 0 }
  if (!IMAGE_MIME[ext]) {
    return { ...base, problem: `Ảnh dạng .${ext || '?'} không dùng được — chép ảnh gốc (PNG/JPG) rồi dán lại vào ô` } // prettier-ignore
  }
  const size = await imageSize(buf)
  if (!size)
    return { ...base, problem: 'Không đọc được ảnh trong ô — dán lại ảnh PNG/JPG' }
  const hash = await imageHash(buf)
  const same = knownImage(hash, known)
  return { ...base, ...size, hash, preview: same ? undefined : await previewDataUrl(buf) }
}

/**
 * Ảnh ở cột Ảnh theo hàng. Hai nguồn:
 *  · ảnh NỔI (Chèn ảnh / dán) — tính cho hàng chứa góc trên-trái; nhận khi ảnh
 *    phủ lên cột Ảnh (góc trái ở cột Ảnh, hoặc lấn từ cột bên trái sang);
 *  · ảnh "ĐẶT TRONG Ô" của Excel 365 — exceljs không đọc, `readInCellImages` tự lần.
 */
async function readRowImages(
  buffer: Buffer,
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  imageCol: number | undefined,
): Promise<Map<number, RowImageBytes>> {
  const out = new Map<number, RowImageBytes>()
  if (!imageCol) return out
  const add = (row: number, b: Buffer, ext: string) => {
    if (row < IMPORT_FIRST_ROW) return
    out.set(row, [...(out.get(row) ?? []), { buffer: b, ext: ext.toLowerCase() }])
  }
  for (const im of ws.getImages()) {
    const tl = im.range.tl as unknown as { nativeCol: number; nativeRow: number }
    const br = im.range.br as unknown as { nativeCol: number } | undefined
    const left = tl.nativeCol + 1
    const right = br ? br.nativeCol + 1 : left
    if (left > imageCol || right < imageCol) continue
    const media = wb.getImage(Number(im.imageId)) as unknown as {
      buffer?: Buffer
      extension?: string
    }
    if (media?.buffer)
      add(tl.nativeRow + 1, Buffer.from(media.buffer), media.extension ?? '')
  }
  for (const c of await readInCellImages(buffer, ws.name)) {
    if (c.col === imageCol) add(c.row, c.buffer, c.ext)
  }
  return out
}

/**
 * Chính file người dùng gửi, ô Mã nội bộ điền mã vừa cấp + ô Phiên bản điền
 * phiên bản mới — để lần sửa tiếp theo trên chính file đó không bị báo "đã sửa
 * trên web sau khi xuất".
 */
export async function fillWritten(
  buffer: Buffer,
  written: readonly {
    row: number
    code: string
    version: string
    imageRef?: string | null
  }[],
): Promise<Buffer> {
  const { wb, ws, colOf: cols } = await loadSheet(buffer)
  const codeCol = cols.get('code')!
  const verCol = cols.get('version')
  const refCol = cols.get('image_ref')
  for (const w of written) {
    const c = ws.getCell(w.row, codeCol)
    c.numFmt = '@'
    c.value = w.code
    if (verCol) ws.getCell(w.row, verCol).value = w.version
    // Ảnh vừa ghi đang nằm trong ô — ghi vân tay của CHÍNH nó, lần tải lại sau mới
    // nhận ra "không đổi" thay vì tải ảnh đó lên lần nữa.
    if (refCol && w.imageRef) ws.getCell(w.row, refCol).value = w.imageRef
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Sheet "Đóng gói" → dòng thô theo TIÊU ĐỀ (hàng 2), dữ liệu từ hàng 4, bỏ dòng trống. */
function readPackingRows(wb: ExcelJS.Workbook): PackingRawRow[] {
  const ws = wb.getWorksheet(PACKING_SHEET)
  if (!ws) return []
  const cols = new Map<string, number>()
  ws.getRow(HEADER_ROW).eachCell((cell, colNo) => {
    const c = packingColumnForHeader(String(raw(cellValue(cell.value))))
    if (c && !cols.has(c.key)) cols.set(c.key, colNo)
  })
  if (!cols.has('code')) return []
  const out: PackingRawRow[] = []
  for (let r = IMPORT_FIRST_ROW; r <= ws.rowCount; r++) {
    const cells: Record<string, CellValue> = {}
    let any = false
    for (const [key, colNo] of cols) {
      const v = raw(cellValue(ws.getCell(r, colNo).value))
      cells[key] = v
      if (v !== '') any = true
    }
    if (any) out.push({ row: r, cells })
  }
  return out
}
