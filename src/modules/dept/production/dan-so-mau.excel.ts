import ExcelJS from 'exceljs'
import type { MauTo } from '@/lib/dan-so'

/**
 * TỜ MẪU DÁN SỔ (B3): mỗi mã hàng một sheet, đầu cột đúng như `docDan` đọc —
 * Cụm · Tên chi tiết · Mã SP · CT/SP · Tổng cần · các ngày (dd/mm/yyyy, chữ).
 * Tên chi tiết lấy từ bảng chi tiết của lệnh nên dán lại là KHỚP 100%; ô ngày
 * điền sẵn số đã có của tổ. Cột Tổng cần chỉ để đối chiếu, không ghi vào sổ.
 */
const dmy = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** Tên sheet Excel: bỏ ký tự cấm, ≤ 31 ký tự, không trùng. */
function sheetName(raw: string, used: Set<string>) {
  const base = raw.replace(/[\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Tờ'
  let n = base
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`
  used.add(n.toLowerCase())
  return n
}

export async function buildMauExcel(tos: MauTo[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const used = new Set<string>()
  for (const t of tos) {
    const ws = wb.addWorksheet(sheetName(t.ten, used), {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
    })
    const head = ['Cụm', 'Tên chi tiết', 'Mã SP', 'CT/SP', 'Tổng cần', ...t.cot.map(dmy)]
    const hr = ws.addRow(head)
    hr.font = { bold: true }
    hr.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
    for (const d of t.dong) {
      ws.addRow([
        d.cum,
        d.ten,
        t.ma,
        d.ct_sp,
        d.can,
        ...t.cot.map((iso) => (d.o[iso] != null ? d.o[iso] : null)),
      ])
    }
    ws.getColumn(1).width = 18
    ws.getColumn(2).width = 34
    ws.getColumn(3).width = 14
    ws.getColumn(4).width = 7
    ws.getColumn(5).width = 10
    for (let i = 6; i <= head.length; i++) ws.getColumn(i).width = 11
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
