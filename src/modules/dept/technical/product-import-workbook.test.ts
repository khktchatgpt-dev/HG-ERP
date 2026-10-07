import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  IMPORT_COLUMNS,
  IMPORT_SHEET,
  planImport,
  type ExistingProduct,
  type ImportLookups,
} from '@/lib/product-import'
import {
  ImportFileError,
  buildProductWorkbook,
  fillWritten,
  readImportRows,
} from './product-import-workbook'
import {
  PACKING_COLUMNS,
  PACKING_SHEET,
  planPacking,
  type OptionData,
} from '@/lib/product-packing-import'

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
  it('4 sheet, hàng nhóm / tiêu đề / ghi chú, dữ liệu từ hàng 4, cột phiên bản ẩn', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(
      (await buildProductWorkbook([SOFA], ['LAURA'])) as unknown as ArrayBuffer,
    )
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Sản phẩm',
      'Đóng gói',
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

describe('ô hai tab Hồ sơ + Thông số + sheet Đóng gói', () => {
  const FULL: ExistingProduct = {
    ...SOFA,
    category: 'sofa',
    owner_id: 'u-old',
    bom_status: 'drawing',
    is_active: true,
    created_by: 'u-viet',
    created_at: '2026-08-01T03:00:00Z',
    packing: { pack_unit_label: 'ctn', cbm: 0.512 },
  }
  const LK: ImportLookups = {
    categories: [{ code: 'sofa', label: 'Sofa' }],
    users: [
      { id: 'u-viet', name: 'Lê Văn Việt', active: true },
      { id: 'u-old', name: 'Trần Cũ', active: false },
    ],
  }
  const OPTS: OptionData[] = [
    {
      option_no: 1,
      label: 'Hàng KD',
      is_default: true,
      cartons_per_set: 2,
      loading_40hc: 120,
      note: null,
      packages: [
        { package_label: 'Khung', qty: 1, carton_l_mm: 2050, carton_w_mm: 850, carton_h_mm: 400, net_weight_kg: 20, gross_weight_kg: 24 }, // prettier-ignore
        { package_label: 'Nệm', qty: 2, carton_l_mm: 900, carton_w_mm: 600, carton_h_mm: 300, net_weight_kg: 3.5, gross_weight_kg: 4 }, // prettier-ignore
      ],
    },
  ]
  const refs = [{ id: SOFA.id, code: SOFA.code, locked_at: null }]

  it('xuất → đọc lại: Danh mục, người phụ trách đã nghỉ, trạng thái BOM, CBM đều "Không đổi"', async () => {
    const buf = await buildProductWorkbook([FULL], ['LAURA'], new Map(), new Map(), LK)
    const r = await readImportRows(buf)
    expect(r.rows[0].cells).toMatchObject({ category: 'Sofa', owner: 'Trần Cũ', bom_status: 'Đang vẽ', is_active: 'có', created_by: 'Lê Văn Việt', created_at: '01/08/2026' }) // prettier-ignore
    const p = planImport(r.rows, [FULL], LK)
    expect(p.rows[0].changes).toEqual([])
    expect(p.rows[0].action).toBe('same')
  })

  it('sheet Đóng gói xuất → đọc lại = "Không đổi"; sửa một kiện → thay trọn bộ', async () => {
    const old = new Map([[SOFA.id, OPTS]])
    const buf = await buildProductWorkbook([SOFA], ['LAURA'], new Map(), old)
    const r = await readImportRows(buf)
    expect(r.packingRows).toHaveLength(2)
    const same = planPacking(r.packingRows, refs, old)
    expect(same.counts).toMatchObject({ products: 1, same: 1, replace: 0, error: 0 })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(PACKING_SHEET)!
    const qtyCol = PACKING_COLUMNS.findIndex((c) => c.key === 'qty') + 1
    ws.getCell(5, qtyCol).value = 3
    const r2 = await readImportRows(Buffer.from(await wb.xlsx.writeBuffer()))
    const k = planPacking(r2.packingRows, refs, old)
    expect(k.items[0].action).toBe('replace')
    expect(k.items[0].options[0].packages[1].qty).toBe(3)
    expect(k.items[0].options[0].packages[0]).toEqual(OPTS[0].packages[0])
  })
})
