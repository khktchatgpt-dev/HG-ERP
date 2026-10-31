import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { apLedgerExcelFilename, buildApLedgerExcel } from './ap-ledger-excel'
import type { apLedgerService } from './ap-ledger.service'

type Book = Awaited<ReturnType<typeof apLedgerService.fullBook>>

const book = (over: Partial<Book> = {}): Book => ({
  basis: 'invoice',
  invoice_count: 2,
  payment_count: 1,
  prepay_count: 0,
  unpriced_total: 0,
  month: '2026-09',
  from: '2026-09-01',
  to: '2026-09-30',
  rows: [
    { supplier_id: 's1', supplier_name: 'NCC A', currency: 'VND', opening: 1_000_000, increase: 500_000, returned: 0, decrease: 200_000, closing: 1_300_000, entry_count: 2, terms: null, terms_distinct: 0, prepay: null, unpriced: 0, closing_base: 1_300_000 }, // prettier-ignore
    { supplier_id: 's2', supplier_name: 'NCC B', currency: 'USD', opening: 0, increase: 400, returned: 0, decrease: 0, closing: 400, closing_base: null, entry_count: 1, terms: null, terms_distinct: 0, prepay: null, unpriced: 0 }, // prettier-ignore
  ],
  totals: [
    { currency: 'VND', opening: 1_000_000, increase: 500_000, returned: 0, decrease: 200_000, closing: 1_300_000, supplier_count: 1, closing_base: 1_300_000 }, // prettier-ignore
    { currency: 'USD', opening: 0, increase: 400, returned: 0, decrease: 0, closing: 400, supplier_count: 1, closing_base: null }, // prettier-ignore
  ],
  closing_base_total: null,
  missing_fx: ['USD'],
  off_book: [{ currency: 'VND', amount: 2_400_000, line_count: 3 }],
  off_book_suppliers: 1,
  months: [{ month: '2026-09', entry_count: 3 }],
  detail: null,
  gaps: [
    { label: 'Có khoản ngoài sổ', detail: 'Hàng đã về chưa có hoá đơn.', banner: true },
    { label: 'Chi chưa gắn hoá đơn', detail: 'Sổ chi mới gắn đơn mua.' },
  ],
  details: [
    {
      supplier_id: 's1',
      supplier_name: 'NCC A',
      currency: 'VND',
      opening: 1_000_000,
      lines: [
        { supplier_id: 's1', supplier_name: 'NCC A', currency: 'VND', date: '2026-09-05', kind: 'invoice', doc_no: 'HD-001', amount: 500_000, running: 1_500_000 }, // prettier-ignore
        { supplier_id: 's1', supplier_name: 'NCC A', currency: 'VND', date: '2026-09-20', kind: 'payment', doc_no: 'UNC-88', amount: 200_000, running: 1_300_000 }, // prettier-ignore
      ],
    },
    {
      supplier_id: 's2',
      supplier_name: 'NCC B',
      currency: 'USD',
      opening: 0,
      lines: [
        { supplier_id: 's2', supplier_name: 'NCC B', currency: 'USD', date: '2026-09-09', kind: 'invoice', doc_no: 'INV-7', amount: 400, running: 400 }, // prettier-ignore
      ],
    },
  ],
  ...over,
})

async function open(over: Partial<Book> = {}): Promise<ExcelJS.Workbook> {
  const buf = await buildApLedgerExcel(book(over))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

const textOf = (ws: ExcelJS.Worksheet): string => {
  let out = ''
  ws.eachRow((r) => r.eachCell((c) => (out += `${c.text}\n`)))
  return out
}

describe('buildApLedgerExcel', () => {
  it('ra hai sheet, đúng tên', async () => {
    const wb = await open()
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Sổ tổng hợp', 'Sổ chi tiết'])
  })

  it('sổ tổng hợp nói rõ phương trình kỳ và nguồn phát sinh', async () => {
    const t = textOf((await open()).getWorksheet('Sổ tổng hợp')!)
    expect(t).toContain(
      'Dư đầu kỳ + Phát sinh tăng − Trả hàng · đảo phiếu − Đã thanh toán = Dư cuối kỳ',
    )
    expect(t).toContain('KHÔNG phải phiếu nhập kho')
  })

  /** Tiền phải SUM được trong Excel — chuỗi thì cột tổng ở thanh trạng thái ra 0. */
  it('tiền là ô SỐ thật, có định dạng', async () => {
    const ws = (await open()).getWorksheet('Sổ tổng hợp')!
    const row = ws.getRow(ws.rowCount - 4) // dòng NCC A
    expect(row.getCell(1).value).toBe('NCC A')
    expect(row.getCell(3).value).toBe(1_000_000)
    expect(typeof row.getCell(7).value).toBe('number')
    expect(row.getCell(7).numFmt).toBeTruthy()
  })

  /** 400 USD hiện thành 0 đ ở cột quy VND đọc ra là "không nợ gì". */
  it('thiếu tỷ giá thì ô Quy VND TRỐNG THẬT, không phải 0', async () => {
    const ws = (await open()).getWorksheet('Sổ tổng hợp')!
    const t = textOf(ws)
    const usd = ws.getRow(ws.rowCount - 3)
    expect(usd.getCell(2).value).toBe('USD')
    expect(usd.getCell(7).value).toBe(400)
    expect(usd.getCell(9).value == null).toBe(true)
    expect(t).toContain('để TRỐNG, không phải 0')
  })

  /**
   * Trong Excel người ta bôi đen cả cột rồi xem SUM ở thanh trạng thái, nên
   * một dòng trộn VND với USD là đặt bẫy. Cộng theo TỪNG tiền tệ.
   */
  it('cộng theo từng tiền tệ, không có dòng trộn', async () => {
    const t = textOf((await open()).getWorksheet('Sổ tổng hợp')!)
    expect(t).toContain('Cộng VND (1 NCC)')
    expect(t).toContain('Cộng USD (1 NCC)')
    // 1.300.000 + 400 = 1300400 không được xuất hiện ở đâu.
    expect(t).not.toContain('1300400')
    // Thiếu tỷ giá USD nên KHÔNG có dòng tổng quy VND.
    expect(t).not.toContain('TỔNG DƯ CUỐI QUY VND')
  })

  it('đủ tỷ giá thì mới có dòng tổng quy VND', async () => {
    const t = textOf(
      (
        await open({
          missing_fx: [],
          closing_base_total: 11_300_000,
          totals: [
            { currency: 'VND', opening: 1_000_000, increase: 500_000, returned: 0, decrease: 200_000, closing: 1_300_000, supplier_count: 1, closing_base: 1_300_000 }, // prettier-ignore
            { currency: 'USD', opening: 0, increase: 400, returned: 0, decrease: 0, closing: 400, supplier_count: 1, closing_base: 10_000_000 }, // prettier-ignore
          ],
        })
      ).getWorksheet('Sổ tổng hợp')!,
    )
    expect(t).toContain('TỔNG DƯ CUỐI QUY VND')
  })

  it('khoản NGOÀI SỔ in ở đầu sheet, nói rõ là CHƯA nằm trong số dư', async () => {
    const t = textOf((await open()).getWorksheet('Sổ tổng hợp')!)
    expect(t).toContain('NGOÀI SỔ')
    expect(t).toContain('CHƯA nằm trong số dư')
  })

  /** Người cầm tờ giấy không có dải cảnh báo nào — file phải chép HẾT. */
  it('file lấy cả gap đã có dải cảnh báo trên màn', async () => {
    const t = textOf((await open()).getWorksheet('Sổ tổng hợp')!)
    expect(t).toContain('Có khoản ngoài sổ')
    expect(t).toContain('Chi chưa gắn hoá đơn')
  })

  it('sổ chi tiết có dòng tiêu đề NCC, dư đầu kỳ và luỹ kế từng dòng', async () => {
    const ws = (await open()).getWorksheet('Sổ chi tiết')!
    const t = textOf(ws)
    expect(t).toContain('NCC A · VND')
    expect(t).toContain('NCC B · USD')
    expect(t).toContain('Số dư đầu kỳ')
    expect(t).toContain('Số dư luỹ kế')
    expect(t).toContain('Cộng NCC A · VND')
  })

  it('ngày là Ô NGÀY thật, không phải chuỗi', async () => {
    const ws = (await open()).getWorksheet('Sổ chi tiết')!
    let found: ExcelJS.Cell | null = null
    ws.eachRow((r) => {
      if (r.getCell(2).value === 'HD-001') found = r.getCell(1)
    })
    expect(found).not.toBeNull()
    expect(found!.value).toBeInstanceOf(Date)
  })

  /** Lọc sẽ giấu mất dòng tiêu đề NCC, người đọc mất luôn ngữ cảnh. */
  it('sổ chi tiết KHÔNG bật lọc tự động', async () => {
    const ws = (await open()).getWorksheet('Sổ chi tiết')!
    expect(ws.autoFilter).toBeFalsy()
    expect(textOf(ws)).toContain('Không bật lọc tự động')
  })

  it('tên tệp mang kỳ kế toán', () => {
    expect(apLedgerExcelFilename('2026-09')).toBe(
      'So cong no phai tra TK331 09-2026.xlsx',
    )
    expect(apLedgerExcelFilename('2026-10', 'receipt')).toBe(
      'So cong no NCC theo hang nhan 10-2026.xlsx',
    )
  })

  it('sổ theo hàng nhận: tiêu đề nói rõ cơ sở, chi tiết tách Tiền hàng / VAT, trả hàng vào cột giảm', async () => {
    const wb = await open({
      basis: 'receipt',
      off_book: [],
      details: [
        {
          supplier_id: 's1',
          supplier_name: 'Hiệp Hưng',
          currency: 'VND',
          opening: 0,
          lines: [
            { supplier_id: 's1', supplier_name: 'Hiệp Hưng', currency: 'VND', date: '2026-10-09', kind: 'invoice', label: 'Phiếu nhập', doc_no: 'PNK-2026-0114', amount: 56_902_694, net: 52_687_680, vat: 4_215_014, po_code: 'PO-2026-0089', party_doc_no: '16016', lsx_code: '06/26-27 - MX', items: [{ name: 'Eru 10, xi trắng', unit: 'Con', qty: 7457, price: 350, net: 2_609_950, vat: 208_796, amount: 2_818_746 }, { name: 'Vít 4x15 đầu bằng', unit: 'Con', qty: 1000, price: 50_077.73, net: 50_077_730, vat: 4_006_218, amount: 54_083_948 }], running: 56_902_694 }, // prettier-ignore
            { supplier_id: 's1', supplier_name: 'Hiệp Hưng', currency: 'VND', date: '2026-10-12', kind: 'return', label: 'Trả hàng NCC', doc_no: 'PNK-2026-0131', amount: 1_000_000, items: [{ name: 'Eru 10, xi trắng', unit: 'Con', qty: 100, price: 10_000, net: 925_926, vat: 74_074, amount: 1_000_000 }], running: 55_902_694 }, // prettier-ignore
          ],
        },
      ],
    })
    expect(textOf(wb.getWorksheet('Sổ tổng hợp')!)).toContain('THEO HÀNG ĐÃ NHẬN')
    const ws = wb.getWorksheet('Sổ chi tiết')!
    let pnk: ExcelJS.Row | null = null
    let ret: ExcelJS.Row | null = null
    ws.eachRow((r) => {
      if (r.getCell(2).value === 'PNK-2026-0114') pnk = r
      if (r.getCell(2).value === 'PNK-2026-0131') ret = r
    })
    expect(pnk!.getCell(4).value).toBe('PO-2026-0089')
    expect(pnk!.getCell(7).value).toBe(52_687_680)
    expect(pnk!.getCell(8).value).toBe(4_215_014)
    expect(pnk!.getCell(9).value).toBe(56_902_694)
    expect(ret!.getCell(9).value == null).toBe(true)
    expect(ret!.getCell(10).value).toBe(1_000_000)

    // Sheet thứ ba đúng mẫu sổ Kế toán — chỉ có ở sổ theo hàng nhận.
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Sổ tổng hợp', 'Sổ chi tiết', 'Theo dòng hàng']) // prettier-ignore
    const items = wb.getWorksheet('Theo dòng hàng')!
    const rows: ExcelJS.Row[] = []
    items.eachRow((r) => rows.push(r))
    const eru = rows.find((r) => r.getCell(1).value === 'Eru 10, xi trắng' && r.getCell(8).value === 7457)! // prettier-ignore
    expect(eru.getCell(2).value).toBe('Con')
    expect(eru.getCell(3).value).toBe(350)
    expect(eru.getCell(4).value).toBe('PO-2026-0089 · 06/26-27 - MX')
    expect(eru.getCell(5).value).toBe('16016')
    expect(eru.getCell(6).value).toBe('PNK-2026-0114')
    expect(eru.getCell(11).value).toBe(2_818_746)
    // Trả hàng là dòng ÂM cùng sheet.
    const back = rows.find((r) => r.getCell(8).value === -100)!
    expect(back.getCell(11).value).toBe(-1_000_000)
    // Chốt tháng theo đúng chữ của sổ Kế toán, cộng cả dòng âm.
    const close = rows.find((r) =>
      String(r.getCell(1).value).startsWith('Tổng cộng T09/2026'),
    )!
    expect(close.getCell(11).value).toBe(55_902_694)
  })

  it('sổ theo hoá đơn không có sheet dòng hàng', async () => {
    const wb = await open()
    expect(wb.getWorksheet('Theo dòng hàng')).toBeUndefined()
  })
})
