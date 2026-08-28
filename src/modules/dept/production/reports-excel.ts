import ExcelJS from 'exceljs'
import type {
  SanLuongReport,
  PheReport,
  NangSuatRow,
  DinhMucReport,
} from './reports.service'

/**
 * XUẤT EXCEL các báo cáo sản xuất (GĐ4 plan-sx) — file phẳng để kế toán/quản
 * lý SUM/lọc tiếp, KHÔNG cố bày như phiếu in (nhu cầu in đã có nút In của
 * trang). Cùng dữ liệu với reports.service — một nguồn số.
 */

const fmtD = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('vi-VN')

const NUM_FMT = '#,##0.##'

function addTable(
  ws: ExcelJS.Worksheet,
  title: string,
  header: string[],
  rows: (string | number | null)[][],
  numericFrom: number,
): void {
  const titleRow = ws.addRow([title])
  titleRow.font = { bold: true, size: 12 }
  const head = ws.addRow(header)
  head.font = { bold: true }
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1FC' } }
    c.border = { bottom: { style: 'thin' } }
  })
  for (const r of rows) {
    const row = ws.addRow(r.map((v) => (v === null ? '' : v)))
    row.eachCell((c, col) => {
      if (col > numericFrom) c.numFmt = NUM_FMT
    })
  }
  ws.addRow([])
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

export async function buildSanLuongExcel(
  report: SanLuongReport,
  stageLabel: (code: string) => string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('San luong')
  const dayHeads = Array.from({ length: report.days }, (_, i) => {
    const d = new Date(`${report.from}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  })
  addTable(
    ws,
    `BÁO CÁO SẢN LƯỢNG ${fmtD(report.from)} → ${fmtD(report.to)}`,
    [
      'Lệnh',
      'Cụm',
      'Chi tiết',
      'Công đoạn',
      ...dayHeads,
      'Σ kỳ',
      'Kg',
      'Lũy kế',
      'Cần',
      'Thiếu/(Dư)',
      '%HT',
      'Người làm',
    ],
    report.rows.map((r) => [
      r.lsx,
      r.cluster,
      r.comp + (r.kind === 'assembly' ? ' (CỤM)' : ''),
      stageLabel(r.stage),
      ...r.by_day.map((q) => (q > 0 ? q : null)),
      r.total,
      r.kg > 0 ? r.kg : null,
      r.done_all,
      r.total_needed,
      Math.round((r.total_needed - r.done_all) * 100) / 100,
      r.total_needed > 0
        ? Math.round(Math.min(r.done_all / r.total_needed, 1) * 100) / 100
        : 0,
      r.workers.join(', '),
    ]),
    4,
  )
  const total = ws.addRow(['TỔNG', '', '', '', ...report.rows.map(() => '')])
  total.getCell(1).font = { bold: true }
  total.getCell(5 + report.days).value = report.total_qty
  total.getCell(6 + report.days).value = report.total_kg
  total.font = { bold: true }
  ws.getColumn(3).width = 28
  ws.getColumn(4).width = 12
  return toBuffer(wb)
}

export async function buildPheExcel(report: PheReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Phe')
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 34
  addTable(
    ws,
    `BÁO CÁO PHẾ ${fmtD(report.from)} → ${fmtD(report.to)} — tổng ${report.total_defect}`,
    ['Tổ', 'Công đoạn', 'Lý do', 'SL phế'],
    report.rows.map((r) => [r.team_name, r.stage_label, r.reason, r.qty]),
    3,
  )
  addTable(
    ws,
    'THEO LÝ DO',
    ['Lý do', 'SL'],
    report.by_reason.map((r) => [r.reason, r.qty]),
    1,
  )
  addTable(
    ws,
    'THEO TỔ',
    ['Tổ', 'SL'],
    report.by_team.map((r) => [r.team_name, r.qty]),
    1,
  )
  addTable(
    ws,
    'THEO CÔNG ĐOẠN',
    ['Công đoạn', 'SL'],
    report.by_stage.map((r) => [r.stage_label, r.qty]),
    1,
  )
  return toBuffer(wb)
}

export async function buildNangSuatExcel(
  from: string,
  to: string,
  rows: NangSuatRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nang suat')
  ws.getColumn(1).width = 24
  ws.getColumn(6).width = 24
  ws.getColumn(7).width = 28
  addTable(
    ws,
    `NĂNG SUẤT THEO NGƯỜI ${fmtD(from)} → ${fmtD(to)} (tên gõ tay trên sổ)`,
    ['Người làm', 'SL đạt', 'Phế', 'Kg', 'Số ngày ghi sổ', 'Tổ', 'Công đoạn'],
    rows.map((r) => [
      r.worker,
      r.qty,
      r.defect,
      r.kg > 0 ? r.kg : null,
      r.days,
      r.teams.join(', '),
      r.stages.join(', '),
    ]),
    1,
  )
  return toBuffer(wb)
}

export async function buildDinhMucExcel(report: DinhMucReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Dinh muc')
  ws.getColumn(1).width = 16
  ws.getColumn(2).width = 34
  addTable(
    ws,
    `ĐỊNH MỨC vs THỰC DÙNG — ${report.lsx.code} (${report.lsx.customer_name})` +
      (report.snapped_at
        ? ` · định mức chốt ${new Date(report.snapped_at).toLocaleDateString('vi-VN')}`
        : ' · CHƯA CHỐT ĐỊNH MỨC — cột "Cần" chưa có nghĩa'),
    [
      'Mã VT',
      'Tên vật tư',
      'ĐVT',
      'Cần (định mức)',
      'Kho đã xuất',
      'Chênh xuất−cần',
      'Kg sổ thống kê',
    ],
    report.rows.map((r) => [
      r.material_code,
      r.material_name,
      r.unit,
      r.qty_needed,
      r.qty_issued,
      Math.round((r.qty_issued - r.qty_needed) * 100) / 100,
      r.kg_logged,
    ]),
    3,
  )
  return toBuffer(wb)
}
