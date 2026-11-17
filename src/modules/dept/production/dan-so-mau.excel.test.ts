import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { docDan, type MauTo } from '@/lib/dan-so'
import { buildMauExcel } from './dan-so-mau.excel'

describe('buildMauExcel', () => {
  it('tờ mẫu dán lại được: docDan đọc ra đúng dòng, cột ngày và số đã có', async () => {
    const to: MauTo = {
      ten: 'CH0221HG-AL',
      ma: 'CH0221HG-AL',
      cot: ['2026-11-16', '2026-11-17'],
      dong: [
        { cum: 'CỤM CHÂN', ten: 'Chân trước', ct_sp: 2, can: 200, o: { '2026-11-16': 30 } },
        { cum: '', ten: 'Thanh ngang', ct_sp: 1, can: 100, o: {} },
      ],
    }
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildMauExcel([to])) as never)
    const ws = wb.worksheets[0]
    expect(ws.name).toBe('CH0221HG-AL')
    const tsv: string[] = []
    ws.eachRow((r) => {
      const v = (r.values as unknown[]).slice(1).map((x) => (x == null ? '' : String(x)))
      tsv.push(v.join('\t'))
    })
    const d = docDan(tsv.join('\n'), 2026)
    expect(d.cot.map((c) => c.iso)).toEqual(['2026-11-16', '2026-11-17'])
    // Dòng chưa có số nào thì bỏ qua (chỉ dòng có số mới vào sổ).
    expect(d.dong.map((r) => r.ten)).toEqual(['Chân trước'])
    expect(d.dong[0].cum).toBe('CỤM CHÂN')
    expect(d.dong[0].o).toEqual({ '2026-11-16': 30 })
    expect(d.dong[0].ct_sp).toBe(2)
    expect(d.dong[0].ma_sp).toBe('CH0221HG-AL')
  })
})
