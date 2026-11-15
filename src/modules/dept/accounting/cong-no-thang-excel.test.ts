import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { monthRows, supplierSheet, toDocs } from '@/lib/cong-no-thang'
import type { ReceiptMove } from '@/lib/ap-receipt-ledger'
import {
  buildCongNoNccExcel,
  buildCongNoThangExcel,
  congNoNccFilename,
  congNoThangFilename,
} from './cong-no-thang-excel'

let seq = 0
const mv = (o: Partial<ReceiptMove> = {}): ReceiptMove => ({
  move_id: String(++seq).padStart(4, '0'),
  item_name: 'Vít 4x30 sắt xi đen',
  item_unit: 'Con',
  lsx_code: '01/26-27 - JAWOLL',
  qty: 11240,
  unit_cost: 120,
  direction: 'in',
  doc_id: 'd117',
  doc_code: 'PNK-2026-0117',
  doc_date: '2026-10-09',
  supplier_doc_no: '16016',
  is_reversal: false,
  po_id: 'p109',
  po_code: 'PO-2026-0109',
  currency: 'VND',
  supplier_id: 'mt',
  supplier_name: 'Công ty TNHH TM-DV-TH Minh Thắng',
  vat_rate: 8,
  price_includes_vat: false,
  terms_payment: null,
  supplier_net_days: null,
  ...o,
})

async function open(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}
const rowsOf = (ws: ExcelJS.Worksheet) => {
  const out: ExcelJS.Row[] = []
  ws.eachRow((r) => out.push(r))
  return out
}

describe('Excel công nợ tháng', () => {
  const docs = toDocs([mv(), mv({ unit_cost: null, item_name: 'Hộp trượt' }), mv({ doc_date: '2026-09-11', doc_id: 'd26', doc_code: 'PNK-2026-0026' })]) // prettier-ignore
  const oct = docs.filter((d) => d.date.startsWith('2026-10'))

  it('sheet danh sách: một dòng NCC, chốt "Tổng cộng T10/2026"', async () => {
    const wb = await open(
      await buildCongNoThangExcel('2026-10', monthRows(docs, '2026-10'), oct),
    )
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tháng 10-2026', 'Theo dòng hàng'])
    const rows = rowsOf(wb.worksheets[0])
    const mt = rows.find(
      (r) => r.getCell(2).value === 'Công ty TNHH TM-DV-TH Minh Thắng',
    )!
    expect(mt.getCell(3).value).toBe(1)
    expect(mt.getCell(6).value).toBe(1_456_704)
    expect(
      rows.some((r) => String(r.getCell(2).value).startsWith('Tổng cộng T10/2026')),
    ).toBe(true)
  })

  it('sheet dòng hàng: đúng cột sổ Kế toán, dòng chưa giá ghi chữ, chốt có nói thiếu', async () => {
    const wb = await open(
      await buildCongNoThangExcel('2026-10', monthRows(docs, '2026-10'), oct),
    )
    const rows = rowsOf(wb.getWorksheet('Theo dòng hàng')!)
    const vit = rows.find((r) => r.getCell(1).value === 'Vít 4x30 sắt xi đen')!
    expect(vit.getCell(4).value).toBe('PO-2026-0109 · 01/26-27 - JAWOLL')
    expect(vit.getCell(5).value).toBe('16016')
    expect(vit.getCell(11).value).toBe(1_456_704)
    expect(rows.find((r) => r.getCell(1).value === 'Hộp trượt')!.getCell(3).value).toBe(
      'chưa có giá',
    )
    expect(
      rows.some((r) => String(r.getCell(1).value).includes('thiếu 1 dòng chưa giá')),
    ).toBe(true)
  })

  it('sổ một NCC: tháng mới nhất trước', async () => {
    const wb = await open(await buildCongNoNccExcel('Minh Thắng', supplierSheet(docs)))
    const bands = rowsOf(wb.worksheets[0])
      .map((r) => String(r.getCell(1).value))
      .filter((v) => v.startsWith('THÁNG'))
    expect(bands).toEqual(['THÁNG 10/2026', 'THÁNG 09/2026'])
  })

  it('tên tệp không dấu', () => {
    expect(congNoThangFilename('2026-10')).toBe('Cong no NCC thang 10-2026.xlsx')
    expect(congNoNccFilename('Công ty TNHH Minh Thắng', '2026-09', '2026-10')).toBe(
      'Cong no Cong ty TNHH Minh Thang 09-2026 den 10-2026.xlsx',
    )
  })
})
