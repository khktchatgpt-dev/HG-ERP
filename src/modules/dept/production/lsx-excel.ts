import ExcelJS from 'exceljs'
import type { LsxSheetColumn, LsxTemplate } from '@/modules/dept/sales/lsx-template'
import {
  groupCell,
  isReady,
  lineCell,
  valueState,
  type LsxSheetGroupData,
} from './lsx-sheet-cells'

/**
 * XUẤT EXCEL phiếu LỆNH SẢN XUẤT — file .xlsx bày GIỐNG HỆT phiếu in
 * (LsxPrintSheet): cùng bộ cột (bỏ khối kiểm tra hồ sơ), cùng gộp ô nhóm
 * Đơn hàng/Số PO, cùng màu (đỏ Số PO·SL·Thời gian xuất, cam "xác nhận sau",
 * xanh mã SP đủ mẫu, vàng dòng vừa sửa), cùng dòng Total Cube/Tổng, kèm ảnh SP.
 * Giá trị + tín hiệu màu lấy từ lsx-sheet-cells — một nguồn cho cả hai bản.
 *
 * SL/CBM ghi dạng SỐ thật (không phải chữ) để Sales còn SUM/sửa tiếp trên file.
 */

export type LsxExcelHeader = {
  customer_name: string
  code: string
  issued_at: string | null
  received_date: string | null
  completed_at: string | null
  container_summary: string | null
  note: string | null
  revision: number
  revised_at: string | null
}

export type LsxExcelImage = { buffer: Buffer; extension: 'png' | 'jpeg' }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '')

/* Màu đồng bộ với phiếu in (tailwind → ARGB). */
const RED = 'FFDC2626' // text-red-600 — luôn kèm bold (Số PO · SL · Thời gian xuất)
const HEAD_FILL = 'FFFEF08A' // bg-yellow-200 — hàng tiêu đề cột
const GREEN_FILL = 'FFDCFCE7' // bg-green-100 — mã SP đủ mẫu
const ORANGE_FILL = 'FFFFEDD5' // bg-orange-100 — "xác nhận sau"
// Dòng vừa sửa ở bản chỉnh sửa — XANH, không vàng: vàng đã là màu hàng tiêu đề,
// hai sắc vàng cạnh nhau đọc ra như cùng một loại tín hiệu.
const CHANGED_FILL = 'FFE0F2FE' // bg-sky-100

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}
const CENTER: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
}

/** Bề rộng cột Excel theo vai của cột — xấp xỉ tỉ lệ trên phiếu in. */
function colWidth(c: LsxSheetColumn): number {
  const s = c.source
  if (s.kind === 'stt') return 5
  if (s.kind === 'image') return 15
  if (s.kind === 'group') return s.field === 'title' ? 16 : 14
  if (s.kind === 'total_cbm') return 9
  if (s.kind === 'spec') return 14
  if (s.kind === 'line') {
    switch (s.field) {
      case 'unit':
        return 6
      case 'qty':
        return 9
      case 'cbm':
        return 8
      case 'name_foreign':
        return 26
      case 'name_vi':
        return 20
      case 'note':
        return 24
      case 'barcode':
        return 14
      case 'ship':
        return 12
      default:
        return 13
    }
  }
  return 12
}

export async function buildLsxExcel(input: {
  company: Record<string, string | null>
  header: LsxExcelHeader
  template: LsxTemplate
  groups: LsxSheetGroupData[]
  /** image_file_id → ảnh đã tải (thiếu ảnh thì ô để trống, không chặn xuất). */
  images: Map<string, LsxExcelImage>
}): Promise<Buffer> {
  const { company, header, template, groups, images } = input
  // Đồng bộ với phiếu in: khối "Kiểm tra hồ sơ" không xuất.
  const cols = template.columns.filter((c) => c.source.kind !== 'check')
  const n = cols.length
  const lines = groups.flatMap((g) => g.lines)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const isRevision = header.revision > 1
  const qtyIdx = cols.findIndex(
    (c) => c.source.kind === 'line' && c.source.field === 'qty',
  )
  const cubeIdx = cols.findIndex((c) => c.source.kind === 'total_cbm')
  const imgIdx = cols.findIndex((c) => c.source.kind === 'image')

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('LSX', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  })
  ws.columns = cols.map((c) => ({ width: colWidth(c) }))

  const set = (
    row: number,
    col: number,
    value: ExcelJS.CellValue,
    style?: Partial<ExcelJS.Style>,
  ) => {
    const cell = ws.getCell(row, col)
    cell.value = value
    if (style) Object.assign(cell, style)
    return cell
  }
  /** Ghi 1 dòng 2 khối trái/phải (letterhead) — mỗi khối merge một dải cột. */
  const rightStart = Math.max(2, n - 4)

  /* ── Đầu phiếu: công ty trái, quốc hiệu + ngày phải ─────────────────────── */
  let r = 1
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, (company.company_name ?? '').toUpperCase(), {
    font: { bold: true, size: 10 },
  })
  ws.mergeCells(r, rightStart, r, n)
  set(r, rightStart, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'center' },
  })
  r++
  ws.mergeCells(r, 1, r, rightStart - 1)
  if (company.company_address) set(r, 1, `Địa chỉ: ${company.company_address}`)
  ws.mergeCells(r, rightStart, r, n)
  set(r, rightStart, 'Độc lập – Tự do – Hạnh phúc', {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'center' },
  })
  r++
  const info = [
    company.company_tax_code && `MST: ${company.company_tax_code}`,
    company.company_phone && `SĐT: ${company.company_phone}`,
    company.company_fax && `Fax: ${company.company_fax}`,
  ]
    .filter(Boolean)
    .join('   ')
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, info)
  const d = new Date()
  ws.mergeCells(r, rightStart, r, n)
  set(
    r,
    rightStart,
    `${company.company_locality ? `${company.company_locality}, ` : ''}ngày ${String(
      d.getDate(),
    ).padStart(
      2,
      '0',
    )} tháng ${String(d.getMonth() + 1).padStart(2, '0')} năm ${d.getFullYear()}`,
    { font: { italic: true, size: 10 }, alignment: { horizontal: 'center' } },
  )

  /* ── Tiêu đề ────────────────────────────────────────────────────────────── */
  r += 2
  ws.mergeCells(r, 1, r, n)
  set(r, 1, 'LỆNH SẢN XUẤT', {
    font: { bold: true, size: 16 },
    alignment: { horizontal: 'center' },
  })
  if (isRevision) {
    r++
    ws.mergeCells(r, 1, r, n)
    set(r, 1, `CHỈNH SỬA LẦN ${header.revision} — NGÀY ${fmtD(header.revised_at)}`, {
      font: { size: 10 },
      alignment: { horizontal: 'center' },
    })
  }

  /* ── Thông tin đầu: khách trái, số lệnh phải ────────────────────────────── */
  r += 1
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, `Tên khách hàng: ${header.customer_name}`, { font: { bold: true, size: 10 } })
  ws.mergeCells(r, rightStart, r, n)
  set(r, rightStart, `SỐ ${header.code}`, {
    font: { bold: true, size: 11 },
    alignment: { horizontal: 'right' },
  })
  r++
  ws.mergeCells(r, 1, r, rightStart - 1)
  set(r, 1, `Ngày phát hành: ${fmtD(header.issued_at)}`)
  ws.mergeCells(r, rightStart, r, n)
  const rightInfo = [
    header.container_summary && `Cont: ${header.container_summary}`,
    header.completed_at && `Hoàn thành: ${fmtD(header.completed_at)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (rightInfo) set(r, rightStart, rightInfo, { alignment: { horizontal: 'right' } })
  if (header.received_date) {
    r++
    ws.mergeCells(r, 1, r, n)
    set(r, 1, `Ngày nhận đơn: ${fmtD(header.received_date)}`)
  }
  r++
  ws.mergeCells(r, 1, r, n)
  set(
    r,
    1,
    'Phòng kế hoạch yêu cầu các tổ trưởng và các bộ phận liên quan thực hiện đơn hàng với các điều kiện sau:',
    { font: { size: 10 } },
  )

  /* ── Header bảng ────────────────────────────────────────────────────────── */
  r += 1
  const headRow = r
  cols.forEach((c, i) => {
    set(headRow, i + 1, c.label, {
      font: {
        bold: true,
        size: 9,
        color: c.emphasis === 'red' ? { argb: RED } : undefined,
      },
      alignment: CENTER,
      border: BORDER,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } },
    })
  })
  ws.getRow(headRow).height = 30

  /* ── Dòng dữ liệu theo nhóm — gộp ô như phiếu in ────────────────────────── */
  r = headRow
  const hasImages = images.size > 0
  for (const [gi, g] of groups.entries()) {
    // LAURA: một dòng tên bộ sưu tập trước các dòng của nhóm.
    if (template.group_mode === 'title_row' && g.title) {
      r++
      set(r, 1, '', { border: BORDER })
      ws.mergeCells(r, 2, r, n)
      set(r, 2, g.title, {
        font: { bold: true, size: 9 },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: BORDER,
      })
    }

    const groupStart = r + 1
    for (const [li, l] of g.lines.entries()) {
      r++
      const changed = isRevision && l.changed_in_rev === header.revision
      if (hasImages && l.image_file_id) ws.getRow(r).height = 58
      cols.forEach((c, ci) => {
        const src = c.source
        const isGroupCol =
          src.kind === 'group' || (src.kind === 'stt' && template.stt_mode === 'group')
        // Cột nhóm: chỉ ghi ở dòng đầu, lát nữa merge dọc hết nhóm.
        if (isGroupCol && template.group_mode === 'columns') {
          if (li === 0) {
            set(r, ci + 1, src.kind === 'stt' ? gi + 1 : groupCell(c, g), {
              font:
                c.emphasis === 'red'
                  ? { size: 9, bold: true, color: { argb: RED } }
                  : { size: 9 },
              alignment: CENTER,
              border: BORDER,
            })
          } else {
            set(r, ci + 1, '', { border: BORDER })
          }
          return
        }

        const style: Partial<ExcelJS.Style> = {
          font: { size: 9 },
          alignment: CENTER,
          border: BORDER,
        }
        if (c.emphasis === 'red')
          style.font = { size: 9, bold: true, color: { argb: RED } }
        let value: ExcelJS.CellValue = ''

        if (src.kind === 'stt') {
          value = `${changed ? '▲ ' : ''}${li + 1}`
        } else if (src.kind === 'image') {
          value = ''
        } else if (src.kind === 'line' && src.field === 'qty') {
          value = l.qty
          style.numFmt = '#,##0'
          style.font = { ...style.font, bold: true }
        } else if (src.kind === 'line' && src.field === 'cbm') {
          if (l.cbm != null) {
            value = l.cbm
            style.numFmt = '0.###'
          }
        } else if (src.kind === 'total_cbm') {
          if (l.cbm != null) {
            value = l.cbm * l.qty
            style.numFmt = '0.###'
          }
        } else {
          value = lineCell(c, l)
        }

        // Tín hiệu theo giá trị — cùng quy tắc với phiếu in (lsx-sheet-cells).
        const text = typeof value === 'string' ? value : ''
        const state = valueState(text, false)
        if (state === 'pending') {
          style.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ORANGE_FILL },
          }
          style.font = { size: 9, bold: true, color: { argb: RED } }
        }
        if (src.kind === 'line' && src.field === 'product_code' && isReady(l)) {
          style.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: GREEN_FILL },
          }
        }
        if (changed && !style.fill) {
          style.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: CHANGED_FILL },
          }
        }
        set(r, ci + 1, value, style)
      })

      // Ảnh SP neo vào ô cột Hình ảnh.
      if (imgIdx >= 0 && l.image_file_id) {
        const img = images.get(l.image_file_id)
        if (img) {
          const id = wb.addImage({
            buffer: img.buffer as never,
            extension: img.extension,
          })
          ws.addImage(id, {
            tl: { col: imgIdx + 0.12, row: r - 1 + 0.08 },
            ext: { width: 86, height: 66 },
            editAs: 'oneCell',
          })
        }
      }
    }

    // "Total Cube:" — khép mỗi nhóm bằng tổng khối (ROSCO).
    if (template.group_total === 'cube') {
      r++
      const gCbm = g.lines.reduce((s, l) => s + (l.cbm ?? 0) * l.qty, 0)
      cols.forEach((c, ci) => {
        const src = c.source
        const isGroupCol =
          src.kind === 'group' || (src.kind === 'stt' && template.stt_mode === 'group')
        if (isGroupCol && template.group_mode === 'columns') {
          set(r, ci + 1, '', { border: BORDER })
          return
        }
        if (ci === qtyIdx) {
          set(r, ci + 1, 'Total Cube:', {
            font: { size: 9, bold: true },
            alignment: { horizontal: 'right', vertical: 'middle' },
            border: BORDER,
          })
        } else if (ci === cubeIdx) {
          set(r, ci + 1, gCbm, {
            font: { size: 9, bold: true },
            alignment: { horizontal: 'right', vertical: 'middle' },
            border: BORDER,
            numFmt: '0.###',
          })
        } else {
          set(r, ci + 1, '', { border: BORDER })
        }
      })
    }

    // Merge dọc cột nhóm (STT nhóm / Đơn hàng / Số PO) suốt các dòng + dòng cube.
    if (template.group_mode === 'columns' && r > groupStart) {
      cols.forEach((c, ci) => {
        const src = c.source
        const isGroupCol =
          src.kind === 'group' || (src.kind === 'stt' && template.stt_mode === 'group')
        if (isGroupCol) ws.mergeCells(groupStart, ci + 1, r, ci + 1)
      })
    }
  }

  // "Tổng" — khép phiếu bằng tổng số lượng.
  if (template.grand_total === 'qty') {
    r++
    cols.forEach((_, ci) => {
      if (ci === 1) {
        set(r, ci + 1, 'Tổng', {
          font: { size: 9, bold: true },
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: BORDER,
        })
      } else if (ci === qtyIdx) {
        set(r, ci + 1, totalQty, {
          font: { size: 9, bold: true },
          alignment: { horizontal: 'right', vertical: 'middle' },
          border: BORDER,
          numFmt: '#,##0',
        })
      } else {
        set(r, ci + 1, '', { border: BORDER })
      }
    })
  }

  /* ── Ghi chú + nơi nhận + chữ ký ────────────────────────────────────────── */
  if (header.note) {
    r += 2
    ws.mergeCells(r, 1, r, n)
    set(r, 1, `Ghi chú lệnh: ${header.note}`, {
      font: { size: 10 },
      alignment: { wrapText: true, vertical: 'top' },
    })
  }
  if (template.notes_footer) {
    r += 2
    ws.mergeCells(r, 1, r, n)
    set(r, 1, 'MỘT SỐ LƯU Ý CHUNG:', { font: { bold: true, size: 10 } })
    r++
    ws.mergeCells(r, 1, r, n)
    set(r, 1, template.notes_footer, {
      font: { size: 10 },
      alignment: { wrapText: true, vertical: 'top' },
    })
  }
  r += 2
  ws.mergeCells(r, 1, r, n)
  set(r, 1, 'Nơi nhận:', { font: { bold: true, size: 10 } })
  for (const line of [
    '- Quản lý sản xuất',
    '- Các tổ trưởng, trưởng bộ phận',
    '- Kho vật tư, nguyên liệu',
  ]) {
    r++
    ws.mergeCells(r, 1, r, n)
    set(r, 1, line, { font: { size: 10 } })
  }
  r += 2
  const third = Math.max(1, Math.floor(n / 3))
  const signs: [string, number, number][] = [
    ['Người lập', 1, third],
    ['Trưởng phòng kế hoạch', third + 1, third * 2],
    ['Giám Đốc', third * 2 + 1, n],
  ]
  for (const [role, a, b] of signs) {
    ws.mergeCells(r, a, r, b)
    set(r, a, role, {
      font: { bold: true, size: 10 },
      alignment: { horizontal: 'center' },
    })
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

/** Tên file tải về — mã lệnh chứa "/" nên phải làm sạch ký tự cấm. */
export const lsxExcelFilename = (code: string) =>
  `LSX ${code.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`
