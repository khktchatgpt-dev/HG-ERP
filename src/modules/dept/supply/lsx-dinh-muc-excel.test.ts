import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { BomNeedLine } from './lsx-bom-needs.repo'
import {
  buildDinhMucExcel,
  tenSheet,
  tongHopTheoMa,
  type DinhMucData,
} from './lsx-dinh-muc-excel'

const need = (p: Partial<BomNeedLine>): BomNeedLine => ({
  product_id: 'P1',
  product_code: 'CH0119',
  product_name: 'Ghế',
  product_qty: 300,
  bom_confirmed: true,
  material_id: 'm1',
  material_code: 'SAT0671',
  material_name: 'Vít 4x15',
  unit: 'Con',
  group_name: null,
  kind: 'NGU_KIM',
  qty_per_unit: 8,
  qty_needed: 2400,
  basis: 'đếm',
  explain: '',
  part_count: 1,
  part_names: [],
  ...p,
})

const data: DinhMucData = {
  lsx: { code: '13/26-27 - MX', customer_name: 'MX', ship_date: '2026-12-01' },
  products: [
    { id: 'P1', code: 'CH0119', name: 'Ghế', qty: 300, unit: 'cái', confirmed: true },
    { id: 'P2', code: 'TB0182', name: 'Bàn', qty: 50, unit: 'cái', confirmed: false },
    { id: 'P3', code: 'SF01', name: 'Sofa', qty: 10, unit: 'bộ', confirmed: false },
  ],
  parts: [
    {
      product_id: 'P1',
      group_code: 'PACKAGING',
      part_name: 'Thùng',
      material_code: null,
      material_name: null,
      material_note: null,
      dims: [600, 400, null],
      unit: 'cái',
      qty: 1,
    },
    {
      product_id: 'P1',
      group_code: 'NGU_KIM',
      part_name: 'Vít tay',
      material_code: 'SAT0671',
      material_name: 'Vít 4x15',
      material_note: null,
      dims: [null, null, null],
      unit: 'con',
      qty: 8,
    },
    {
      product_id: 'P2',
      group_code: 'NGU_KIM',
      part_name: 'Vít',
      material_code: 'SAT0671',
      material_name: 'Vít 4x15',
      material_note: null,
      dims: [],
      unit: 'con',
      qty: 4,
    },
  ],
  needs: {
    lines: [
      need({}),
      need({
        product_id: 'P2',
        product_code: 'TB0182',
        product_qty: 50,
        bom_confirmed: false,
        qty_per_unit: 4,
        qty_needed: 200,
      }),
    ],
    blocked: [],
    chua_ma: {
      items: [
        {
          key: 'k',
          kind: 'PACKAGING',
          name: 'Thùng',
          quy_cach: '600×400',
          aliases: [],
          unit: 'cái',
          note: null,
          bad_code: null,
          qty_total: 300,
          products: [{ product_id: 'P1', code: 'CH0119', per: 1, qty: 300 }],
        },
      ],
      frame_lines: 0,
    },
  },
}

describe('tongHopTheoMa', () => {
  it('cộng một mã qua nhiều SP và nhớ SP chưa kiểm', () => {
    const [r] = tongHopTheoMa(data.needs.lines)
    expect(r).toMatchObject({ code: 'SAT0671', total: 2600, unconfirmed: true })
    expect(r.products.map((p) => p.code)).toEqual(['CH0119', 'TB0182'])
  })
})

describe('tenSheet', () => {
  it('bỏ ký tự cấm, cắt 31, trùng thì đánh số', () => {
    const used = new Set<string>()
    expect(tenSheet('13/26 [MX]', used)).toBe('13 26 MX')
    expect(tenSheet('13/26 [mx]', used)).toBe('13 26 mx (2)')
    expect(tenSheet('a'.repeat(40), used)).toHaveLength(31)
  })
})

describe('buildDinhMucExcel', () => {
  it('Tổng hợp + Chưa gắn mã + mỗi SP một tờ; Cần là công thức', async () => {
    const buf = await buildDinhMucExcel(data, '2026-11-04')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tổng hợp',
      'Chưa gắn mã',
      'CH0119',
      'TB0182',
      'SF01',
    ])
    const all = (ws: ExcelJS.Worksheet) => {
      const out: string[] = []
      ws.eachRow((r) => out.push(JSON.stringify(r.values)))
      return out.join('\n')
    }
    const th = all(wb.getWorksheet('Tổng hợp')!)
    expect(th).toContain('2600')
    expect(th).toContain('CH0119 ×300 (8/SP) · TB0182 ×50 (4/SP) — chưa kiểm')
    expect(th).toContain('CHƯA CÓ ĐỊNH MỨC')
    expect(all(wb.getWorksheet('Chưa gắn mã')!)).toContain('600×400')

    const sp = wb.getWorksheet('CH0119')!
    const txt = all(sp)
    // Ngũ kim đứng trước bao bì (thứ tự khối của định mức).
    expect(txt.indexOf('Ngũ kim')).toBeLessThan(txt.indexOf('Bao bì'))
    expect(txt).toContain('chưa gắn mã')
    let f: ExcelJS.CellFormulaValue | null = null
    sp.eachRow((r) => {
      const v = r.getCell(10).value
      if (
        v &&
        typeof v === 'object' &&
        'formula' in v &&
        r.getCell(2).value === 'Vít tay'
      )
        f = v as ExcelJS.CellFormulaValue
    })
    expect(f).toMatchObject({ result: 2400 })
    expect(all(wb.getWorksheet('SF01')!)).toContain('CHƯA CÓ ĐỊNH MỨC')
  })
})
