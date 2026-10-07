import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  IMPORT_COLUMNS,
  IMPORT_SHEET,
  planImport,
  type ExistingProduct,
} from '@/lib/product-import'
import {
  ImportFileError,
  buildProductWorkbook,
  fillWritten,
  readImportRows,
} from './product-import-workbook'

const SOFA: ExistingProduct = {
  id: 'id-sofa',
  code: 'BN0029HG-AL',
  name: 'Imani 3 Seater Sofa',
  customer_name: 'LAURA',
  updated_at: '2026-10-03T01:42:04.794601+00:00',
  locked_at: null,
  product_type: 'BN',
  frame_material: 'AL',
  unit: 'cái',
  length_mm: 2000,
  width_mm: 800,
  height_mm: 685,
  net_weight_kg: 1.234,
  is_upholstered: true,
  assembly: 'kd',
  packing: { pack_unit_label: 'ctn' },
  tech_spec: { paint: 'RAL 9005', cushion: 'Savana Beige\nHG 01/24' },
  // Ghi chú nhiều dòng + hai dấu cách liền — dữ liệu thật có đầy (469/807 SP).
  notes: 'Nguồn: BKQC - B0003HG-AL  Bench 2.xlsx\nMã: ĐỀ XUẤT - cần duyệt',
}

const colNo = (key: string) => IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1

async function edit(buf: Buffer, f: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  f(wb.getWorksheet(IMPORT_SHEET)!)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('xuất', () => {
  it('3 sheet, hàng nhóm / tiêu đề / ghi chú, dữ liệu từ hàng 4, cột phiên bản ẩn', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(
      (await buildProductWorkbook([SOFA], ['LAURA'])) as unknown as ArrayBuffer,
    )
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Sản phẩm',
      'Danh mục',
      'Hướng dẫn',
    ])
    const ws = wb.getWorksheet('Sản phẩm')!
    expect(ws.getCell(1, 1).value).toBe('NHẬN DIỆN')
    expect(ws.getCell(2, colNo('name')).text).toContain('Tên SP (tiếng Việt)')
    expect(ws.getCell(4, 1).value).toBe('BN0029HG-AL')
    expect(ws.getCell(4, colNo('type')).value).toBe('BN — Băng ghế / sofa bank')
    expect(ws.getCell(4, colNo('net_weight_kg')).value).toBe(1.234)
    expect(ws.getCell(4, colNo('is_upholstered')).value).toBe('có')
    expect(ws.getCell(4, colNo('assembly')).value).toBe('Tháo rời (KD)')
    expect(ws.getCell(4, colNo('paint')).value).toBe('RAL 9005')
    expect(ws.getColumn(colNo('version')).hidden).toBe(true)
    expect(ws.getCell(4, colNo('type')).dataValidation?.formulae?.[0]).toContain(
      'Danh mục',
    )
  })
})

describe('vòng xuất → sửa → đọc → soi', () => {
  it('xuất rồi đọc lại y nguyên = "Không đổi" (không có ô nào bị đọc lệch)', async () => {
    const buf = await buildProductWorkbook([SOFA], ['LAURA'])
    const r = await readImportRows(buf)
    expect(r.rows).toHaveLength(1)
    const p = planImport(r.rows, [SOFA])
    expect(p.rows[0].changes).toEqual([])
    expect(p.rows[0].action).toBe('same')
  })

  it('sửa ô + thêm dòng mới ở cuối → 1 cập nhật, 1 thêm mới', async () => {
    const buf = await edit(await buildProductWorkbook([SOFA], ['LAURA']), (ws) => {
      ws.getCell(4, colNo('qty_per_carton')).value = 2
      ws.getCell(4, colNo('paint')).value = 'RAL 7016'
      ws.getCell(5, colNo('name')).value = 'Ghế bar Imani'
      ws.getCell(5, colNo('type')).value = 'CH — Ghế'
      ws.getCell(5, colNo('material')).value = 'AL — Nhôm'
    })
    const r = await readImportRows(buf)
    const p = planImport(r.rows, [SOFA])
    expect(p.rows.map((x) => x.action)).toEqual(['update', 'create'])
    expect(p.rows[0].changes.map((c) => c.key)).toEqual(['qty_per_carton', 'paint'])
    expect(p.rows[1].code).toBe('CH0001HG-AL')
  })

  it('người dùng xoá bớt cột → cột vắng không bị đụng', async () => {
    const buf = await edit(await buildProductWorkbook([SOFA], ['LAURA']), (ws) => {
      ws.spliceColumns(colNo('paint'), 1)
      ws.getCell(4, colNo('notes') - 1).value = 'ghi chú mới'
    })
    const r = await readImportRows(buf)
    expect(r.columns).not.toContain('paint')
    const p = planImport(r.rows, [SOFA])
    expect(p.rows[0].changes.map((c) => c.key)).toEqual(['notes'])
  })
})

describe('file sai', () => {
  it('không theo mẫu → lỗi nói phải có cột nào', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Sheet1').getCell('A1').value = 'Tên'
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    await expect(readImportRows(buf)).rejects.toThrow(ImportFileError)
    await expect(readImportRows(buf)).rejects.toThrow(/Mã nội bộ/)
  })
  it('không phải xlsx → lỗi dễ hiểu', async () => {
    await expect(readImportRows(Buffer.from('không phải excel'))).rejects.toThrow(
      /\.xlsx/,
    )
  })
})

describe('ghi mã + phiên bản trở lại', () => {
  it('điền mã + phiên bản mới vào đúng dòng; đọc lại thành "Không đổi"', async () => {
    const buf = await edit(await buildProductWorkbook([], []), (ws) => {
      ws.getCell(4, colNo('name')).value = 'Bàn A'
      ws.getCell(4, colNo('type')).value = 'TB'
      ws.getCell(4, colNo('material')).value = 'AL'
    })
    const out = await fillWritten(buf, [{ row: 4, code: 'TB0301HG-AL', version: '2026-10-07T03:00:00Z' }]) // prettier-ignore
    const r = await readImportRows(out)
    expect(r.rows[0].cells.code).toBe('TB0301HG-AL')
    expect(r.rows[0].cells.version).toBe('2026-10-07T03:00:00Z')
    const created: ExistingProduct = { id: 'x', code: 'TB0301HG-AL', name: 'Bàn A', customer_name: null, updated_at: '2026-10-07T03:00:00Z', locked_at: null, packing: {}, tech_spec: {}, product_type: 'TB', frame_material: 'AL', unit: 'cái' } // prettier-ignore
    expect(planImport(r.rows, [created]).rows[0].action).toBe('same')
  })
})
