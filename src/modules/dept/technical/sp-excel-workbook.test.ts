import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { SP_HEADER_ROW, SP_FIRST_ROW, SP_SHEET, type ExistingSp } from '@/lib/sp-excel'
import { buildSpWorkbook } from './sp-excel-workbook'

const sp: ExistingSp = {
  id: 'p1',
  code: 'CH0065HG-AL',
  name: 'Ghế đan mây Rattan',
  product_type: 'CH',
  frame_material: 'AL',
  name_foreign: null,
  customer_name: 'YOTRIO',
  customer_item_code: null,
  unit: 'cái',
  length_mm: 548,
  width_mm: 565,
  height_mm: 876,
  net_weight_kg: null,
  actual_weight_kg: null,
  material: null,
  tech_spec: {},
  barcode: null,
  description_en: null,
  notes: null,
  is_active: true,
  showroom_sample: true,
  showroom_tagged_at: '2026-11-18T02:00:00Z',
  locked_at: null,
  updated_at: '2026-11-18T02:00:00Z',
  image_file_id: null,
  pk: {
    pk_qty: null,
    pk_l: null,
    pk_w: null,
    pk_h: null,
    pk_nw: null,
    pk_gw: null,
    pk_cbm: null,
    pk_hc: 1170,
  },
}

describe('file Excel SP · cột mẫu showroom (0303)', () => {
  it('có hai cột "Có mẫu showroom" / "Đã treo thẻ" với giá trị của SP', async () => {
    const buf = await buildSpWorkbook([sp], new Map(), ['YOTRIO'])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(SP_SHEET)!
    const heads: string[] = []
    ws.getRow(SP_HEADER_ROW).eachCell((c) => heads.push(String(c.value)))
    const iCo = heads.indexOf('Có mẫu showroom') + 1
    const iThe = heads.indexOf('Đã treo thẻ') + 1
    expect(iCo).toBeGreaterThan(0)
    expect(iThe).toBeGreaterThan(0)
    expect(ws.getCell(SP_FIRST_ROW, iCo).value).toBe('có')
    expect(ws.getCell(SP_FIRST_ROW, iThe).value).toBe('18/11/2026')
  })
})
