import ExcelJS from 'exceljs'
import { lineHasData, type CutPlanDoc, type CutPlanResult } from '@/lib/cut-plan/types'
import { patternText } from '@/lib/cut-plan/format'

/**
 * XUẤT EXCEL quy cắt — hai sheet, thay cho "Export XLS" của bản gốc:
 *  · "Quy cắt": đầu phiếu, tổng, bảng sơ đồ cắt (thợ đánh dấu cây đã cắt ở cột cuối).
 *  · "Chi tiết nhập": đúng lưới người dùng đã nhập — để lần sau dán lại.
 *
 * Số ghi dạng SỐ thật (không phải chữ) để xưởng còn SUM/sửa tiếp trên file.
 */

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}
const HEAD_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE5E7EB' },
}

const fmtMm = (v: number) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10)

function headRow(ws: ExcelJS.Worksheet, cells: string[]) {
  const row = ws.addRow(cells)
  row.font = { bold: true }
  row.eachCell((c) => {
    c.fill = HEAD_FILL
    c.border = BORDER
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  return row
}

function bodyRow(
  ws: ExcelJS.Worksheet,
  cells: (string | number)[],
  numeric: number[] = [],
) {
  const row = ws.addRow(cells)
  row.eachCell((c, i) => {
    c.border = BORDER
    c.alignment = {
      vertical: 'middle',
      horizontal: numeric.includes(i) ? 'right' : 'left',
      wrapText: true,
    }
  })
  return row
}

export async function buildCutPlanExcel(
  doc: CutPlanDoc,
  plan: CutPlanResult,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const byKey = new Map(doc.lines.map((l) => [l.key, l]))
  const r = plan.result

  // ── Sheet 1: Quy cắt ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Quy cắt', {
    pageSetup: { orientation: 'landscape', fitToWidth: 1 },
  })
  ws.columns = [
    { width: 8 },
    { width: 70 },
    { width: 9 },
    { width: 11 },
    { width: 10 },
    { width: 9 },
    { width: 12 },
  ]
  const title = ws.addRow([`QUY CẮT PHÔI${doc.title ? ` — ${doc.title}` : ''}`])
  title.font = { bold: true, size: 14 }
  ws.mergeCells(title.number, 1, title.number, 7)
  ws.addRow([
    [
      doc.item ? `Mã hàng: ${doc.item}` : null,
      doc.spec ? `Quy cách: ${doc.spec}` : null,
      `Cây tiêu chuẩn ${fmtMm(doc.stock_length_mm)} mm`,
    ]
      .filter(Boolean)
      .join('   ·   '),
  ])
  const totalRow = ws.addRow([
    `Tổng: ${r.bars} cây · ${r.pieces_total} chi tiết · hao hụt ${r.waste_pct}%`,
  ])
  totalRow.font = { bold: true }
  // Cảnh báo in ngay dưới tổng — cả chi tiết không xếp được LẪN dòng bị bỏ vì
  // thiếu số liệu. Trước chỉ in `errors`, dòng thiếu SL lặng lẽ rơi khỏi tờ quy
  // cắt và xưởng không biết có chi tiết chưa được cắt.
  const rowOf = (key: number) => doc.lines.findIndex((l) => l.key === key) + 1
  const warnings = [
    ...r.errors,
    ...(plan.skipped.length > 0
      ? [
          `${plan.skipped.length} dòng chưa tính vì thiếu số liệu: ${plan.skipped
            .map((s) => `dòng ${rowOf(s.key)} (${s.reason.toLowerCase()})`)
            .join(' · ')} — xem sheet "Chi tiết nhập"`,
        ]
      : []),
  ]
  for (const e of warnings) {
    const er = ws.addRow([`⚠ ${e}`])
    er.font = { color: { argb: 'FFB91C1C' }, italic: true }
    ws.mergeCells(er.number, 1, er.number, 7)
  }
  ws.addRow([])
  headRow(ws, [
    'Cây số',
    'Sơ đồ cắt trên một cây (số khúc × dài mm)',
    'Số khúc',
    'Dùng (mm)',
    'Dư (mm)',
    'Số cây',
    'Đã cắt (✓)',
  ])
  let barNo = 0
  for (const pt of r.patterns) {
    const from = barNo + 1
    barNo += pt.bars
    bodyRow(
      ws,
      [
        pt.bars === 1 ? String(from) : `${from}–${barNo}`,
        patternText(pt.pieces, byKey),
        pt.pieces.reduce((a, b) => a + b.count, 0),
        fmtMm(pt.used_mm),
        fmtMm(pt.remnant_mm),
        pt.bars,
        '',
      ],
      [1, 3, 4, 5, 6],
    )
  }

  // ── Sheet 2: Chi tiết nhập ───────────────────────────────────────────────
  const wi = wb.addWorksheet('Chi tiết nhập')
  wi.columns = [{ width: 6 }, { width: 34 }, { width: 12 }, { width: 10 }, { width: 40 }]
  headRow(wi, ['STT', 'Tên chi tiết', 'Dài cắt (mm)', 'SL', 'Ghi chú'])
  doc.lines
    .filter(lineHasData)
    .forEach((l, i) =>
      bodyRow(
        wi,
        [
          i + 1,
          l.part_name,
          l.length_mm === '' ? '' : l.length_mm,
          l.qty === '' ? '' : l.qty,
          l.note,
        ],
        [1, 3, 4],
      ),
    )

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

/** Tên file: tên đợt / mã hàng + ngày giờ, cùng ý "yyyymmdd-hhmm" của bản gốc. */
export function cutPlanExcelFilename(doc: Pick<CutPlanDoc, 'title' | 'item'>): string {
  const name = slug(doc.title || doc.item || 'phoi') || 'phoi'
  const d = new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`
  return `quy-cat_${name}_${stamp}.xlsx`
}
