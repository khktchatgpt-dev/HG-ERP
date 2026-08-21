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

/**
 * XUẤT HỒ SƠ SẢN PHẨM RA .xlsx.
 *
 * Sheet 1 dựng theo ĐÚNG biểu mẫu "BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN"
 * (HG-QT-07/M02) mà cả 246 file BOM của công ty đang dùng: khối thông tin chung
 * + ảnh SP + từng khối định mức với bộ cột riêng của nó + khối tổng hợp. In ra
 * là khớp tờ giấy xưởng đang ký, nên người nhận không phải học lại cách đọc.
 *
 * Các sheet sau chở phần biểu mẫu KHÔNG có (thông số kỹ thuật, đóng gói, tài
 * liệu) để file trả lời được "toàn bộ thông tin một sản phẩm".
 *
 * Bộ cột và giá trị từng ô lấy từ `part-layouts` — CÙNG nguồn với màn hình. Chép
 * luật sang đây là tự chuốc cảnh file xuất ra khác thứ người dùng vừa nhìn.
 *
 * Số ghi dạng SỐ THẬT (không phải chữ) để người nhận còn SUM và lọc tiếp.
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
  /** Người bấm xuất + thời điểm, ghi ở chân sheet 1 để biết bản in từ đâu ra. */
  exportedBy: string
  exportedAt: Date
}

/* Màu — giữ đúng tinh thần biểu mẫu: tiêu đề khối xám, hàng tiêu đề cột vàng. */
const HEAD_FILL = 'FFFEF08A'
const BLOCK_FILL = 'FFE5E7EB'
const LABEL = 'FF6B7280'
const STOP = 'FFB42318'

const THIN = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB') : ''

/** `1.234` → `0.000` cho numFmt của Excel. */
const numFmt = (digits: number) => (digits <= 0 ? '#,##0' : `#,##0.${'0'.repeat(digits)}`)

function label(ws: ExcelJS.Worksheet, row: number, col: number, text: string) {
  const c = ws.getCell(row, col)
  c.value = text
  c.font = { size: 9, color: { argb: LABEL } }
  return c
}

function value(ws: ExcelJS.Worksheet, row: number, col: number, v: unknown) {
  const c = ws.getCell(row, col)
  c.value = (v ?? '') as ExcelJS.CellValue
  c.font = { size: 10, bold: true }
  return c
}

/* ────────────────────────────── Sheet 1: Định mức ────────────────────────── */

function buildBomSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const { product: p, parts, groups } = input
  const ws = wb.addWorksheet('Định mức', {
    views: [{ state: 'frozen', ySplit: 0 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 30
  for (let i = 4; i <= 20; i++) ws.getColumn(i).width = 12

  let r = 1
  const title = ws.getCell(r, 1)
  title.value = 'BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN'
  title.font = { size: 14, bold: true }
  ws.mergeCells(r, 1, r, 8)
  // Khối kiểm soát tài liệu ISO nằm bên phải, đúng chỗ của biểu mẫu.
  label(ws, r, 10, 'Lần ban hành')
  value(ws, r, 11, p.bom_rev ?? '')
  label(ws, r + 1, 10, 'Hiệu lực')
  value(ws, r + 1, 11, fmtDate(p.bom_effective_date))
  r += 3

  /* ── Khối thông tin chung ── */
  const info: [string, unknown][] = [
    ['TÊN SP', p.name],
    ['Mã Số HG', p.code],
    ['K.HÀNG', p.customer_name],
    ['MÃ K.HÀNG', p.customer_item_code],
    ['Mã cũ', p.code_legacy],
    ['KTSP (W x D x H) mm', dims(p.width_mm, p.length_mm, p.height_mm)],
    ['Nhiên Liệu', p.base_material ?? p.frame_material],
    ['ĐVT', p.unit],
    ['KL.Thực tế / BK', p.actual_weight_kg],
  ]
  const infoTop = r
  info.forEach(([k, v], i) => {
    label(ws, infoTop + i, 5, k)
    value(ws, infoTop + i, 7, v)
  })

  // Ảnh SP vào đúng ô "Hình ảnh" bên trái khối thông tin.
  if (input.image) {
    const id = wb.addImage({
      // `as never` giống lsx-excel: exceljs khai Buffer đời cũ, TS 5 không nhận.
      buffer: input.image.buffer as never,
      extension: input.image.extension,
    })
    ws.addImage(id, {
      tl: { col: 0.2, row: infoTop - 0.8 },
      ext: { width: 190, height: 150 },
    })
  }
  r = infoTop + info.length + 1

  /* ── Dòng đóng gói, đúng thứ tự biểu mẫu ── */
  const pk = input.product.packing as Record<string, number | string | undefined>
  const packRow: [string, unknown][] = [
    ['Option', pk.pack_unit_label],
    [
      'KTBB (mm)',
      dims(cmToMm(pk.carton_l_cm), cmToMm(pk.carton_w_cm), cmToMm(pk.carton_h_cm)),
    ],
    ['Cái / 40HC', pk.loading_40hc],
    ['SP / thùng', pk.qty_per_carton],
    ['NW', pk.nw_kg],
    ['GW', pk.gw_kg],
  ]
  packRow.forEach(([k], i) => label(ws, r, 5 + i, k))
  packRow.forEach(([, v], i) => value(ws, r + 1, 5 + i, v))
  r += 3

  /* ── Từng khối định mức ── */
  const byGroup = new Map<string, PartView[]>()
  for (const part of parts) {
    if (!byGroup.has(part.group_code)) byGroup.set(part.group_code, [])
    byGroup.get(part.group_code)!.push(part)
  }

  for (const g of groups) {
    const rows = byGroup.get(g.code)
    if (!rows?.length) continue
    const layout = layoutOf(g.code)
    const cols = columnsFor(g.code, rows)

    const head = ws.getCell(r, 1)
    head.value = rows[0].section_title || g.label
    head.font = { bold: true, size: 11 }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLOCK_FILL } }
    ws.mergeCells(r, 1, r, 3 + cols.length)
    r++

    const headers = [
      'Stt',
      layout === 'supply' || layout === 'paint' || layout === 'rope'
        ? 'TÊN HÀNG HÓA'
        : 'Tên chi tiết',
      'Cụm',
      ...cols.map((c) => c.label),
    ]
    headers.forEach((h, i) => {
      const c = ws.getCell(r, i + 1)
      c.value = h
      c.font = { bold: true, size: 9 }
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
      c.border = BORDER
    })
    r++

    const clusterName = new Map(input.clusters.map((c) => [c.id, c.name]))
    rows.forEach((part, i) => {
      writeCell(ws, r, 1, part.part_no ?? i + 1, 0)
      writeCell(ws, r, 2, nameOf(part, layout), null)
      writeCell(
        ws,
        r,
        3,
        part.cluster_id ? (clusterName.get(part.cluster_id) ?? '') : '',
        null,
      )
      cols.forEach((c, ci) => writeBomCell(ws, r, 4 + ci, part, c))
      r++
    })

    // Dòng TỔNG — chỉ cộng những cột thật sự cộng được.
    writeTotalRow(ws, r, cols, rows)
    r += 2
  }

  /* ── Tổng hợp vật tư ── */
  r = writeRollup(ws, r, parts, input.product.paint_coverage_m2_per_kg)

  const foot = ws.getCell(r + 1, 1)
  foot.value = `Xuất bởi ${input.exportedBy} · ${input.exportedAt.toLocaleString('vi-VN')} · nguồn: hồ sơ ${p.code} trên HG Manager`
  foot.font = { size: 8, italic: true, color: { argb: LABEL } }
}

const cmToMm = (v: number | string | undefined) =>
  v == null ? null : Math.round(Number(v) * 10)

const dims = (a: number | null, b: number | null, c: number | null) =>
  [a, b, c].every((x) => x == null) ? '' : `${a ?? '?'} x ${b ?? '?'} x ${c ?? '?'}`

function writeCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  v: string | number | null,
  digits: number | null,
) {
  const c = ws.getCell(row, col)
  c.value = (v ?? '') as ExcelJS.CellValue
  c.font = { size: 10 }
  c.border = BORDER
  if (typeof v === 'number' && digits != null) {
    c.numFmt = numFmt(digits)
    c.alignment = { horizontal: 'right' }
  }
  return c
}

/** Một ô định mức — giá trị và số lẻ đều lấy từ `part-layouts`. */
function writeBomCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  p: PartView,
  c: PartColumn,
) {
  if (c.key === 'blank') {
    writeCell(ws, row, col, p.blank_confirmed_at ? '✓' : '', null)
    return
  }
  // SL chưa có: ghi chữ đỏ thay vì để trống — file gửi đi phải nói rõ chỗ thiếu,
  // ô trống trong Excel đọc như "bằng 0".
  if (c.key === 'qty' && p.qty == null) {
    const cell = writeCell(ws, row, col, 'cần SL', null)
    cell.font = { size: 10, bold: true, color: { argb: STOP } }
    return
  }
  const v = cellRaw(p, c.key)
  writeCell(ws, row, col, v, typeof v === 'number' ? cellDigits(c.key) : null)
}

/** Cột cộng được: SL và bốn số dẫn xuất. Cột chữ/kích thước thì để trống. */
const SUMMABLE = new Set(['qty', 'len', 'kg', 'm2', 'm3', 'totalM', 'totalM2'])

function writeTotalRow(
  ws: ExcelJS.Worksheet,
  row: number,
  cols: PartColumn[],
  rows: PartView[],
) {
  const c0 = ws.getCell(row, 2)
  c0.value = 'Tổng cộng'
  c0.font = { bold: true, size: 10 }
  cols.forEach((c, ci) => {
    if (!SUMMABLE.has(c.key)) return
    const total = rows.reduce((s, p) => {
      const v = cellRaw(p, c.key)
      return s + (typeof v === 'number' ? v : 0)
    }, 0)
    if (total === 0) return
    const cell = writeCell(ws, row, 4 + ci, total, cellDigits(c.key))
    cell.font = { size: 10, bold: true }
  })
}

/**
 * Khối "Tổng hợp vật tư" — cùng luật với thẻ trên màn hình: gộp THEO HỌ và nêu
 * đúng đơn vị mua của họ đó (gỗ/nệm m³ · vải m² · khung kg).
 */
function writeRollup(
  ws: ExcelJS.Worksheet,
  from: number,
  parts: PartView[],
  coverage: number | null,
): number {
  let r = from
  const head = ws.getCell(r, 1)
  head.value = 'TỔNG HỢP VẬT TƯ (tự tính từ định mức)'
  head.font = { bold: true, size: 11 }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLOCK_FILL } }
  ws.mergeCells(r, 1, r, 5)
  r++
  ;['Tên hàng hoá', 'ĐVT', 'SL / SP', 'Lấy từ'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h
    c.font = { bold: true, size: 9 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
    c.border = BORDER
  })
  r++

  const line = (
    name: string,
    unit: string,
    qty: number,
    digits: number,
    from2: string,
  ) => {
    writeCell(ws, r, 1, name, null)
    writeCell(ws, r, 2, unit, null)
    writeCell(ws, r, 3, qty, digits)
    writeCell(ws, r, 4, from2, null)
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
  return r
}

/* ─────────────────────── Các sheet chở phần biểu mẫu không có ─────────────── */

function buildInfoSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const p = input.product
  const ts = p.tech_spec as Record<string, string | undefined>
  const ws = wb.addWorksheet('Thông số kỹ thuật')
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 46

  const rows: [string, unknown][] = [
    ['Mã sản phẩm', p.code],
    ['Tên sản phẩm', p.name],
    ['Khách hàng / nhóm', p.customer_name],
    ['Mã khách đặt', p.customer_item_code],
    ['Mã cũ', p.code_legacy],
    ['Loại sản phẩm', p.product_type],
    ['Vật liệu khung', p.frame_material],
    ['Trạng thái hồ sơ', p.lifecycle],
    ['Ngày tạo hồ sơ', fmtDate(p.created_at)],
    ['', ''],
    ['KÍCH THƯỚC (mm)', ''],
    ['Dài (D)', p.length_mm],
    ['Rộng (W)', p.width_mm],
    ['Cao (H)', p.height_mm],
    ['Dài khi mở', p.length_open_mm],
    ['Rộng khi mở', p.width_open_mm],
    ['Cao khi mở', p.height_open_mm],
    ['Độ dày', p.thickness_mm],
    ['', ''],
    ['KHỐI LƯỢNG', ''],
    ['Khối lượng tịnh (kg)', p.net_weight_kg],
    ['KL thực tế / bảng kê (kg)', p.actual_weight_kg],
    ['Tải trọng tối đa (kg)', p.max_load_kg],
    ['', ''],
    ['THÔNG SỐ SẢN XUẤT (in trên LSX)', ''],
    ['Sơn', ts.paint],
    ['Gỗ', ts.wood],
    ['Kính', ts.glass],
    ['Nệm', ts.cushion],
    ['Máy', ts.machine],
    ['', ''],
    ['ĐẶC TÍNH', ''],
    ['Có nệm / bọc', p.is_upholstered ? 'Có' : 'Không'],
    ['Có kính', p.has_glass ? 'Có' : 'Không'],
    ['Là bộ nhiều món', p.is_set ? 'Có' : 'Không'],
    ['Bộ gồm', p.set_contents],
    [
      'Kiểu lắp ráp',
      p.assembly === 'kd' ? 'Tháo rời (KD)' : p.assembly ? 'Nguyên chiếc' : '',
    ],
    ['Chất liệu chính', p.material],
    ['', ''],
    ['XUẤT KHẨU', ''],
    ['Mã HS', p.hs_code],
    ['Xuất xứ', p.origin_country],
    ['Barcode', p.barcode],
    ['Mô tả tiếng Anh', p.description_en],
    ['Shipping mark', p.shipping_mark],
    ['Ghi chú nội bộ', p.notes],
  ]
  rows.forEach(([k, v], i) => {
    const r = i + 1
    const kc = ws.getCell(r, 1)
    kc.value = k as string
    const isHead = typeof k === 'string' && k === k.toUpperCase() && k.trim() !== ''
    kc.font = isHead ? { bold: true, size: 10 } : { size: 10, color: { argb: LABEL } }
    if (isHead)
      kc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLOCK_FILL } }
    const vc = ws.getCell(r, 2)
    vc.value = (v ?? '') as ExcelJS.CellValue
    vc.font = { size: 10 }
    vc.alignment = { wrapText: true }
  })

  if (input.setItems.length) {
    let r = rows.length + 2
    ws.getCell(r, 1).value = 'BỘ GỒM CÁC MÓN'
    ws.getCell(r, 1).font = { bold: true, size: 10 }
    r++
    for (const it of input.setItems) {
      ws.getCell(r, 1).value = it.item_label
      ws.getCell(r, 2).value = it.qty
      r++
    }
  }
}

function buildPackingSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  const pk = input.product.packing as Record<string, number | string | undefined>
  const ws = wb.addWorksheet('Đóng gói')
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 24
  const rows: [string, unknown][] = [
    ['Đơn vị đóng gói', pk.pack_unit_label],
    ['Carton dài (cm)', pk.carton_l_cm],
    ['Carton rộng (cm)', pk.carton_w_cm],
    ['Carton cao (cm)', pk.carton_h_cm],
    ['SP / thùng', pk.qty_per_carton],
    ['Xếp 40′HC', pk.loading_40hc],
    ['NW / thùng (kg)', pk.nw_kg],
    ['GW / thùng (kg)', pk.gw_kg],
    ['CBM / thùng', pk.cbm],
  ]
  rows.forEach(([k, v], i) => {
    ws.getCell(i + 1, 1).value = k as string
    ws.getCell(i + 1, 1).font = { size: 10, color: { argb: LABEL } }
    ws.getCell(i + 1, 2).value = (v ?? '') as ExcelJS.CellValue
    ws.getCell(i + 1, 2).font = { size: 10, bold: true }
  })
}

function buildFilesSheet(wb: ExcelJS.Workbook, input: ProductExcelInput) {
  if (!input.files.length) return
  const ws = wb.addWorksheet('Tài liệu')
  ws.getColumn(1).width = 52
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 14
  ;['Tên file', 'Loại', 'Dung lượng (KB)'].forEach((h, i) => {
    const c = ws.getCell(1, i + 1)
    c.value = h
    c.font = { bold: true, size: 9 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
  })
  input.files.forEach((f, i) => {
    ws.getCell(i + 2, 1).value = f.filename
    ws.getCell(i + 2, 2).value = f.doc_type ?? ''
    ws.getCell(i + 2, 3).value = Math.round(f.size_bytes / 1024)
  })
}

/* ────────────────────────────────── Công khai ─────────────────────────────── */

export async function buildProductExcel(input: ProductExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG Manager'
  wb.created = input.exportedAt

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
