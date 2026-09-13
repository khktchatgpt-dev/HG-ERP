import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildCutPlanExcel, cutPlanExcelFilename, sheetName } from './cut-plan-excel'
import { planCut } from '@/lib/cut-plan/optimize'
import type { CutPlanDoc } from '@/lib/cut-plan/types'

const doc: CutPlanDoc = {
  title: 'Ghế Chelsea đợt 1',
  item: 'S0005',
  stock_length_mm: 6000,
  stock_by_spec: {},
  lines: [
    { key: 1, part_name: 'Chân sau', length_mm: 1390, qty: 8, spec: '', note: '' },
    { key: 2, part_name: 'Chân trước', length_mm: 390, qty: 8, spec: '', note: '' },
    { key: 3, part_name: '', length_mm: '', qty: '', spec: '', note: '' },
  ],
}

async function load(d: CutPlanDoc) {
  const plan = planCut(d)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await buildCutPlanExcel(d, plan)) as unknown as ArrayBuffer)
  const textsOf = (name: string) => {
    const out: string[] = []
    wb.getWorksheet(name)!.eachRow((row) =>
      row.eachCell((c) => typeof c.value === 'string' && out.push(c.value)),
    )
    return out
  }
  return { plan, wb, textsOf }
}

describe('buildCutPlanExcel', () => {
  it('một quy cách: sheet "Quy cắt" + "Chi tiết nhập", số là số thật', async () => {
    const { plan, wb, textsOf } = await load(doc)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Quy cắt', 'Chi tiết nhập'])
    const r = plan.groups[0].result

    const ws = wb.getWorksheet('Quy cắt')!
    expect(String(ws.getCell('A1').value)).toContain('QUY CẮT PHÔI — Ghế Chelsea đợt 1')
    expect(String(ws.getCell('A2').value)).toContain('Mã hàng: S0005')
    expect(String(ws.getCell('A2').value)).toContain('Cây tiêu chuẩn 6000 mm')
    expect(String(ws.getCell('A3').value)).toBe(
      `Tổng: ${r.bars} cây · ${r.pieces_total} chi tiết · hao hụt ${r.waste_pct}%`,
    )
    expect(textsOf('Quy cắt').some((t) => /\d+ × 1390 \(Chân sau\)/.test(t))).toBe(true)
    const nums: number[] = []
    ws.eachRow((row) =>
      row.eachCell((c) => typeof c.value === 'number' && nums.push(c.value)),
    )
    expect(
      nums.filter((n) => r.patterns.some((p) => p.bars === n)).length,
    ).toBeGreaterThan(0)

    const wi = wb.getWorksheet('Chi tiết nhập')!
    expect(wi.rowCount).toBe(3) // dòng trống hoàn toàn không ghi
    expect(wi.getCell('C2').value).toBe(1390)
    expect(String(wi.getCell('E1').value)).toBe('Quy cách')
  })

  it('nhiều quy cách: sheet Tổng hợp + một sheet mỗi quy cách, cây riêng', async () => {
    const d: CutPlanDoc = {
      ...doc,
      stock_by_spec: { 'sắt hộp 25×25': 12000 },
      lines: [
        {
          key: 1,
          part_name: 'Chân',
          length_mm: 1390,
          qty: 8,
          spec: 'Nhôm hộp 20×40',
          note: '',
        },
        {
          key: 2,
          part_name: 'Giằng',
          length_mm: 2950,
          qty: 4,
          spec: 'Sắt hộp 25×25',
          note: '',
        },
        { key: 3, part_name: 'Tay', length_mm: 1000, qty: 2, spec: '', note: '' },
      ],
    }
    const { plan, wb, textsOf } = await load(d)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tổng hợp',
      'Nhôm hộp 20×40',
      'Sắt hộp 25×25',
      'Chưa ghi quy cách',
      'Chi tiết nhập',
    ])
    const tong = textsOf('Tổng hợp')
    expect(tong.some((t) => /Tổng: \d+ cây · 3 quy cách/.test(t))).toBe(true)
    expect(String(wb.getWorksheet('Sắt hộp 25×25')!.getCell('A2').value)).toContain(
      'Cây tiêu chuẩn 12000 mm',
    )
    // Dòng tổng hợp của sắt: số cây khớp kết quả nhóm.
    const sat = plan.groups.find((g) => g.key === 'sắt hộp 25×25')!
    let found = false
    wb.getWorksheet('Tổng hợp')!.eachRow((row) => {
      if (row.getCell(1).value === 'Sắt hộp 25×25') {
        expect(row.getCell(2).value).toBe(12000)
        expect(row.getCell(3).value).toBe(sat.result.bars)
        found = true
      }
    })
    expect(found).toBe(true)
  })

  it('dòng bị bỏ vì thiếu số liệu được ghi thành cảnh báo, không rơi im lặng', async () => {
    const d: CutPlanDoc = {
      ...doc,
      lines: [
        ...doc.lines,
        { key: 4, part_name: 'Thiếu SL', length_mm: 500, qty: '', spec: '', note: '' },
        { key: 5, part_name: 'Quá dài', length_mm: 6500, qty: 1, spec: '', note: '' },
      ],
    }
    const { textsOf } = await load(d)
    const texts = textsOf('Quy cắt')
    expect(texts.some((t) => /vượt chiều dài cây/.test(t))).toBe(true)
    // "Thiếu SL" là dòng thứ 4 trong lưới (dòng trống hoàn toàn vẫn tính số thứ tự).
    expect(texts.some((t) => /1 dòng chưa tính.*dòng 4 \(thiếu số lượng\)/.test(t))).toBe(
      true,
    )
  })

  it('tên sheet: bỏ ký tự cấm, cắt 31 ký tự, không trùng', () => {
    const used = new Set<string>()
    expect(sheetName('Nhôm hộp 20×40 [dày 1,2] / mỏng', used)).toBe(
      'Nhôm hộp 20×40 dày 1,2 mỏng',
    )
    expect(sheetName('Nhôm hộp 20×40 [dày 1,2] / mỏng', used)).toBe(
      'Nhôm hộp 20×40 dày 1,2 mỏng (2)',
    )
    expect(sheetName('a'.repeat(40), used)).toHaveLength(31)
    expect(sheetName('', used)).toBe('Quy cắt')
  })

  it('tên file: slug không dấu + ngày giờ', () => {
    expect(cutPlanExcelFilename(doc)).toMatch(
      /^quy-cat_ghe-chelsea-dot-1_\d{8}-\d{4}\.xlsx$/,
    )
    expect(cutPlanExcelFilename({ title: '', item: '' })).toMatch(
      /^quy-cat_phoi_\d{8}-\d{4}\.xlsx$/,
    )
  })
})
