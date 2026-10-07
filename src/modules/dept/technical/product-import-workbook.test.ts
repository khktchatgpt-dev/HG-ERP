import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { IMPORT_SHEET } from '@/lib/product-import'
import {
  ImportFileError,
  buildImportTemplate,
  fillCodes,
  readImportRows,
} from './product-import-workbook'

/** Điền vài dòng vào file mẫu như người dùng làm trong Excel. */
async function fillTemplate(rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(
    (await buildImportTemplate(['MERXX', 'LAURA'])) as unknown as ArrayBuffer,
  )
  const ws = wb.getWorksheet(IMPORT_SHEET)!
  rows.forEach((cells, i) =>
    cells.forEach((v, j) => (ws.getCell(3 + i, j + 1).value = v)),
  )
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('file mẫu', () => {
  it('có 3 sheet, tiêu đề đúng thứ tự form, ô thả xuống trỏ sang Danh mục', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildImportTemplate(['MERXX'])) as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Nhập SP', 'Danh mục', 'Hướng dẫn'])
    const ws = wb.getWorksheet('Nhập SP')!
    expect(String(ws.getCell('D1').text)).toContain('Tên SP (tiếng Việt)')
    expect(ws.getCell('A3').dataValidation?.formulae?.[0]).toContain('Danh mục')
    expect(ws.getCell('A502').dataValidation?.type).toBe('list')
    expect(wb.getWorksheet('Danh mục')!.getCell('A2').value).toBe('TB — Bàn')
    expect(wb.getWorksheet('Danh mục')!.getCell('C2').value).toBe('MERXX')
  })
})

describe('đọc file đã điền', () => {
  it('đọc dòng có dữ liệu, bỏ dòng trống giữa chừng và đuôi định dạng', async () => {
    const buf = await fillTemplate([
      ['TB — Bàn', 'AL — Nhôm', null, 'Bàn ăn 180', 'Esstisch 180', 'MERXX', 'cái'],
      [],
      ['CH', 'IR', null, '  Ghế   xếp ', null, null, null],
    ])
    const r = await readImportRows(buf)
    expect(r.rows.map((x) => x.row)).toEqual([3, 5])
    expect(r.blank).toBe(1)
    expect(r.rows[1].cells).toMatchObject({ type: 'CH', name: 'Ghế xếp', unit: '' })
  })

  it('file không theo mẫu → lỗi nói ô nào sai', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Sheet1').getCell('A1').value = 'Tên'
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    await expect(readImportRows(buf)).rejects.toThrow(ImportFileError)
    await expect(readImportRows(buf)).rejects.toThrow(/D1/)
  })

  it('không phải xlsx → lỗi dễ hiểu', async () => {
    await expect(readImportRows(Buffer.from('không phải excel'))).rejects.toThrow(
      /\.xlsx/,
    )
  })
})

describe('ghi mã trở lại', () => {
  it('điền mã vào đúng ô C của đúng dòng, giữ nguyên phần còn lại', async () => {
    const buf = await fillTemplate([
      ['TB', 'AL', null, 'Bàn A'],
      ['CH', 'AL', null, 'Ghế B'],
    ])
    const out = await fillCodes(buf, [
      { row: 3, code: 'TB0301HG-AL' },
      { row: 4, code: 'CH0292HG-AL' },
    ])
    const r = await readImportRows(out)
    expect(r.rows.map((x) => [x.cells.code, x.cells.name])).toEqual([
      ['TB0301HG-AL', 'Bàn A'],
      ['CH0292HG-AL', 'Ghế B'],
    ])
  })
})
