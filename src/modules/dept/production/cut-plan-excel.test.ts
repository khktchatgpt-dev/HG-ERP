import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildCutPlanExcel, cutPlanExcelFilename } from './cut-plan-excel'
import { planCut } from '@/lib/cut-plan/optimize'
import type { CutPlanDoc } from '@/lib/cut-plan/types'

const doc: CutPlanDoc = {
  title: 'Ghế Chelsea đợt 1',
  item: 'S0005',
  spec: 'Nhôm hộp 20×40×1,2',
  stock_length_mm: 6000,
  lines: [
    { key: 1, part_name: 'Chân sau', length_mm: 1390, qty: 8, note: '' },
    { key: 2, part_name: 'Chân trước', length_mm: 390, qty: 8, note: '' },
    { key: 3, part_name: '', length_mm: '', qty: '', note: '' },
  ],
}

describe('buildCutPlanExcel', () => {
  it('hai sheet, sơ đồ cắt ghi cùng câu với màn hình, số là số thật', async () => {
    const plan = planCut(doc)
    const buf = await buildCutPlanExcel(doc, plan)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Quy cắt', 'Chi tiết nhập'])

    const ws = wb.getWorksheet('Quy cắt')!
    expect(String(ws.getCell('A1').value)).toBe('QUY CẮT PHÔI — Ghế Chelsea đợt 1')
    expect(String(ws.getCell('A2').value)).toContain('Mã hàng: S0005')
    expect(String(ws.getCell('A2').value)).toContain('Quy cách: Nhôm hộp 20×40×1,2')
    expect(String(ws.getCell('A3').value)).toBe(
      `Tổng: ${plan.result.bars} cây · ${plan.result.pieces_total} chi tiết · hao hụt ${plan.result.waste_pct}%`,
    )

    const texts: string[] = []
    const nums: number[] = []
    ws.eachRow((row) =>
      row.eachCell((c) => {
        if (typeof c.value === 'string') texts.push(c.value)
        if (typeof c.value === 'number') nums.push(c.value)
      }),
    )
    expect(texts.some((t) => /\d+ × 1390 \(Chân sau\)/.test(t))).toBe(true)
    expect(
      nums.filter((n) => plan.result.patterns.some((p) => p.bars === n)).length,
    ).toBeGreaterThan(0)

    const wi = wb.getWorksheet('Chi tiết nhập')!
    expect(wi.rowCount).toBe(3) // dòng trống hoàn toàn không ghi
    expect(wi.getCell('C2').value).toBe(1390)
  })

  it('dòng bị bỏ vì thiếu số liệu được ghi thành cảnh báo, không rơi im lặng', async () => {
    const d: CutPlanDoc = {
      ...doc,
      lines: [
        ...doc.lines,
        { key: 4, part_name: 'Thiếu SL', length_mm: 500, qty: '', note: '' },
        { key: 5, part_name: 'Quá dài', length_mm: 6500, qty: 1, note: '' },
      ],
    }
    const plan = planCut(d)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildCutPlanExcel(d, plan)) as unknown as ArrayBuffer)
    const texts: string[] = []
    wb.getWorksheet('Quy cắt')!.eachRow((row) =>
      row.eachCell((c) => typeof c.value === 'string' && texts.push(c.value)),
    )
    expect(texts.some((t) => /vượt chiều dài cây/.test(t))).toBe(true)
    // "Thiếu SL" là dòng thứ 4 trong lưới (dòng trống hoàn toàn vẫn tính số thứ tự).
    expect(texts.some((t) => /1 dòng chưa tính.*dòng 4 \(thiếu số lượng\)/.test(t))).toBe(
      true,
    )
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
