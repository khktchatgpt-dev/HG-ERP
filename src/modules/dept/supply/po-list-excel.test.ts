import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildPoListExcel, describeFilter, type PoListRow } from './po-list-excel'

const don = (over: Partial<PoListRow> = {}): PoListRow => ({
  code: 'PO-2026-0001',
  supplier_name: 'Nhôm Tiến Đạt',
  lsx_code: '02/26-27',
  order_code: '17984 HG-MX',
  status: 'draft',
  created_at: '2026-09-03T04:00:00+00:00',
  expected_at: '2026-09-20',
  assignee_name: 'Đặng Thị Thanh Nga',
  currency: 'VND',
  total: 1_000_000,
  lines_done: 2,
  lines_total: 5,
  ...over,
})

async function doc(rows: PoListRow[]) {
  const buf = await buildPoListExcel({ filterText: 'thử', rows })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  const hang = (n: number) => (ws.getRow(n).values as unknown[]).slice(1)
  return { ws, hang, text: JSON.stringify(ws.getSheetValues()) }
}

describe('buildPoListExcel', () => {
  it('in nhãn trạng thái tiếng Việt, không phải mã trong DB', async () => {
    const { text } = await doc([don({ status: 'draft' })])
    expect(text).toContain('Nháp')
    expect(text).not.toContain('"draft"')
  })

  it('ĐƠN HUỶ vẫn in ra nhưng KHÔNG cộng vào tổng', async () => {
    /*
      Bỏ hẳn đơn huỷ khỏi file thì người đối chiếu tưởng đơn biến mất; cộng nó
      vào tổng thì tiền sai. Phải in mà không cộng, và nói ra ở chân bảng.
    */
    const { text } = await doc([
      don({ total: 1_000_000 }),
      don({ code: 'PO-0002', status: 'cancelled', total: 9_000_000 }),
    ])
    expect(text).toContain('PO-0002')
    expect(text).toContain('Tổng KHÔNG gồm 1 đơn đã huỷ')
    expect(text).toContain(String(1_000_000))
    expect(text).not.toContain(String(10_000_000))
  })

  it('MỖI LOẠI TIỀN một dòng tổng — không quy đổi, không gộp', async () => {
    const { text } = await doc([
      don({ currency: 'VND', total: 1_000_000 }),
      don({ code: 'PO-0002', currency: 'USD', total: 500 }),
    ])
    expect(text).toContain('· VND')
    expect(text).toContain('· USD')
  })

  it('tổng LÀM TRÒN theo loại tiền — không để rác dấu phẩy động vào ô', async () => {
    const { ws } = await doc([
      don({ currency: 'USD', total: 99_715.131 }),
      don({ code: 'PO-0002', currency: 'USD', total: 199_430.263 }),
    ])
    const so: number[] = []
    ws.eachRow((r) => {
      const v = r.getCell(11).value
      if (typeof v === 'number') so.push(v)
    })
    // 99715.131 + 199430.263 = 299145.394 (USD → 2 số lẻ)
    expect(so).toContain(299_145.39)
    for (const v of so) expect(String(v)).not.toMatch(/\d{8,}$/)
  })

  it('danh sách rỗng vẫn ra file đọc được, nói rõ chưa có tiền', async () => {
    const { text } = await doc([])
    expect(text).toContain('Cộng 0 đơn')
  })
})

describe('describeFilter — file phải tự nói nó là tập nào', () => {
  it('không lọc thì nói thẳng là toàn bộ sổ', () => {
    expect(describeFilter({}, 69)).toContain('không lọc — toàn bộ sổ')
    expect(describeFilter({}, 69)).toContain('69 đơn')
  })

  it('ghép mọi điều kiện đang áp, kể cả khoảng ngày khai một đầu', () => {
    const s = describeFilter({ trang_thai: 'draft', tu: '2026-09-01', toi: '1' }, 23)
    expect(s).toContain('23 đơn')
    expect(s).toContain('trạng thái draft')
    expect(s).toContain('lập từ 2026-09-01 đến …')
    expect(s).toContain('đơn tôi phụ trách')
  })
})
