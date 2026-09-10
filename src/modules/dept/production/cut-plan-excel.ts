import ExcelJS from 'exceljs'
import {
  NO_SPEC_LABEL,
  lineHasData,
  planTotals,
  type CutGroupPlan,
  type CutPlanDoc,
  type CutPlanResult,
} from '@/lib/cut-plan/types'
import { patternText } from '@/lib/cut-plan/format'

/**
 * XUẤT EXCEL quy cắt — thay cho "Export XLS" của bản gốc:
 *  · "Tổng hợp" (chỉ khi > 1 quy cách): mỗi quy cách một dòng — cây tiêu chuẩn,
 *    số cây cần mua, chi tiết, hao hụt. Cung ứng cầm sheet này đi đặt cây.
 *  · Một sheet MỖI QUY CÁCH: đầu phiếu, tổng, cảnh báo, bảng sơ đồ cắt (thợ
 *    đánh dấu cây đã cắt ở cột cuối). Một quy cách thì sheet tên "Quy cắt".
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
const WARN_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFB91C1C' }, italic: true }

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

/** Tên sheet Excel: bỏ ký tự cấm, tối đa 31 ký tự, không trùng trong workbook. */
export function sheetName(raw: string, used: Set<string>): string {
  const base = (
    raw
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Quy cắt'
  ).slice(0, 31)
  let name = base
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(name.toLowerCase())
  return name
}

function headerLines(ws: ExcelJS.Worksheet, doc: CutPlanDoc, group?: CutGroupPlan) {
  const title = ws.addRow([
    `QUY CẮT PHÔI${doc.title ? ` — ${doc.title}` : ''}${group ? ` — ${group.spec || NO_SPEC_LABEL}` : ''}`,
  ])
  title.font = { bold: true, size: 14 }
  ws.mergeCells(title.number, 1, title.number, 7)
  ws.addRow([
    [
      doc.item ? `Mã hàng: ${doc.item}` : null,
      group ? `Quy cách: ${group.spec || NO_SPEC_LABEL}` : null,
      group
        ? `Cây tiêu chuẩn ${fmtMm(group.stock_length_mm)} mm`
        : `Cây tiêu chuẩn mặc định ${fmtMm(doc.stock_length_mm)} mm`,
    ]
      .filter(Boolean)
      .join('   ·   '),
  ])
}

function warningRows(ws: ExcelJS.Worksheet, warnings: string[]) {
  for (const e of warnings) {
    const er = ws.addRow([`⚠ ${e}`])
    er.font = WARN_FONT
    ws.mergeCells(er.number, 1, er.number, 7)
  }
}

function groupSheet(
  wb: ExcelJS.Workbook,
  name: string,
  doc: CutPlanDoc,
  group: CutGroupPlan,
  extraWarnings: string[],
) {
  const byKey = new Map(doc.lines.map((l) => [l.key, l]))
  const r = group.result
  const ws = wb.addWorksheet(name, {
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
  headerLines(ws, doc, group)
  const totalRow = ws.addRow([
    `Tổng: ${r.bars} cây · ${r.pieces_total} chi tiết · hao hụt ${r.waste_pct}%`,
  ])
  totalRow.font = { bold: true }
  warningRows(ws, [...r.errors, ...extraWarnings])
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
}

export async function buildCutPlanExcel(
  doc: CutPlanDoc,
  plan: CutPlanResult,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const used = new Set<string>()
  const t = planTotals(plan)

  // Cảnh báo dòng bị bỏ vì thiếu số liệu — in ở sheet đầu tiên (tổng hợp hoặc
  // sheet quy cắt duy nhất) để không rơi im lặng khỏi tờ giấy xưởng cầm.
  const rowOf = (key: number) => doc.lines.findIndex((l) => l.key === key) + 1
  const skippedWarning =
    plan.skipped.length > 0
      ? [
          `${plan.skipped.length} dòng chưa tính vì thiếu số liệu: ${plan.skipped
            .map((s) => `dòng ${rowOf(s.key)} (${s.reason.toLowerCase()})`)
            .join(' · ')} — xem sheet "Chi tiết nhập"`,
        ]
      : []

  if (plan.groups.length > 1) {
    const ws = wb.addWorksheet(sheetName('Tổng hợp', used), {
      pageSetup: { orientation: 'landscape', fitToWidth: 1 },
    })
    ws.columns = [
      { width: 40 },
      { width: 16 },
      { width: 10 },
      { width: 10 },
      { width: 11 },
      { width: 12 },
      { width: 12 },
    ]
    headerLines(ws, doc)
    const totalRow = ws.addRow([
      `Tổng: ${t.bars} cây · ${t.groups} quy cách · ${t.pieces_total} chi tiết · hao hụt ${t.waste_pct}%`,
    ])
    totalRow.font = { bold: true }
    warningRows(ws, [
      ...plan.groups.flatMap((g) =>
        g.result.errors.map((e) => `${g.spec || NO_SPEC_LABEL}: ${e}`),
      ),
      ...skippedWarning,
    ])
    ws.addRow([])
    headRow(ws, [
      'Quy cách',
      'Cây tiêu chuẩn (mm)',
      'Số cây',
      'Chi tiết',
      'Hao hụt %',
      'Tổng cây (m)',
      'Dư (m)',
    ])
    for (const g of plan.groups) {
      bodyRow(
        ws,
        [
          g.spec || NO_SPEC_LABEL,
          fmtMm(g.stock_length_mm),
          g.result.bars,
          g.result.pieces_total,
          g.result.waste_pct,
          Math.round(g.result.material_mm / 10) / 100,
          Math.round(g.result.scrap_mm / 10) / 100,
        ],
        [2, 3, 4, 5, 6, 7],
      )
    }
    const sum = bodyRow(
      ws,
      [
        'Tổng',
        '',
        t.bars,
        t.pieces_total,
        t.waste_pct,
        Math.round(t.material_mm / 10) / 100,
        Math.round(t.scrap_mm / 10) / 100,
      ],
      [3, 4, 5, 6, 7],
    )
    sum.font = { bold: true }
  }

  plan.groups.forEach((g, i) => {
    const name = plan.groups.length === 1 ? 'Quy cắt' : g.spec || NO_SPEC_LABEL
    groupSheet(
      wb,
      sheetName(name, used),
      doc,
      g,
      plan.groups.length === 1 && i === 0 ? skippedWarning : [],
    )
  })
  if (plan.groups.length === 0) {
    const ws = wb.addWorksheet(sheetName('Quy cắt', used))
    ws.columns = [{ width: 8 }, { width: 70 }]
    headerLines(ws, doc)
    warningRows(ws, ['Không có chi tiết nào để tính.', ...skippedWarning])
  }

  // ── Chi tiết nhập ─────────────────────────────────────────────────────────
  const wi = wb.addWorksheet(sheetName('Chi tiết nhập', used))
  wi.columns = [
    { width: 6 },
    { width: 34 },
    { width: 12 },
    { width: 10 },
    { width: 28 },
    { width: 36 },
  ]
  headRow(wi, ['STT', 'Tên chi tiết', 'Dài cắt (mm)', 'SL', 'Quy cách', 'Ghi chú'])
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
          l.spec,
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
