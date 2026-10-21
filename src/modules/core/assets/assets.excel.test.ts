import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildTemplate, parseDate, parseImport, parseVnNumber } from './assets.excel'

const GROUPS = [
  { id: 'HAN', name: 'Máy hàn', kind: 'machine' as const, active: true },
  { id: 'DC', name: 'Dụng cụ điện cầm tay', kind: 'tool' as const, active: true },
]
const DEPTS = [{ id: 'd-han', name: 'Tổ Hàn' }]
const EMPS = [{ id: 'e-441', code: '441', active: true }]

async function fill(rows: (string | number)[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await buildTemplate(GROUPS, DEPTS)) as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  ws.spliceRows(2, 1) // bỏ dòng ví dụ
  for (const r of rows) ws.addRow(r)
  const out = await wb.xlsx.writeBuffer()
  return out as ArrayBuffer
}

describe('nhập danh sách máy từ Excel', () => {
  it('đọc dòng hợp lệ theo tiêu đề, ghép tổ + mã NV', async () => {
    const buf = await fill([
      [
        'Máy hàn MIG 350A',
        'han',
        'Jasic',
        'JS23',
        'Hàn Việt',
        'tổ hàn',
        '441',
        '15/03/2025',
        '18.500.000',
        '',
        'ghi chú',
      ],
    ])
    const { rows, missingCols } = await parseImport(buf, GROUPS, DEPTS, EMPS)
    expect(missingCols).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].input).toMatchObject({
      name: 'Máy hàn MIG 350A',
      group_id: 'HAN',
      department_id: 'd-han',
      resp_employee_id: 'e-441',
      use_date: '2025-03-15',
      cost: 18_500_000,
    })
  })

  it('bỏ dòng ví dụ của file mẫu và dòng trống', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildTemplate(GROUPS, DEPTS)) as unknown as ArrayBuffer)
    const { rows } = await parseImport(
      (await wb.xlsx.writeBuffer()) as ArrayBuffer,
      GROUPS,
      DEPTS,
      EMPS,
    )
    expect(rows).toEqual([])
  })

  it('dòng lỗi nói rõ lỗi gì', async () => {
    const buf = await fill([
      ['X', 'ZZZ', '', '', '', 'Tổ Ma', '999', '31/02/2025', 'abc', '30', ''],
    ])
    const [r] = (await parseImport(buf, GROUPS, DEPTS, EMPS)).rows
    expect(r.input).toBeNull()
    expect(r.errors.join(' | ')).toMatch(
      /Thiếu tên.*Mã nhóm "ZZZ".*Tổ "Tổ Ma".*Mã NV "999".*Ngày "31\/02\/2025".*Giá "abc".*Giờ chạy\/ngày "30"/,
    )
  })

  it('số và ngày kiểu VN', () => {
    expect(parseVnNumber('18.500.000')).toBe(18_500_000)
    expect(parseVnNumber('2,5')).toBe(2.5)
    expect(parseVnNumber('')).toBeNull()
    expect(parseVnNumber('-1')).toBeUndefined()
    expect(parseDate('1/2/2026')).toBe('2026-02-01')
    expect(parseDate('2026-02-01')).toBe('2026-02-01')
    expect(parseDate('30/02/2026')).toBeUndefined()
  })
})
