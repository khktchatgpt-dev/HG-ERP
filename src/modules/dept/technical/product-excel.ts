import ExcelJS from 'exceljs'
import {
  cellDigits,
  cellRaw,
  columnsFor,
  layoutOf,
  nameOf,
  type PartColumn,
} from '@/components/technical/part-layouts'
import type { PartView } from '@/components/technical/ProductProfileCards'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { isLifecycle, LIFECYCLE_LABEL } from '@/lib/product-lifecycle'
import { DOC_TYPE_LABEL, type DocType } from '@/lib/file-limits'

/**
 * XUẤT HỒ SƠ SẢN PHẨM RA .xlsx.
 *
 * Sheet 1 dựng theo ĐÚNG biểu mẫu "BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN"
 * (HG-QT-07/M02) mà cả 246 file BOM của công ty đang dùng: đầu thư công ty +
 * khối kiểm soát tài liệu ISO + khối thông tin chung kèm ảnh SP + từng khối định
 * mức với bộ cột riêng của nó + khối tổng hợp + khối chữ ký. In ra là khớp tờ
 * giấy xưởng đang ký, nên người nhận không phải học lại cách đọc.
 *
 * Các sheet sau chở phần biểu mẫu KHÔNG có (thông số kỹ thuật, đóng gói, tài
 * liệu) để file trả lời được "toàn bộ thông tin một sản phẩm".
 *
 * Bộ cột và giá trị từng ô lấy từ `part-layouts` — CÙNG nguồn với màn hình. Chép
 * luật sang đây là tự chuốc cảnh file xuất ra khác thứ người dùng vừa nhìn.
 *
 * Số ghi dạng SỐ THẬT (không phải chữ) để người nhận còn SUM và lọc tiếp.
 *
 * TRÌNH BÀY (0164) — bản trước bày ra "file nháp": chữ nhãn xám nhạt cỡ 9 mờ khi
 * in, bảng không viền, cột rộng 12 cắt cụt mọi tiêu đề, số lượng hiện `2.0000`,
 * không có đầu thư / chữ ký nên không ký được. Ở đây mọi thứ đi qua một bộ kiểu
 * DUY NHẤT (`paint`) với chữ đủ đậm để photocopy còn đọc được, viền đóng khung
 * từng khối, cột tự rộng theo nội dung thật, và trang được set sẵn khổ A4 ngang
 * vừa một chiều rộng.
 */

export type ProductExcelInput = {
  product: {
    code: string
    name: string
    customer_name: string | null
    customer_item_code: string | null
    code_legacy: string | null
    unit: string
    product_type: string | null
    frame_material: string | null
    base_material: string | null
    length_mm: number | null
    width_mm: number | null
    height_mm: number | null
    length_open_mm: number | null
    width_open_mm: number | null
    height_open_mm: number | null
    thickness_mm: number | null
    net_weight_kg: number | null
    actual_weight_kg: number | null
    material: string | null
    hs_code: string | null
    origin_country: string | null
    max_load_kg: number | null
    assembly: string | null
    set_contents: string | null
    description_en: string | null
    shipping_mark: string | null
    notes: string | null
    barcode: string | null
    is_upholstered: boolean
    has_glass: boolean
    is_set: boolean
    packing: Record<string, unknown>
    tech_spec: Record<string, unknown>
    bom_rev: number | null
    bom_effective_date: string | null
    paint_coverage_m2_per_kg: number | null
    lifecycle: string
    created_at: string
  }
  parts: PartView[]
  groups: { code: string; label: string }[]
  clusters: { id: string; name: string }[]
  setItems: { item_label: string; qty: number }[]
  files: { filename: string; doc_type: string | null; size_bytes: number }[]
  /** Ảnh đại diện SP — thiếu ảnh không chặn xuất. */
  image?: { buffer: Buffer; extension: 'png' | 'jpeg' } | null
  /** Đầu thư (tên, địa chỉ, MST…) — thiếu thì bỏ dòng đó, không in chữ rỗng. */
  company?: Record<string, string | null> | null
  /** Người bấm xuất + thời điểm, ghi ở chân sheet 1 để biết bản in từ đâu ra. */
  exportedBy: string
  exportedAt: Date
}

/* ───────────────────────────── Bảng màu · kiểu chữ ────────────────────────── */

/** MỘT họ chữ cho cả file — biểu mẫu giấy của công ty dùng Times New Roman. */
const FONT = 'Times New Roman'

/* Chữ: hai bậc thôi, và bậc nhạt vẫn phải ĐỌC ĐƯỢC khi photocopy — bản trước
 * dùng #6B7280 cỡ 9 nên in ra là mờ tịt. */
const INK = 'FF111827'
const INK_SOFT = 'FF475569'
const COBALT = 'FF1E3A8A'
const STOP = 'FFB42318'

const HEAD_FILL = 'FFFEF08A' // vàng của biểu mẫu — hàng tiêu đề cột
const BAND_FILL = 'FFE6EBF7' // thanh tên khối
const LABEL_FILL = 'FFF1F5F9' // ô nhãn
const ZEBRA_FILL = 'FFF8FAFC' // dòng chẵn
const TOTAL_FILL = 'FFEFF2F7' // dòng tổng

const LINE = 'FF94A3B8' // viền khung khối
const LINE_SOFT = 'FFCBD5E1' // viền ô trong bảng

const thin = (argb = LINE_SOFT) => ({ style: 'thin' as const, color: { argb } })
const medium = () => ({ style: 'medium' as const, color: { argb: LINE } })

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB') : ''

/**
 * Định dạng số của một cột.
 *
 * Số DẪN XUẤT giữ đủ chữ số thập phân của biểu mẫu (0.532 kg) để đối chiếu được
 * với bản in; số người GÕ thì viết như người ta gõ — `#` chứ không `0`, nếu
 * không thì "2 cái" hiện ra `2.0000`. Đúng luật màn hình đang dùng.
 */
const FIXED_DIGITS = new Set(['len', 'kg', 'm2', 'm3', 'totalM', 'totalM2', 'm3Sheet'])
function numFmtFor(key: string, v: number): string {
  const d = cellDigits(key)
  if (d <= 0) return '#,##0'
  if (FIXED_DIGITS.has(key)) return `#,##0.${'0'.repeat(d)}`
  return autoFmt(v, d)
}

/**
 * Số người GÕ: nguyên thì viết nguyên.
 *
 * BẪY Excel: mã định dạng `#,##0.#` vẫn IN dấu thập phân khi phần lẻ bằng 0 —
 * `25` ra `25,`. Nên phải chọn mã theo chính giá trị, không theo cột.
 */
function autoFmt(v: unknown, digits = 2): string {
  return typeof v === 'number' && !Number.isInteger(v)
    ? `#,##0.${'#'.repeat(digits)}`
    : '#,##0'
}

/* ─────────────────────────────── Bút vẽ ô Excel ───────────────────────────── */

type Opt = {
  bold?: boolean
  italic?: boolean
  size?: number
  color?: string
  fill?: string
  align?: 'left' | 'center' | 'right'
  vAlign?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
  numFmt?: string
  /** Viền mảnh quanh ô — bảng nào cũng cần, khối thông tin thì tuỳ. */
  grid?: boolean
}

function paint(cell: ExcelJS.Cell, o: Opt) {
  cell.font = {
    name: FONT,
    size: o.size ?? 11,
    bold: o.bold ?? false,
    italic: o.italic ?? false,
    color: { argb: o.color ?? INK },
  }
  cell.alignment = {
    horizontal: o.align ?? 'left',
    vertical: o.vAlign ?? 'middle',
    wrapText: o.wrap ?? false,
  }
  if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }
  if (o.numFmt) cell.numFmt = o.numFmt
  if (o.grid) cell.border = { top: thin(), left: thin(), bottom: thin(), right: thin() }
}

function put(ws: ExcelJS.Worksheet, r: number, c: number, v: unknown, o: Opt = {}) {
  const cell = ws.getCell(r, c)
  cell.value = (v ?? '') as ExcelJS.CellValue
  paint(cell, o)
  return cell
}

/**
 * Ghi một ô GỘP theo chiều ngang.
 *
 * BẪY exceljs: ghi `value` vào ô con của dải gộp là ghi đè lên ô chủ, nên chỉ ô
 * chủ nhận giá trị; còn KIỂU thì phải quét cả dải, không thì viền/nền của ô gộp
 * chỉ vẽ được một phần bên trái.
 */
function span(
  ws: ExcelJS.Worksheet,
  r: number,
  c1: number,
  c2: number,
  v: unknown,
  o: Opt = {},
) {
  const cell = ws.getCell(r, c1)
  cell.value = (v ?? '') as ExcelJS.CellValue
  if (c2 > c1) ws.mergeCells(r, c1, r, c2)
  for (let c = c1; c <= c2; c++) paint(ws.getCell(r, c), o)
  return cell
}

/** Ô gộp cả khối (nhiều dòng × nhiều cột) — dùng cho ô ảnh. */
function box(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  v: unknown,
  o: Opt = {},
) {
  const cell = ws.getCell(r1, c1)
  cell.value = (v ?? '') as ExcelJS.CellValue
  if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2)
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) paint(ws.getCell(r, c), o)
  return cell
}

/** Viền ĐẬM quanh một vùng — đóng khung từng khối cho ra hình biểu mẫu. */
function outline(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c)
      const b: Partial<ExcelJS.Borders> = { ...(cell.border ?? {}) }
      if (r === r1) b.top = medium()
      if (r === r2) b.bottom = medium()
      if (c === c1) b.left = medium()
      if (c === c2) b.right = medium()
      cell.border = b
    }
}

/** Số dòng và chiều cao dòng của khối thông tin — ô ảnh bám theo hai số này. */
const INFO_ROW_H = 22

/** Bề rộng một cột ra PIXEL — Excel tính ~7px/ký tự + 5px lề, đủ để canh ảnh. */
const colPx = (ws: ExcelJS.Worksheet, c: number) =>
  Math.round((ws.getColumn(c).width ?? 8.43) * 7 + 5)

/** Chia dải cột `[from..to]` thành các khoảng theo trọng số. */
function spanCols(from: number, to: number, weights: number[]): [number, number][] {
  const total = to - from + 1
  const sum = weights.reduce((s, w) => s + w, 0)
  const out: [number, number][] = []
  let cur = from
  weights.forEach((w, i) => {
    const last = i === weights.length - 1
    const size = last ? to - cur + 1 : Math.max(1, Math.round((w / sum) * total))
    const a = Math.min(cur, to)
    const b = Math.min(to, a + Math.max(1, size) - 1)
    out.push([a, b])
    cur = b + 1
  })
  return out
}

const cmToMm = (v: number | string | undefined) =>
  v == null || v === '' ? null : Math.round(Number(v) * 10)

const dims = (a: number | null, b: number | null, c: number | null) =>
  [a, b, c].every((x) => x == null) ? null : `${a ?? '?'} × ${b ?? '?'} × ${c ?? '?'}`

/** Ô rỗng viết "—": ô trắng trên giấy đọc như "quên điền", gạch ngang là "không có". */
const orDash = (v: unknown) =>
  v == null || v === '' ? '—' : (v as string | number | boolean)

/** "bom" → "File BOM / định mức" — cùng chữ với ngăn tài liệu trên màn hình. */
const docTypeLabel = (t: string | null) =>
  t ? (DOC_TYPE_LABEL[t as DocType] ?? t) : '—'

const labelOf = (
  list: readonly { code: string; label: string }[],
  code: string | null,
) => (code ? (list.find((x) => x.code === code)?.label ?? code) : null)

/**
 * Kích thước THẬT của ảnh, đọc thẳng từ vài byte đầu (exceljs không nói).
 * PNG: khai ở IHDR ngay sau chữ ký. JPEG: quét tới khối SOFn đầu tiên.
 * Không đọc ra thì trả `null` — chỗ gọi lấy khung vuông làm mặc định.
 */
function imageSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50)
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const m = buf[i + 1]
      // Chỉ SOF0-3 · 5-7 · 9-11 · 13-15 chở kích thước; khối khác thì nhảy qua.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return null
}

/** Co ảnh vừa khung mà KHÔNG méo — khung cứng làm mọi ảnh dọc bị bè ngang. */
function fitImage(
  image: { buffer: Buffer },
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const s = imageSize(image.buffer)
  if (!s || !s.w || !s.h) return { width: maxH, height: maxH }
  const k = Math.min(maxW / s.w, maxH / s.h, 1.6)
  return { width: Math.round(s.w * k), height: Math.round(s.h * k) }
}

/**
 * Sắp lại bộ cột cho BẢN IN (màn hình giữ nguyên thứ tự của `part-layouts`):
 *
 *  · bỏ cột chữ "Mộng" khi đã có "Mộng (mm)" — cùng một con số bày hai lần, trên
 *    giấy đọc như số liệu vênh;
 *  · đẩy "Ghi chú" xuống chót, đúng biểu mẫu gốc, và vì đây là cột duy nhất nên
 *    kéo dài cho hết bề ngang khi khối ít cột hơn khối rộng nhất (kéo dài một
 *    cột số thì ra ô số rộng cả gang tay).
 */
function orderCols(cols: PartColumn[]): PartColumn[] {
  return cols
    .filter((c) => !(c.key === 'tenon' && cols.some((x) => x.key === 'tenonMm')))
    .sort((x, y) => (x.key === 'note' ? 1 : 0) - (y.key === 'note' ? 1 : 0))
}

/* ────────────────────────────── Sheet 1: Định mức ────────────────────────── */

type Block = {
  title: string
  layout: ReturnType<typeof layoutOf>
  cols: PartColumn[]
  rows: PartView[]
}

function buildBomSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const { product: p, parts, groups } = input
  const company = input.company ?? {}

  /* ── Gom khối TRƯỚC: phải biết bảng rộng bao nhiêu cột mới dựng nổi đầu thư ── */
  const byGroup = new Map<string, PartView[]>()
  for (const part of parts) {
    if (!byGroup.has(part.group_code)) byGroup.set(part.group_code, [])
    byGroup.get(part.group_code)!.push(part)
  }
  const blocks: Block[] = groups
    .map((g) => {
      const rows = byGroup.get(g.code) ?? []
      return {
        title: rows[0]?.section_title || g.label,
        layout: layoutOf(g.code),
        cols: rows.length ? orderCols(columnsFor(g.code, rows)) : [],
        rows,
      }
    })
    .filter((b) => b.rows.length > 0)

  // Cột "Cụm" chỉ hiện khi hồ sơ thật sự chia cụm — hầu hết SP không chia, bày
  // ra là thêm một cột "—" chạy suốt mọi bảng.
  const hasCluster = parts.some((x) => x.cluster_id)
  const BASE = hasCluster ? 3 : 2
  const dataCols = Math.max(4, ...blocks.map((b) => b.cols.length))
  const N = Math.max(12, BASE + dataCols)

  const ws = wb.addWorksheet('Định mức', {
    views: [{ state: 'frozen', xSplit: BASE, ySplit: 0, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L&"${FONT}"&8${p.code}&R&"${FONT}"&8Trang &P/&N`,
    },
  })

  /* ── Bề rộng cột: theo NỘI DUNG THẬT, không phải 12 cho tất cả ─────────── */
  ws.getColumn(1).width = 5.5
  ws.getColumn(2).width = 34
  if (hasCluster) ws.getColumn(3).width = 14
  for (let i = 0; i < dataCols; i++) {
    let w = 9
    for (const b of blocks) {
      const col = b.cols[i]
      if (!col) continue
      // Tiêu đề cột được xuống dòng nên chỉ cần ~nửa độ dài chữ.
      w = Math.max(w, Math.ceil(col.label.length / 2) + 3)
      for (const row of b.rows) {
        const v = cellRaw(row, col.key)
        if (typeof v === 'string') w = Math.max(w, Math.min(v.length + 2, 30))
      }
    }
    ws.getColumn(BASE + 1 + i).width = Math.min(w, 26)
  }
  for (let c = BASE + dataCols + 1; c <= N; c++) ws.getColumn(c).width = 10

  let r = 1

  /* ── Đầu thư + khối kiểm soát tài liệu ISO ─────────────────────────────── */
  const isoFrom = N - 2
  span(ws, r, 1, isoFrom - 1, (company.company_name ?? '').toUpperCase(), {
    bold: true,
    size: 12,
  })
  span(ws, r, isoFrom, N, 'Biểu mẫu: HG-QT-07/M02', {
    size: 10,
    align: 'center',
    bold: true,
  })
  r++
  span(ws, r, 1, isoFrom - 1, company.company_address ?? '', {
    size: 10,
    color: INK_SOFT,
  })
  span(ws, r, isoFrom, N, `Lần ban hành: ${p.bom_rev ?? '—'}`, {
    size: 10,
    align: 'center',
  })
  r++
  span(
    ws,
    r,
    1,
    isoFrom - 1,
    [
      company.company_tax_code && `MST: ${company.company_tax_code}`,
      company.company_phone && `ĐT: ${company.company_phone}`,
    ]
      .filter(Boolean)
      .join('   '),
    { size: 10, color: INK_SOFT },
  )
  span(ws, r, isoFrom, N, `Hiệu lực: ${fmtDate(p.bom_effective_date) || '—'}`, {
    size: 10,
    align: 'center',
  })
  outline(ws, r - 2, isoFrom, r, N)
  r++

  /* ── Tiêu đề ───────────────────────────────────────────────────────────── */
  ws.getRow(r).height = 6
  r++
  span(ws, r, 1, N, 'BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN', {
    bold: true,
    size: 18,
    align: 'center',
  })
  ws.getRow(r).height = 26
  r++
  span(ws, r, 1, N, `${p.code}  ·  ${p.name}`, {
    bold: true,
    size: 13,
    align: 'center',
    color: COBALT,
  })
  ws.getRow(r).height = 20
  r++
  const stamp = [
    labelOf(PRODUCT_TYPES, p.product_type),
    labelOf(FRAME_MATERIALS, p.frame_material) &&
      `khung ${labelOf(FRAME_MATERIALS, p.frame_material)!.toLowerCase()}`,
    isLifecycle(p.lifecycle) ? LIFECYCLE_LABEL[p.lifecycle] : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  span(ws, r, 1, N, stamp, { italic: true, size: 10, align: 'center', color: INK_SOFT })
  r += 1
  ws.getRow(r).height = 6
  r++

  /* ── Khối thông tin chung: ảnh bên trái, hai cột nhãn/giá trị bên phải ─── */
  const infoTop = r
  const INFO_ROWS = 6
  const imgC2 = Math.min(2, N)
  box(ws, infoTop, 1, infoTop + INFO_ROWS - 1, imgC2, input.image ? '' : 'CHƯA CÓ ẢNH', {
    align: 'center',
    vAlign: 'middle',
    color: INK_SOFT,
    size: 10,
    italic: !input.image,
  })
  if (input.image) {
    const id = wb.addImage({
      // `as never` giống lsx-excel: exceljs khai Buffer đời cũ, TS 5 không nhận.
      buffer: input.image.buffer as never,
      extension: input.image.extension,
    })
    /*
     * Giữ ĐÚNG tỉ lệ ảnh (khung cố định làm mọi ảnh dọc bị bè ra) rồi đặt vào
     * GIỮA ô — ảnh dán sát mép trái của một ô rộng nhìn như bị lệch.
     */
    const boxW = colPx(ws, 1) + colPx(ws, 2)
    const boxH = INFO_ROWS * INFO_ROW_H
    const fit = fitImage(input.image, boxW - 12, boxH - 8)
    const dx = Math.max(0, (boxW - fit.width) / 2)
    ws.addImage(id, {
      tl: {
        col:
          dx < colPx(ws, 1) ? dx / colPx(ws, 1) : 1 + (dx - colPx(ws, 1)) / colPx(ws, 2),
        row: infoTop - 1 + Math.max(0, (boxH - fit.height) / 2) / INFO_ROW_H,
      },
      ext: fit,
      editAs: 'oneCell',
    })
  }

  const rest = imgC2 + 1
  const half = Math.max(4, Math.floor((N - rest + 1) / 2))
  const gA: [number, number] = [rest, rest + half - 1]
  const gB: [number, number] = [rest + half, N]
  const LBL = 2 // nhãn rộng 2 cột

  const field = (row: number, g: [number, number], k: string, v: unknown) => {
    span(ws, row, g[0], g[0] + LBL - 1, k, {
      size: 10,
      color: INK_SOFT,
      fill: LABEL_FILL,
      grid: true,
      wrap: true,
    })
    span(ws, row, g[0] + LBL, g[1], orDash(v), { bold: true, size: 11, grid: true })
  }

  // Dòng đầu chạy hết bề ngang: tên SP dài, nhét vào nửa cột là bị cắt.
  span(ws, infoTop, rest, rest + LBL - 1, 'TÊN SẢN PHẨM', {
    size: 10,
    color: INK_SOFT,
    fill: LABEL_FILL,
    grid: true,
  })
  span(ws, infoTop, rest + LBL, N, p.name, { bold: true, size: 12, grid: true })

  const pairs: [string, unknown, string, unknown][] = [
    [
      'Mã số HG',
      p.code,
      'KTSP (W × D × H) mm',
      dims(p.width_mm, p.length_mm, p.height_mm),
    ],
    [
      'Mã cũ',
      p.code_legacy,
      'KT khi mở (mm)',
      dims(p.width_open_mm, p.length_open_mm, p.height_open_mm),
    ],
    [
      'Khách hàng',
      p.customer_name,
      'Nhiên liệu / vật liệu nền',
      p.base_material ?? p.frame_material,
    ],
    ['Mã khách đặt', p.customer_item_code, 'ĐVT', p.unit],
    [
      'Loại sản phẩm',
      labelOf(PRODUCT_TYPES, p.product_type),
      'KL thực tế / BK (kg)',
      p.actual_weight_kg,
    ],
  ]
  pairs.forEach(([ka, va, kb, vb], i) => {
    const row = infoTop + 1 + i
    ws.getRow(row).height = INFO_ROW_H
    field(row, gA, ka, va)
    field(row, gB, kb, vb)
  })
  ws.getRow(infoTop).height = INFO_ROW_H
  outline(ws, infoTop, 1, infoTop + INFO_ROWS - 1, N)
  r = infoTop + INFO_ROWS

  /* ── Dòng đóng gói, đúng thứ tự biểu mẫu ───────────────────────────────── */
  ws.getRow(r).height = 6
  r++
  const pk = p.packing as Record<string, number | string | undefined>
  const pack: [string, unknown][] = [
    ['Quy cách đóng gói', pk.pack_unit_label],
    [
      'KTBB — thùng (mm)',
      dims(cmToMm(pk.carton_l_cm), cmToMm(pk.carton_w_cm), cmToMm(pk.carton_h_cm)),
    ],
    ['SP / thùng', pk.qty_per_carton],
    ['Cái / 40HC', pk.loading_40hc],
    ['NW (kg)', pk.nw_kg],
    ['GW (kg)', pk.gw_kg],
  ]
  const packCols = spanCols(1, N, [2.2, 2.4, 1.2, 1.2, 1, 1])
  pack.forEach(([k], i) =>
    span(ws, r, packCols[i][0], packCols[i][1], k, {
      size: 10,
      bold: true,
      align: 'center',
      wrap: true,
      fill: HEAD_FILL,
      grid: true,
    }),
  )
  ws.getRow(r).height = 24
  pack.forEach(([, v], i) =>
    span(ws, r + 1, packCols[i][0], packCols[i][1], orDash(v), {
      size: 11,
      bold: true,
      align: 'center',
      grid: true,
      numFmt: typeof v === 'number' ? autoFmt(v) : undefined,
    }),
  )
  ws.getRow(r + 1).height = 20
  outline(ws, r, 1, r + 1, N)
  r += 3

  /* ── Từng khối định mức ────────────────────────────────────────────────── */
  const clusterName = new Map(input.clusters.map((c) => [c.id, c.name]))

  for (const b of blocks) {
    const top = r
    const cols = b.cols
    const lastCol = BASE + cols.length
    const noteLast = cols[cols.length - 1]?.key === 'note'
    /** Cột đầu tiên của phần thừa bên phải — bảng nào cũng đầy khung, không thò thụt. */
    const tail = noteLast ? lastCol : lastCol + 1
    const stretch = (row: number, o: Opt) =>
      tail <= N ? span(ws, row, tail, N, ws.getCell(row, tail).value, o) : null

    span(ws, r, 1, N - 2, b.title.toUpperCase().replace(/\s*:\s*$/, ''), {
      bold: true,
      size: 11,
      color: COBALT,
      fill: BAND_FILL,
    })
    span(ws, r, N - 1, N, `${b.rows.length} dòng`, {
      size: 10,
      align: 'right',
      color: INK_SOFT,
      fill: BAND_FILL,
    })
    ws.getRow(r).height = 20
    r++

    const headers = [
      'Stt',
      b.layout === 'supply' || b.layout === 'paint' || b.layout === 'rope'
        ? 'TÊN HÀNG HÓA'
        : 'Tên chi tiết',
      ...(hasCluster ? ['Cụm'] : []),
      ...cols.map((c) => c.label),
    ]
    const headOpt: Opt = {
      bold: true,
      size: 10,
      align: 'center',
      wrap: true,
      fill: HEAD_FILL,
      grid: true,
    }
    headers.forEach((h, i) => put(ws, r, i + 1, h, headOpt))
    stretch(r, headOpt)
    ws.getRow(r).height = 30
    r++

    b.rows.forEach((part, i) => {
      const zebra = i % 2 === 1 ? ZEBRA_FILL : undefined
      const base: Opt = { size: 10, grid: true, fill: zebra }
      put(ws, r, 1, part.part_no ?? i + 1, { ...base, align: 'center' })
      put(ws, r, 2, nameOf(part, b.layout), { ...base, wrap: true })
      if (hasCluster)
        put(
          ws,
          r,
          3,
          part.cluster_id ? (clusterName.get(part.cluster_id) ?? '') : '',
          base,
        )
      cols.forEach((c, ci) => writeBomCell(ws, r, BASE + 1 + ci, part, c, base))
      stretch(r, { ...base, wrap: true })
      ws.getRow(r).height = 18
      r++
    })

    // Dòng TỔNG — chỉ cộng những cột thật sự cộng được.
    writeTotalRow(ws, r, BASE, cols, b.rows)
    stretch(r, { size: 10, bold: true, grid: true, fill: TOTAL_FILL })
    ws.getRow(r).height = 20
    outline(ws, top, 1, r, N)
    r += 2
  }

  /* ── Tổng hợp vật tư ───────────────────────────────────────────────────── */
  r = writeRollup(ws, r, N, parts, p.paint_coverage_m2_per_kg)

  /* ── Khối chữ ký — có khối này thì bản in mới ký được ──────────────────── */
  r += 1
  const sign = spanCols(1, N, [1, 1, 1])
  const signers = ['NGƯỜI LẬP BIỂU', 'TRƯỞNG PHÒNG KỸ THUẬT', 'GIÁM ĐỐC']
  signers.forEach((s, i) =>
    span(ws, r, sign[i][0], sign[i][1], s, { bold: true, size: 10, align: 'center' }),
  )
  signers.forEach((_, i) =>
    span(ws, r + 1, sign[i][0], sign[i][1], '(Ký, ghi rõ họ tên)', {
      italic: true,
      size: 9,
      align: 'center',
      color: INK_SOFT,
    }),
  )
  ws.getRow(r + 2).height = 46
  r += 4

  span(
    ws,
    r,
    1,
    N,
    `Xuất bởi ${input.exportedBy} · ${input.exportedAt.toLocaleString('vi-VN')} · nguồn: hồ sơ ${p.code} trên HG Manager`,
    { italic: true, size: 9, color: INK_SOFT },
  )
}

/** Một ô định mức — giá trị và số lẻ đều lấy từ `part-layouts`. */
function writeBomCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  p: PartView,
  c: PartColumn,
  base: Opt,
) {
  if (c.key === 'blank') {
    put(ws, row, col, p.blank_confirmed_at ? '✓' : '', { ...base, align: 'center' })
    return
  }
  // SL chưa có: ghi chữ đỏ thay vì để trống — file gửi đi phải nói rõ chỗ thiếu,
  // ô trống trong Excel đọc như "bằng 0".
  if (c.key === 'qty' && p.qty == null) {
    put(ws, row, col, 'cần SL', {
      ...base,
      bold: true,
      color: STOP,
      align: 'center',
    })
    return
  }
  const v = cellRaw(p, c.key)
  if (typeof v === 'number') {
    put(ws, row, col, v, { ...base, align: 'right', numFmt: numFmtFor(c.key, v) })
    return
  }
  put(ws, row, col, v ?? (c.key === 'note' ? '' : '—'), {
    ...base,
    align: c.align === 'right' ? 'right' : 'left',
    color: v == null ? INK_SOFT : INK,
    wrap: c.key === 'note',
  })
}

/** Cột cộng được: SL và bốn số dẫn xuất. Cột chữ/kích thước thì để trống. */
const SUMMABLE = new Set(['qty', 'len', 'kg', 'm2', 'm3', 'totalM', 'totalM2'])

function writeTotalRow(
  ws: ExcelJS.Worksheet,
  row: number,
  base: number,
  cols: PartColumn[],
  rows: PartView[],
) {
  const opt: Opt = { size: 10, bold: true, grid: true, fill: TOTAL_FILL }
  for (let c = 1; c <= base; c++) put(ws, row, c, '', opt)
  span(ws, row, 1, base, 'TỔNG CỘNG', { ...opt, align: 'right' })
  cols.forEach((c, ci) => {
    const col = base + 1 + ci
    if (!SUMMABLE.has(c.key)) {
      put(ws, row, col, '', opt)
      return
    }
    const total = rows.reduce((s, p) => {
      const v = cellRaw(p, c.key)
      return s + (typeof v === 'number' ? v : 0)
    }, 0)
    put(ws, row, col, total === 0 ? '' : total, {
      ...opt,
      align: 'right',
      numFmt: numFmtFor(c.key, total),
    })
  })
}

/**
 * Khối "Tổng hợp vật tư" — cùng luật với thẻ trên màn hình: gộp THEO HỌ và nêu
 * đúng đơn vị mua của họ đó (gỗ/nệm m³ · vải m² · khung kg).
 */
function writeRollup(
  ws: ExcelJS.Worksheet,
  from: number,
  N: number,
  parts: PartView[],
  coverage: number | null,
): number {
  const top = from
  let r = from
  span(ws, r, 1, N, 'TỔNG HỢP VẬT TƯ  (tự tính từ định mức)', {
    bold: true,
    size: 11,
    color: COBALT,
    fill: BAND_FILL,
  })
  ws.getRow(r).height = 20
  r++

  const cols = spanCols(1, N, [3, 0.8, 1.4, 3.2])
  const heads = ['Tên hàng hoá', 'ĐVT', 'SL / SP', 'Lấy từ']
  heads.forEach((h, i) =>
    span(ws, r, cols[i][0], cols[i][1], h, {
      bold: true,
      size: 10,
      align: i >= 1 && i <= 2 ? 'center' : 'left',
      fill: HEAD_FILL,
      grid: true,
    }),
  )
  ws.getRow(r).height = 22
  r++

  const start = r
  const line = (name: string, unit: string, qty: number, digits: number, src: string) => {
    const zebra = (r - start) % 2 === 1 ? ZEBRA_FILL : undefined
    span(ws, r, cols[0][0], cols[0][1], name, { size: 10, grid: true, fill: zebra })
    span(ws, r, cols[1][0], cols[1][1], unit, {
      size: 10,
      align: 'center',
      grid: true,
      fill: zebra,
    })
    span(ws, r, cols[2][0], cols[2][1], qty, {
      size: 10,
      bold: true,
      align: 'right',
      grid: true,
      fill: zebra,
      numFmt: `#,##0.${'0'.repeat(digits)}`,
    })
    span(ws, r, cols[3][0], cols[3][1], src, {
      size: 9,
      color: INK_SOFT,
      grid: true,
      fill: zebra,
    })
    ws.getRow(r).height = 18
    r++
  }

  const kgByKind = new Map<string, number>()
  for (const p of parts) {
    if (p.weight_kg == null || !p.material_kind) continue
    kgByKind.set(p.material_kind, (kgByKind.get(p.material_kind) ?? 0) + p.weight_kg)
  }
  const KIND: Record<string, string> = { AL: 'Nhôm', IR: 'Sắt / thép', IN: 'Inox' }
  for (const [k, kg] of kgByKind) {
    if (kg > 0) line(KIND[k] ?? k, 'kg', kg, 3, 'Σ khối lượng các dòng khung')
  }

  const paintM2 = parts.reduce(
    (s, p) => s + (layoutOf(p.group_code) === 'metal' ? (p.paint_area_m2 ?? 0) : 0),
    0,
  )
  const cov = coverage && coverage > 0 ? coverage : 5
  if (paintM2 > 0 && !parts.some((p) => layoutOf(p.group_code) === 'paint')) {
    line(
      'Sơn',
      'kg',
      paintM2 / cov,
      3,
      `${paintM2.toFixed(4)} m² bề mặt khung ÷ ${cov} m²/kg`,
    )
  }

  const FAM: { fam: string; label: string; units: ('m3' | 'm2')[] }[] = [
    { fam: 'wood', label: 'Gỗ tự nhiên', units: ['m3'] },
    { fam: 'sheet', label: 'Polywood / ván ép / mặt bàn', units: ['m2', 'm3'] },
    { fam: 'soft', label: 'Nệm / mút / gòn', units: ['m3'] },
    { fam: 'fabric', label: 'Vải / textilene', units: ['m2'] },
  ]
  for (const { fam, label: nm, units } of FAM) {
    const rows = parts.filter((p) => layoutOf(p.group_code) === fam)
    if (!rows.length) continue
    for (const u of units) {
      const qty = rows.reduce(
        (s, p) => s + ((u === 'm3' ? p.volume_m3 : p.paint_area_m2) ?? 0),
        0,
      )
      if (qty > 0)
        line(
          nm,
          u === 'm3' ? 'm³' : 'm²',
          qty,
          u === 'm3' ? 6 : 4,
          `Σ ${rows.length} dòng`,
        )
    }
  }

  // Không có dòng nào tính được thì nói thẳng, đừng để cái khung rỗng.
  if (r === start)
    span(
      ws,
      r++,
      1,
      N,
      'Chưa đủ số liệu để tổng hợp — các dòng định mức còn thiếu khối lượng / diện tích / m³.',
      {
        italic: true,
        size: 10,
        color: INK_SOFT,
        grid: true,
      },
    )

  outline(ws, top, 1, r - 1, N)
  return r
}

/* ─────────────────────── Các sheet chở phần biểu mẫu không có ─────────────── */

/** Đầu sheet phụ: một thanh tiêu đề thống nhất cho cả ba sheet sau. */
function sheetTitle(ws: ExcelJS.Worksheet, cols: number, title: string, sub: string) {
  span(ws, 1, 1, cols, title, { bold: true, size: 14, color: COBALT })
  ws.getRow(1).height = 24
  span(ws, 2, 1, cols, sub, { italic: true, size: 10, color: INK_SOFT })
  ws.getRow(2).height = 16
}

function buildInfoSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const p = input.product
  const ts = p.tech_spec as Record<string, string | undefined>
  const ws = wb.addWorksheet('Thông số kỹ thuật', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  })
  ws.getColumn(1).width = 34
  ws.getColumn(2).width = 56
  sheetTitle(ws, 2, 'THÔNG SỐ KỸ THUẬT', `${p.code} · ${p.name}`)

  const rows: [string, unknown][] = [
    ['#NHẬN DẠNG', ''],
    ['Mã sản phẩm', p.code],
    ['Tên sản phẩm', p.name],
    ['Khách hàng / nhóm', p.customer_name],
    ['Mã khách đặt', p.customer_item_code],
    ['Mã cũ', p.code_legacy],
    ['Loại sản phẩm', labelOf(PRODUCT_TYPES, p.product_type)],
    ['Vật liệu khung', labelOf(FRAME_MATERIALS, p.frame_material)],
    [
      'Trạng thái hồ sơ',
      isLifecycle(p.lifecycle) ? LIFECYCLE_LABEL[p.lifecycle] : p.lifecycle,
    ],
    ['Ngày tạo hồ sơ', fmtDate(p.created_at)],
    ['#KÍCH THƯỚC (mm)', ''],
    ['Dài (D)', p.length_mm],
    ['Rộng (W)', p.width_mm],
    ['Cao (H)', p.height_mm],
    ['Dài khi mở', p.length_open_mm],
    ['Rộng khi mở', p.width_open_mm],
    ['Cao khi mở', p.height_open_mm],
    ['Độ dày', p.thickness_mm],
    ['#KHỐI LƯỢNG (kg)', ''],
    ['Khối lượng tịnh', p.net_weight_kg],
    ['KL thực tế / bảng kê', p.actual_weight_kg],
    ['Tải trọng tối đa', p.max_load_kg],
    ['#THÔNG SỐ SẢN XUẤT (in trên LSX)', ''],
    ['Sơn', ts.paint],
    ['Gỗ', ts.wood],
    ['Kính', ts.glass],
    ['Nệm', ts.cushion],
    ['Máy', ts.machine],
    ['#ĐẶC TÍNH', ''],
    ['Có nệm / bọc', p.is_upholstered ? 'Có' : 'Không'],
    ['Có kính', p.has_glass ? 'Có' : 'Không'],
    ['Là bộ nhiều món', p.is_set ? 'Có' : 'Không'],
    ['Bộ gồm', p.set_contents],
    [
      'Kiểu lắp ráp',
      p.assembly === 'kd' ? 'Tháo rời (KD)' : p.assembly ? 'Nguyên chiếc' : null,
    ],
    ['Chất liệu chính', p.material],
    ['#XUẤT KHẨU', ''],
    ['Mã HS', p.hs_code],
    ['Xuất xứ', p.origin_country],
    ['Barcode', p.barcode],
    ['Mô tả tiếng Anh', p.description_en],
    ['Shipping mark', p.shipping_mark],
    ['Ghi chú nội bộ', p.notes],
  ]

  let r = 4
  for (const [k, v] of rows) {
    if (k.startsWith('#')) {
      span(ws, r, 1, 2, k.slice(1), {
        bold: true,
        size: 11,
        color: COBALT,
        fill: BAND_FILL,
        grid: true,
      })
      ws.getRow(r).height = 20
      r++
      continue
    }
    put(ws, r, 1, k, { size: 10, color: INK_SOFT, fill: LABEL_FILL, grid: true })
    put(ws, r, 2, orDash(v), {
      size: 11,
      bold: typeof v !== 'string' || v.length < 60,
      grid: true,
      wrap: true,
      // Căn TRÁI cả số: cột giá trị rộng 56, căn phải là số văng ra tận mép,
      // đọc dọc không thẳng hàng với nhãn.
      align: 'left',
      numFmt: typeof v === 'number' ? autoFmt(v, 3) : undefined,
      color: v == null || v === '' ? INK_SOFT : INK,
    })
    ws.getRow(r).height = 18
    r++
  }
  outline(ws, 4, 1, r - 1, 2)

  if (input.setItems.length) {
    r += 1
    span(ws, r, 1, 2, 'BỘ GỒM CÁC MÓN', {
      bold: true,
      size: 11,
      color: COBALT,
      fill: BAND_FILL,
      grid: true,
    })
    r++
    const top = r
    put(ws, r, 1, 'Món', { bold: true, size: 10, fill: HEAD_FILL, grid: true })
    put(ws, r, 2, 'Số lượng', {
      bold: true,
      size: 10,
      align: 'right',
      fill: HEAD_FILL,
      grid: true,
    })
    r++
    for (const it of input.setItems) {
      put(ws, r, 1, it.item_label, { size: 10, grid: true })
      put(ws, r, 2, it.qty, {
        size: 10,
        align: 'right',
        grid: true,
        numFmt: autoFmt(it.qty),
      })
      r++
    }
    outline(ws, top - 1, 1, r - 1, 2)
  }
}

function buildPackingSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const p = input.product
  const pk = p.packing as Record<string, number | string | undefined>
  const ws = wb.addWorksheet('Đóng gói', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.getColumn(1).width = 34
  ws.getColumn(2).width = 20
  ws.getColumn(3).width = 10
  sheetTitle(ws, 3, 'QUY CÁCH ĐÓNG GÓI', `${p.code} · ${p.name}`)

  const heads = ['Chỉ tiêu', 'Giá trị', 'ĐVT']
  heads.forEach((h, i) =>
    put(ws, 4, i + 1, h, {
      bold: true,
      size: 10,
      align: i === 1 ? 'right' : 'left',
      fill: HEAD_FILL,
      grid: true,
    }),
  )
  ws.getRow(4).height = 20

  const rows: [string, unknown, string][] = [
    ['Đơn vị đóng gói', pk.pack_unit_label, ''],
    ['Thùng — dài', pk.carton_l_cm, 'cm'],
    ['Thùng — rộng', pk.carton_w_cm, 'cm'],
    ['Thùng — cao', pk.carton_h_cm, 'cm'],
    ['SP / thùng', pk.qty_per_carton, 'cái'],
    ['Xếp 40′HC', pk.loading_40hc, 'cái'],
    ['NW / thùng', pk.nw_kg, 'kg'],
    ['GW / thùng', pk.gw_kg, 'kg'],
    ['CBM / thùng', pk.cbm, 'm³'],
  ]
  rows.forEach(([k, v, u], i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? ZEBRA_FILL : undefined
    put(ws, r, 1, k, { size: 10, color: INK_SOFT, fill: zebra ?? LABEL_FILL, grid: true })
    put(ws, r, 2, orDash(v), {
      size: 11,
      bold: true,
      align: 'right',
      grid: true,
      fill: zebra,
      numFmt: typeof v === 'number' ? autoFmt(v, 3) : undefined,
      color: v == null || v === '' ? INK_SOFT : INK,
    })
    put(ws, r, 3, u, { size: 10, color: INK_SOFT, grid: true, fill: zebra })
    ws.getRow(r).height = 18
  })
  outline(ws, 4, 1, 4 + rows.length, 3)
}

function buildFilesSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  if (!input.files.length) return
  const p = input.product
  const ws = wb.addWorksheet('Tài liệu', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 58
  ws.getColumn(3).width = 24
  ws.getColumn(4).width = 18
  sheetTitle(ws, 4, 'TÀI LIỆU ĐÍNH KÈM', `${p.code} · ${p.name}`)
  ;['Stt', 'Tên file', 'Loại', 'Dung lượng (KB)'].forEach((h, i) =>
    put(ws, 4, i + 1, h, {
      bold: true,
      size: 10,
      align: i === 0 || i === 3 ? 'center' : 'left',
      fill: HEAD_FILL,
      grid: true,
    }),
  )
  ws.getRow(4).height = 20
  input.files.forEach((f, i) => {
    const r = 5 + i
    const zebra = i % 2 === 1 ? ZEBRA_FILL : undefined
    put(ws, r, 1, i + 1, { size: 10, align: 'center', grid: true, fill: zebra })
    put(ws, r, 2, f.filename, { size: 10, grid: true, fill: zebra, wrap: true })
    put(ws, r, 3, docTypeLabel(f.doc_type), {
      size: 10,
      grid: true,
      fill: zebra,
      color: f.doc_type ? INK : INK_SOFT,
    })
    put(ws, r, 4, Math.round(f.size_bytes / 1024), {
      size: 10,
      align: 'right',
      grid: true,
      fill: zebra,
      numFmt: '#,##0',
    })
    ws.getRow(r).height = 18
  })
  outline(ws, 4, 1, 4 + input.files.length, 4)
}

/* ────────────────────────────────── Công khai ─────────────────────────────── */

export async function buildProductExcel(input: ProductExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG Manager'
  wb.created = input.exportedAt
  wb.title = `Hồ sơ sản phẩm ${input.product.code}`

  buildBomSheet(wb, input)
  buildInfoSheet(wb, input)
  buildPackingSheet(wb, input)
  buildFilesSheet(wb, input)

  return Buffer.from(await wb.xlsx.writeBuffer())
}

/**
 * Tên file — mã SP đứng trước để sắp thư mục là tự nhóm theo sản phẩm. Bỏ dấu và
 * ký tự lạ vì tên này đi vào `content-disposition`.
 */
export function productExcelFilename(code: string, name: string): string {
  const slug = `${code} ${name}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
  return `HoSoSP_${slug}.xlsx`
}
