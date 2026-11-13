import ExcelJS from 'exceljs'
import type { NangSuatPayload } from './nang-suat.service'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import { soDinhMuc } from '@/lib/nang-suat'

/**
 * EXCEL màn Năng suất (`/thongke/nang-suat`, bản vẽ 11/11/2026 tab 3). Đổ thẳng
 * từ `NangSuatPayload` — CÙNG payload màn bày, không tính lại: số trên màn và
 * trong file là một. Hai khối như màn: bảng tóm + bảng chéo × ngày.
 */

const fmtD = (d: string) => d.split('-').reverse().join('/')
const NUM = '#,##0.0'
const NUM0 = '#,##0'

export async function buildNangSuatExcel(
  p: NangSuatPayload,
  theo: 'cong_doan' | 'to',
): Promise<Buffer> {
  const rows = theo === 'to' ? p.to_xuong : p.cong_doan
  const ten = theo === 'to' ? 'Tổ' : 'Công đoạn'
  const ten2 = theo === 'to' ? 'Công đoạn' : 'Tổ'
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nang suat')
  ;[18, 26, 12, 12, 12, 11, 12, 10, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w))

  const t = ws.addRow([
    `NĂNG SUẤT THEO ${ten.toUpperCase()} — kỳ ${fmtD(p.from)} – ${fmtD(p.to)}`,
  ])
  t.font = { bold: true, size: 12 }
  const s = ws.addRow([
    'Năng suất = Σ kg ÷ Σ giờ công (giờ công đầu phiếu: số CN × giờ) · chỉ phiếu đã xác nhận',
  ])
  s.font = { italic: true, color: { argb: 'FF666666' } }

  const head = (cols: string[]) => {
    const h = ws.addRow(cols)
    h.font = { bold: true }
    h.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1FC' } }
      c.border = { bottom: { style: 'thin' } }
    })
  }
  head([
    ten,
    ten2,
    'Sản lượng (kg)',
    'Số lượng',
    'Đơn vị',
    'Giờ công',
    'Năng suất (kg/giờ-người)',
    'ĐM',
    '% ĐM',
  ])
  for (const r of rows) {
    const tile = soDinhMuc(r.ns, r.dm_ns)
    const row = ws.addRow([
      r.label,
      r.sub ?? '',
      r.docs ? r.kg : null,
      r.docs ? r.qty : null,
      r.count_level ? COUNT_LEVEL_LABEL[r.count_level] : '',
      r.docs ? r.hours : null,
      r.ns,
      r.dm_ns,
      tile,
    ])
    ;[3, 4].forEach((c) => (row.getCell(c).numFmt = NUM0))
    ;[6, 7, 8].forEach((c) => (row.getCell(c).numFmt = NUM))
    row.getCell(9).numFmt = '0%'
    if (!r.docs)
      row.getCell(3).value = r.last_date
        ? `không phiếu trong kỳ — lần ghi cuối ${fmtD(r.last_date)}`
        : 'không phiếu trong kỳ'
  }
  const tot = ws.addRow([
    'Toàn xưởng',
    '',
    p.total.kg,
    'không cộng dọc',
    '',
    p.total.hours,
    p.total.ns,
    null,
    null,
  ])
  tot.font = { bold: true }
  tot.getCell(3).numFmt = NUM0
  ;[6, 7].forEach((c) => (tot.getCell(c).numFmt = NUM))

  ws.addRow([])
  const cap = ws.addRow([`${ten} × ngày (kg / giờ-người)`])
  cap.font = { bold: true }
  head([ten, ...p.days.map((d) => fmtD(d).slice(0, 5)), 'Kỳ'])
  for (const r of rows.filter((x) => x.docs > 0)) {
    const row = ws.addRow([r.label, ...r.by_day.map((x) => x.ns), r.ns])
    for (let c = 2; c <= p.days.length + 2; c++) row.getCell(c).numFmt = NUM
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
