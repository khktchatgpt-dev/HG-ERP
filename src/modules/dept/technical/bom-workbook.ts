import ExcelJS from 'exceljs'
import type { SheetGrid } from '@/lib/bom-grid'

/**
 * Workbook .xlsx → lưới ô thô.
 *
 * Tách khỏi `bom-ai.service.ts` để test được: service kéo theo repo/db nên
 * không nạp trong vitest, mà đây lại đúng chỗ dễ sai nhất — ô công thức, rich
 * text và ô gộp mỗi loại trả về một hình dạng khác nhau.
 */

/** Ô Excel có thể là công thức / rich text — rút về giá trị hiển thị. */
export function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null
  if (typeof v === 'object') {
    if (v instanceof Date) return v
    const o = v as unknown as Record<string, unknown>
    // Ô công thức: lấy KẾT QUẢ, không lấy chuỗi công thức.
    if ('result' in o) return o.result
    if ('richText' in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join('')
    if ('text' in o) return o.text
    return null
  }
  return v
}

/**
 * Ô GỘP: exceljs chỉ giữ giá trị ở ô chủ, các ô còn lại trong vùng gộp trả về
 * null. Giữ nguyên như vậy là ĐÚNG cho việc đọc BOM — tiêu đề khối thường gộp
 * ngang cả dòng, và giá trị nằm ở ô trái nhất, đúng chỗ mô hình cần đọc.
 */
export async function readWorkbookGrid(buffer: Buffer): Promise<SheetGrid[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  return wb.worksheets.map((ws) => {
    const rows: unknown[][] = []
    for (let r = 1; r <= ws.rowCount; r++) {
      const row: unknown[] = []
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        row[col - 1] = cellValue(cell.value)
      })
      rows.push(row)
    }
    return { name: ws.name, rows }
  })
}
