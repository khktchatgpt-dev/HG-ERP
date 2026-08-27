import ExcelJS from 'exceljs'
import type { SoTongPayload } from './so-tong.service'
import { SECTION_LABELS } from '@/lib/production-section'

/**
 * XUẤT EXCEL sổ tổng (GĐ1) — file PHẲNG theo triết lý reports-excel: mỗi dòng
 * một chi tiết, lặp đủ Lệnh/Đơn/Mã SP để kế toán lọc/pivot được, kèm dòng
 * TỔNG LỆNH bold. Chọn tháng thì cột số là PHÁT SINH THÁNG (%HT + trạng thái
 * vẫn lũy kế — ghi rõ trên tiêu đề). Đây là file nộp/đối chiếu trong giai
 * đoạn chạy song song với sổ Excel cũ.
 */

const NUM_FMT = '#,##0.##'

function statusText(pct: number): string {
  if (pct >= 1) return 'Xong'
  if (pct >= 0.75) return 'Sắp xong'
  if (pct >= 0.5) return 'Đang làm'
  if (pct > 0) return 'Mới bắt đầu'
  return 'Chưa làm'
}

export async function buildSoTongExcel(
  data: SoTongPayload,
  month: string | null,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('So tong', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }],
  })

  const stageCols = data.stages
  const header1 = [
    'Lệnh',
    'Khách',
    'Đơn',
    'Phần',
    'Mã SP',
    'Cụm',
    'Chi tiết / cụm',
    'Loại',
    'ĐVT',
    'Tổng cần',
  ]
  for (const s of stageCols)
    header1.push(`${s.label} - SL`, `${s.label} - Phế`, `${s.label} - GC`)
  header1.push('Kg đã làm', '%HT', 'Trạng thái')

  const title = month
    ? `SỔ TỔNG SẢN LƯỢNG — PHÁT SINH THÁNG ${Number(month.slice(5))}/${month.slice(0, 4)} (%HT và trạng thái theo LŨY KẾ)`
    : 'SỔ TỔNG SẢN LƯỢNG TOÀN XƯỞNG — LŨY KẾ'
  const titleRow = ws.addRow([title])
  titleRow.font = { bold: true, size: 13 }
  ws.addRow([
    `Xuất ngày ${new Date().toLocaleDateString('vi-VN')} — GC = phần nhận về từ gia công ngoài (đã nằm trong SL).`,
  ])

  const head = ws.addRow(header1)
  head.font = { bold: true }
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1FC' } }
    c.border = { bottom: { style: 'thin' } }
    c.alignment = { wrapText: true, vertical: 'middle' }
  })

  const numFrom = 10 // cột "Tổng cần" trở đi là số

  for (const b of data.lsx) {
    for (const sec of b.sections) {
      for (const p of sec.products) {
        for (const c of p.components) {
          const row: (string | number | null)[] = [
            b.code,
            b.customer_name,
            p.order_code ?? '',
            SECTION_LABELS[p.section],
            p.product_code,
            c.cluster ?? '',
            c.name,
            c.kind === 'assembly' ? 'CỤM' : 'chi tiết',
            c.unit ?? '',
            c.total_needed,
          ]
          for (const s of stageCols) {
            const cell = c.cells[s.code]
            if (!cell) {
              row.push(null, null, null)
              continue
            }
            const shown = month
              ? (cell.months[month] ?? { done: 0, defect: 0, gc: 0 })
              : cell
            row.push(shown.done || null, shown.defect || null, shown.gc || null)
          }
          const kg = month ? (c.kg_months[month] ?? 0) : c.kg_total
          row.push(
            kg || null,
            Math.round(c.pct_total * 100) / 100,
            statusText(c.pct_total),
          )
          const r = ws.addRow(row.map((v) => (v === null ? '' : v)))
          r.eachCell((cell, col) => {
            if (col >= numFrom && col < header1.length - 1) cell.numFmt = NUM_FMT
            if (col === header1.length - 1) cell.numFmt = '0%'
          })
        }
      }
    }
    // TỔNG lệnh — bold, chỉ cộng trong lệnh.
    const totalRow: (string | number | null)[] = [
      `TỔNG LỆNH ${b.code}`,
      b.customer_name,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      b.totals.needed,
    ]
    for (const s of stageCols) {
      const t = b.totals.stages[s.code]
      if (!t) {
        totalRow.push(null, null, null)
        continue
      }
      const shown = month ? (t.months[month] ?? { done: 0, defect: 0, gc: 0 }) : t
      totalRow.push(shown.done || null, shown.defect || null, shown.gc || null)
    }
    totalRow.push(
      (month ? (b.totals.kg_months[month] ?? 0) : b.totals.kg) || null,
      null,
      null,
    )
    const tr = ws.addRow(totalRow.map((v) => (v === null ? '' : v)))
    tr.font = { bold: true }
    tr.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } }
      if (col >= numFrom) cell.numFmt = NUM_FMT
    })
    ws.addRow([])
  }

  ws.columns.forEach((col, i) => {
    col.width = i === 6 ? 28 : i < 5 ? 16 : 12
  })

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
