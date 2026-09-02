import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildLsxSupplyExcel } from './lsx-supply-excel'
import type { LsxSupplyRow } from './lsx-supply.service'

/**
 * BÁO CÁO VẬT TƯ THEO LỆNH mang vào họp tuần — file này phải nói ĐÚNG tình
 * trạng, vì nó được đọc lên giữa cuộc họp và không ai mở app ra soát lại.
 *
 * Khoá ba thứ dễ trượt nhất: (1) bậc tình trạng suy đúng từ số đơn, (2) thứ tự
 * dòng khớp màn hình (việc của Cung ứng trước, rồi mới tới hạn gấp), (3) không
 * có đơn nào thì nói ra chứ không để sheet trắng.
 */

const TODAY = '2026-09-01'

const lsx = (over: Partial<LsxSupplyRow> = {}): LsxSupplyRow => ({
  id: 'l1',
  code: '01/26-27 - MX',
  customer_name: 'MERXX',
  order_codes: ['DH-01'],
  ship_date: '2026-11-29',
  materials_due_at: '2026-10-01',
  materials_received_at: null,
  priority: 0,
  products: [{ code: 'CH0282HG-IR', name: 'Ghế', qty: 100 }],
  pos: [],
  posTotal: 0,
  posUnsent: 0,
  posOpen: 0,
  posLate: 0,
  ...over,
})

const po = (
  over: Partial<LsxSupplyRow['pos'][number]> = {},
): LsxSupplyRow['pos'][number] => ({
  id: 'p1',
  code: '01/26 HG/MĐ',
  supplier_name: 'NCC A',
  status: 'ordered',
  expected_at: '2026-09-20',
  currency: 'VND',
  ordered_at: '2026-08-28',
  note: null,
  assignee_name: 'Thảo',
  shared: false,
  late: false,
  ...over,
})

async function read(rows: LsxSupplyRow[]) {
  const buf = await buildLsxSupplyExcel(rows, TODAY)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(new Uint8Array(buf) as unknown as ArrayBuffer)
  const cell = (sheet: string, r: number, c: number) =>
    wb.getWorksheet(sheet)?.getRow(r).getCell(c).value ?? null
  return { wb, cell }
}

describe('buildLsxSupplyExcel', () => {
  it('có đủ hai sheet: theo lệnh và theo đơn mua', async () => {
    const { wb } = await read([lsx()])
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Vật tư theo lệnh',
      'Tổng hợp ĐH theo LSX',
    ])
  })

  it('lệnh chưa có đơn nào → bậc "Chưa lập đơn"', async () => {
    const { wb } = await read([lsx()])
    const ws = wb.getWorksheet('Vật tư theo lệnh')!
    // Dòng dữ liệu đầu tiên nằm sau tiêu đề + khối tóm tắt + hàng tiêu đề bảng.
    const row = ws.getRow(ws.rowCount)
    expect(row.getCell(1).value).toBe('01/26-27 - MX')
    expect(row.getCell(7).value).toBe('Chưa lập đơn')
  })

  it('Kho đã xác nhận đủ thì thắng mọi phép đếm PO', async () => {
    const { wb } = await read([
      lsx({ materials_received_at: '2026-08-20', posTotal: 3, posLate: 2 }),
    ])
    const ws = wb.getWorksheet('Vật tư theo lệnh')!
    expect(ws.getRow(ws.rowCount).getCell(7).value).toBe('Về đủ')
  })

  it('khối tóm tắt đếm đúng số lệnh mỗi bậc', async () => {
    const { wb } = await read([
      lsx({ id: 'a', code: 'A' }),
      lsx({ id: 'b', code: 'B' }),
      lsx({ id: 'c', code: 'C', materials_received_at: '2026-08-20' }),
    ])
    const ws = wb.getWorksheet('Vật tư theo lệnh')!
    const tomTat = new Map<string, number>()
    for (let r = 1; r <= ws.rowCount; r++) {
      const k = ws.getRow(r).getCell(1).value
      const v = ws.getRow(r).getCell(2).value
      if (typeof k === 'string' && typeof v === 'number') tomTat.set(k, v)
    }
    expect(tomTat.get('Chưa lập đơn')).toBe(2)
    expect(tomTat.get('Về đủ')).toBe(1)
    expect(tomTat.get('TỔNG')).toBe(3)
  })

  /**
   * Thứ tự giống hệt màn hình (`compareForSupply`): VIỆC CỦA CUNG ỨNG trước,
   * rồi mới tới hạn gấp. Nên lệnh "chưa lập đơn" còn xa hạn vẫn đứng TRÊN lệnh
   * "đang về" đã quá hạn — vì cái trên là việc phải làm, cái dưới là chờ NCC.
   * Test khoá đúng điểm này: file và màn không được xếp khác nhau, không thì
   * giữa họp mỗi người đọc một thứ tự ưu tiên.
   */
  it('xếp việc của Cung ứng lên trước, giống màn hình', async () => {
    const { wb } = await read([
      lsx({
        id: 'cho-ncc',
        code: 'DANG-VE-QUA-HAN',
        materials_due_at: '2026-08-01',
        pos: [po()],
        posTotal: 1,
        posOpen: 1,
      }),
      lsx({ id: 'viec-toi', code: 'CHUA-LAP-DON', materials_due_at: '2026-12-01' }),
    ])
    const ws = wb.getWorksheet('Vật tư theo lệnh')!
    const codes: string[] = []
    for (let r = 1; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).getCell(1).value
      if (v === 'CHUA-LAP-DON' || v === 'DANG-VE-QUA-HAN') codes.push(v)
    }
    expect(codes).toEqual(['CHUA-LAP-DON', 'DANG-VE-QUA-HAN'])
  })

  it('sheet đơn mua rỗng thì NÓI RA, không để trắng', async () => {
    const { cell } = await read([lsx()])
    expect(String(cell('Tổng hợp ĐH theo LSX', 2, 1))).toContain('Chưa có đơn mua nào')
  })

  it('đơn trễ và đơn mua chung được đánh dấu, kèm việc phải làm', async () => {
    const { cell } = await read([
      lsx({
        pos: [po({ late: true, shared: true })],
        posTotal: 1,
        posOpen: 1,
        posLate: 1,
      }),
    ])
    expect(cell('Tổng hợp ĐH theo LSX', 2, 2)).toBe('NCC A')
    expect(cell('Tổng hợp ĐH theo LSX', 2, 12)).toBe('Đã gửi NCC')
    expect(cell('Tổng hợp ĐH theo LSX', 2, 14)).toContain('giục nhà cung cấp')
    expect(cell('Tổng hợp ĐH theo LSX', 2, 24)).toBe('x')
  })

  it('còn (ngày) âm khi đã quá hạn', async () => {
    const { wb } = await read([lsx({ materials_due_at: '2026-08-25' })])
    const ws = wb.getWorksheet('Vật tư theo lệnh')!
    expect(ws.getRow(ws.rowCount).getCell(6).value).toBe(-7)
  })
})

describe('sheet Tổng hợp ĐH — số lượng và tiền', () => {
  it('điền đủ SL / % nhận / tiền / còn nợ', async () => {
    const { cell } = await read2()
    expect(cell('Tổng hợp ĐH theo LSX', 2, 3)).toBe('Hộp') // nhóm VT chính
    expect(cell('Tổng hợp ĐH theo LSX', 2, 10)).toBe('31/8/2026') // ngày về thực tế
    expect(cell('Tổng hợp ĐH theo LSX', 2, 15)).toBe(5003) // SL đặt
    expect(cell('Tổng hợp ĐH theo LSX', 2, 16)).toBe(5316) // SL đã nhận
    expect(cell('Tổng hợp ĐH theo LSX', 2, 17)).toBe(1.06) // % nhận
    expect(cell('Tổng hợp ĐH theo LSX', 2, 18)).toBe(1) // số mã còn thiếu
    expect(cell('Tổng hợp ĐH theo LSX', 2, 19)).toBe(123166593) // tổng thanh toán
    expect(cell('Tổng hợp ĐH theo LSX', 2, 20)).toBe(23166593) // đã trả
    expect(cell('Tổng hợp ĐH theo LSX', 2, 21)).toBe(100000000) // còn nợ
  })

  /**
   * Chưa đặt số lượng nào thì cột % phải TRỐNG, không phải 0%. "0%" đọc thành
   * "đã đặt mà chưa về một cái nào" — sai hẳn nghĩa so với "chưa có số để tính".
   */
  it('chưa có SL thì bỏ trống % thay vì in 0%', async () => {
    const { cell } = await read([lsx({ pos: [po()], posTotal: 1, posOpen: 1 })])
    expect(cell('Tổng hợp ĐH theo LSX', 2, 17)).toBe('')
  })
})

/** Một đơn có đủ số liệu chi tiết — số lấy từ file thật của phòng Cung ứng. */
async function read2() {
  const rows = [lsx({ pos: [po({ id: 'pv' })], posTotal: 1, posOpen: 1 })]
  const buf = await buildLsxSupplyExcel(rows, TODAY, {
    pv: {
      material_group: 'Hộp',
      received_at: '2026-08-31',
      qty_ordered: 5003,
      qty_received: 5316,
      lines_missing: 1,
      amount: 123166593,
      paid: 23166593,
    },
  })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(new Uint8Array(buf) as unknown as ArrayBuffer)
  return {
    cell: (sheet: string, r: number, c: number) =>
      wb.getWorksheet(sheet)?.getRow(r).getCell(c).value ?? null,
  }
}
