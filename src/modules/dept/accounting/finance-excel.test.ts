import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildFinanceExcel, financeExcelFilename } from './finance-excel'
import type { FinanceExcelInput } from './finance-excel'

const input = (): FinanceExcelInput => ({
  today: '2026-09-11',
  report: {
    funnel: [
      { currency: 'VND', committed: 1000, confirmed: 800, received: 500, invoiced: 300, paid: 100, unconfirmed: 200, in_flight: 300, awaiting_invoice: 200, unpaid: 200 }, // prettier-ignore
      { currency: 'USD', committed: 50, confirmed: 0, received: 0, invoiced: 0, paid: 0, unconfirmed: 50, in_flight: 0, awaiting_invoice: 0, unpaid: 0 }, // prettier-ignore
    ],
    suppliers: [
      {
        supplier_id: 's1',
        supplier_name: 'NCC A',
        payment_terms: '30 ngày',
        totals: [{ currency: 'VND', incurred: 800, paid: 100, balance: 700 }],
        last_receipt_at: null,
        missing_price_count: 0,
      },
    ],
    by_month: [{ month: '2026-09', currency: 'VND', committed: 1000, confirmed: 800 }],
    by_group: [
      { key: 'Nhôm', label: 'Nhôm', currency: 'VND', amount: 700, share: 70, cumulative: 70, line_count: 4, material_count: 3 },
      { key: 'Sơn', label: 'Sơn', currency: 'VND', amount: 300, share: 30, cumulative: 100, line_count: 2, material_count: 1 },
    ],
    by_supplier_spend: [
      { key: 's1', label: 'NCC A', currency: 'VND', amount: 1000, share: 100, cumulative: 100, line_count: 6, material_count: 4 },
    ],
    single_source: [
      { material_id: 'm1', code: 'MA-1', name: 'Nhôm hộp', supplier_count: 1, supplier_names: ['NCC A'], currency: 'VND', amount: 700 },
    ],
    bought_material_count: 4,
    pareto_supplier: { count: 1, of: 1 },
    pareto_group: { count: 1, of: 2 },
    gaps: [{ label: 'Phân tích giao hàng', detail: '59/68 đơn mua CHƯA có hạn giao.' }],
    measured_at: '2026-09-11T00:00:00Z',
  },
  lsx: [
    {
      currency: 'VND',
      rows: [
        { lsx_id: 'l1', code: 'LSX-01', status: 'approved', customer_name: 'KH A', currency: 'VND', po_count: 2, committed: 1000, confirmed: 100, draft: 900, received: 0, invoiced: 0, not_received: 1000, awaiting_invoice: 0, line_count: 3, issue_count: 1, revenue: null }, // prettier-ignore
      ],
    },
  ],
  aging: {
    rows: [
      {
        supplier_id: 's1',
        supplier_name: 'NCC A',
        currency: 'USD',
        buckets: { chua_den_han: 0, qua_1_30: 100, qua_31_60: 0, qua_61_90: 0, qua_90: 0, chua_co_han: 0 }, // prettier-ignore
        total: 100,
        total_base: null,
        invoice_count: 1,
        worst_days: 12,
      },
    ],
    totals: [
      { currency: 'USD', buckets: { chua_den_han: 0, qua_1_30: 100, qua_31_60: 0, qua_61_90: 0, qua_90: 0, chua_co_han: 0 }, total: 100 }, // prettier-ignore
    ],
    missing_due: 2,
    missing_fx: [{ currency: 'USD', count: 1 }],
    today: '2026-09-11',
  },
})

async function open(): Promise<ExcelJS.Workbook> {
  const buf = await buildFinanceExcel(input())
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

const textOf = (ws: ExcelJS.Worksheet): string => {
  let out = ''
  ws.eachRow((r) => r.eachCell((c) => (out += `${c.text}\n`)))
  return out
}

describe('buildFinanceExcel', () => {
  it('ra đủ năm sheet, đúng tên', async () => {
    const wb = await open()
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Phễu dòng tiền',
      'Theo lệnh SX',
      'Theo NCC',
      'Tuổi nợ',
      'Phân tích chi',
    ])
  })

  /**
   * Người nhận file cần thấy CẢ HAI: tổng để lập kế hoạch, phần nháp để biết
   * bao nhiêu trong đó còn có thể thay đổi. Con số 900 phải nằm TRONG 1000.
   */
  it('đơn NHÁP vẫn tính vào cam kết và có CỘT RIÊNG', async () => {
    const ws = (await open()).getWorksheet('Theo lệnh SX')!
    const t = textOf(ws)
    expect(t).toContain('Trong đó NHÁP')
    expect(t).toContain('nằm TRONG cột "Đã cam kết", không cộng thêm')
    // Hàng dữ liệu: cam kết 1000, trong đó nháp 900.
    const row = ws.getRow(ws.rowCount)
    expect(row.getCell(5).value).toBe(1000)
    expect(row.getCell(6).value).toBe(900)
  })

  it('tiền là Ô SỐ thật, không phải chuỗi — để Excel SUM được', async () => {
    const ws = (await open()).getWorksheet('Theo lệnh SX')!
    const row = ws.getRow(ws.rowCount)
    expect(typeof row.getCell(5).value).toBe('number')
    expect(row.getCell(5).numFmt).toBeTruthy()
  })

  it('hai mốc đầu của phễu ghi rõ là ƯỚC TÍNH', async () => {
    const t = textOf((await open()).getWorksheet('Phễu dòng tiền')!)
    expect(t).toContain('ƯỚC TÍNH')
    expect(t).toContain('Ghi sổ được')
    expect(t).toContain('Đơn NHÁP VẪN được tính')
  })

  it('mỗi tiền tệ một CỘT riêng ở phễu — không cộng chéo', async () => {
    const ws = (await open()).getWorksheet('Phễu dòng tiền')!
    const t = textOf(ws)
    expect(t).toContain('VND')
    expect(t).toContain('USD')
    // 1000 (VND) và 50 (USD) đứng ở hai ô khác nhau, không có ô nào là 1050.
    expect(t).not.toContain('1050')
  })

  /**
   * Một khoản 100 USD hiện thành "0" ở cột quy VND đọc ra là "không nợ gì".
   * Thiếu tỷ giá thì ô phải TRỐNG THẬT.
   */
  it('thiếu tỷ giá thì ô Quy VND để TRỐNG, không phải 0', async () => {
    const ws = (await open()).getWorksheet('Tuổi nợ')!
    const row = ws.getRow(ws.rowCount)
    // cột: NCC(1) TT(2) SốHĐ(3) 6 rổ(4..9) Cộng(10) QuyVND(11) Quáhạn(12)
    expect(row.getCell(10).value).toBe(100)
    expect(row.getCell(11).value == null).toBe(true)
    expect(textOf(ws)).toContain('để TRỐNG, không phải 0')
  })

  it('cảnh báo thiếu hạn và thiếu tỷ giá in ngay đầu sheet tuổi nợ', async () => {
    const t = textOf((await open()).getWorksheet('Tuổi nợ')!)
    expect(t).toContain('2 hoá đơn CHƯA khai hạn')
    expect(t).toContain('1 HĐ USD')
  })

  it('sheet theo NCC nói rõ là ước tính, không phải công nợ kế toán', async () => {
    const t = textOf((await open()).getWorksheet('Theo NCC')!)
    expect(t).toContain('ƯỚC TÍNH')
    expect(t).toContain('Đừng ghi sổ theo bảng này')
  })

  it('sheet phân tích chi có luỹ kế và rủi ro một nguồn', async () => {
    const t = textOf((await open()).getWorksheet('Phân tích chi')!)
    expect(t).toContain('Luỹ kế %')
    expect(t).toContain('nhóm đầu đã chiếm 80% tiền mua')
    expect(t).toContain('RỦI RO MỘT NGUỒN CUNG')
    expect(t).toContain('1/4 mã đã mua chỉ có ĐÚNG MỘT nhà cung cấp')
  })

  it('sheet phân tích chi nói ra thứ ĐANG CHẶN phân tích sâu hơn', async () => {
    const t = textOf((await open()).getWorksheet('Phân tích chi')!)
    expect(t).toContain('Phân tích giao hàng')
    expect(t).toContain('CHƯA có hạn giao')
    expect(t).toContain('GỒM CẢ đơn nháp')
  })

  it('tên tệp mang ngày kiểu Việt', () => {
    expect(financeExcelFilename('2026-09-11')).toBe(
      'Bao cao tai chinh mua hang 11-09-2026.xlsx',
    )
  })
})
