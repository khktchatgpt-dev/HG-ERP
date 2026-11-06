import ExcelJS from 'exceljs'
import type { BaoCaoPayload } from './bao-cao.service'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'

/**
 * EXCEL cho hai bảng MỚI của Báo cáo sản xuất (B6): "Sửa lại còn treo" và
 * "Tồn công đoạn". Bốn bảng cũ vẫn đi `reports-excel.ts` qua `reports.service`.
 *
 * Đổ thẳng từ `BaoCaoPayload` — CÙNG payload màn đang bày, không tính lại:
 * số trên màn và số trong file là một. Chân bảng nói rõ tổng KHÔNG gồm gì
 * (không cộng dọc khác đơn vị), như trên màn.
 */

const fmtD = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const NUM_FMT = '#,##0.##'

function header(ws: ExcelJS.Worksheet, title: string, sub: string, cols: string[]): void {
  const t = ws.addRow([title])
  t.font = { bold: true, size: 12 }
  const s = ws.addRow([sub])
  s.font = { italic: true, color: { argb: 'FF666666' } }
  const h = ws.addRow(cols)
  h.font = { bold: true }
  h.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1FC' } }
    c.border = { bottom: { style: 'thin' } }
  })
}

function numCols(row: ExcelJS.Row, from: number, to: number): void {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c)
    cell.numFmt = NUM_FMT
    cell.alignment = { horizontal: 'right' }
  }
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

export async function buildTreoExcel(p: BaoCaoPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sua lai con treo')
  ;[14, 14, 34, 14, 18, 10, 10, 10, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  header(
    ws,
    `SỬA LẠI CÒN TREO — lệnh đang chạy, mọi kỳ (xuất ${fmtD(p.today)})`,
    'treo = Σ sửa lại − đạt ghi SAU lần sửa (bù theo thứ tự ghi); lọc tổ như trên màn',
    [
      'Lệnh',
      'SP',
      'Dòng',
      'Công đoạn',
      'Tổ',
      'Sửa lại',
      'Đã bù',
      'Còn treo',
      'Ghi sửa gần nhất',
    ],
  )
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  for (const r of p.sua_lai_treo) {
    const row = ws.addRow([
      r.lsx_code,
      r.product_code,
      r.cluster ? `${r.cluster} · ${r.comp}` : r.comp,
      r.stage_label,
      r.team_name ?? '',
      r.rework,
      r.bu,
      r.treo,
      fmtD(r.last_date),
    ])
    numCols(row, 6, 8)
  }
  const tong = p.sua_lai_treo.reduce((a, r) => a + r.treo, 0)
  const f = ws.addRow([
    `${p.sua_lai_treo.length} dòng còn treo`,
    '',
    '',
    '',
    '',
    '',
    '',
    tong,
    'không cộng dọc khác đơn vị',
  ])
  f.font = { bold: true }
  numCols(f, 8, 8)
  return toBuffer(wb)
}

export async function buildTonExcel(p: BaoCaoPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ton cong doan')
  ;[14, 14, 34, 14, 10, 10, 10, 10, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  header(
    ws,
    `TỒN CÔNG ĐOẠN — lệnh đang chạy, hiện trạng (xuất ${fmtD(p.today)})`,
    'tồn = xong (chính thức) − đã giao đi · chờ nhận = phiếu giao đi chưa được tổ nhận xác nhận · cùng hàm với Hồ sơ lệnh và Giao nhận',
    ['Lệnh', 'SP', 'Dòng', 'Công đoạn', 'Đếm', 'Xong', 'Đã giao', 'Tồn', 'Chờ nhận'],
  )
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  for (const r of p.ton_cong_doan) {
    const row = ws.addRow([
      r.lsx_code,
      r.product_code,
      r.cluster ? `${r.cluster} · ${r.comp}` : r.comp,
      r.stage_label,
      COUNT_LEVEL_LABEL[r.count_level],
      r.done,
      r.shipped,
      r.on_hand,
      r.cho_nhan,
    ])
    numCols(row, 6, 9)
  }
  const f = ws.addRow([
    `${p.ton_cong_doan.length} dòng × công đoạn có tồn · không cộng dọc: mỗi dòng mang đơn vị của công đoạn nó đứng`,
  ])
  f.font = { bold: true }
  return toBuffer(wb)
}
