import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildLsxExcel } from '@/modules/dept/production/lsx-excel'
import { resolveLsxTemplate } from '@/modules/dept/sales/lsx-template'
import type { LsxLine } from '@/modules/dept/production/lsx-lines.repo'

const line = (over: Partial<LsxLine>): LsxLine => ({
  id: 'l1',
  production_order_id: 'po',
  group_id: 'g',
  product_id: null,
  sales_order_line_id: null,
  product_code: 'HG-01-123',
  customer_item_code: 'RS-889',
  name_foreign: 'ALICANTE CHAIR',
  name_vi: 'Ghế Alicante',
  name_customs: null,
  barcode: '893850',
  unit: 'cái',
  qty: 120,
  packing: '1 cái/thùng',
  cbm: 0.35,
  ship_date: null,
  ship_label: 'w37.26',
  specs: { may: 'Dây dù kem', son: 'xác nhận sau' },
  checks: { mau: 'Có' },
  extras: {},
  note: null,
  important_note: null,
  image_file_id: null,
  sort_order: 0,
  changed_in_rev: null,
  ...over,
})

function findCell(ws: ExcelJS.Worksheet, want: unknown) {
  let hit: ExcelJS.Cell | null = null
  ws.eachRow((row) =>
    row.eachCell((cell) => {
      if (!hit && cell.value === want) hit = cell
    }),
  )
  return hit as ExcelJS.Cell | null
}

describe('buildLsxExcel — cấu trúc giống phiếu in', () => {
  it('đủ tiêu đề, gộp ô nhóm, số thật, màu tín hiệu, dòng tổng', async () => {
    const buf = await buildLsxExcel({
      company: {
        company_name: 'CÔNG TY TNHH SX-TM HOÀNG GIA',
        company_address: 'Gia Lai',
        company_tax_code: '5900x',
        company_phone: '0269',
        company_fax: null,
        company_locality: 'Gia Lai',
      },
      header: {
        customer_name: 'ROSCO',
        code: '01/26-27 - ROSCO',
        issued_at: '2026-08-05',
        received_date: null,
        completed_at: null,
        container_summary: '2x40HQ',
        note: 'Ưu tiên w37.',
        revision: 1,
        revised_at: null,
      },
      template: resolveLsxTemplate(null),
      groups: [
        {
          id: 'g1',
          title: 'PO PT-138-155-HG',
          buyer_name: 'PAPAYA',
          po_no: 'PT-138-155-HG',
          ship_date: null,
          ship_label: 'w37.26',
          note: null,
          lines: [
            line({}),
            line({ id: 'l2', product_code: 'HG-01-124', qty: 80, cbm: 0.5, checks: {} }),
          ],
        },
      ],
      images: new Map(),
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet('LSX')!

    // Tiêu đề + câu dẫn + chữ ký có mặt.
    expect(findCell(ws, 'LỆNH SẢN XUẤT')).toBeTruthy()
    expect(findCell(ws, 'SỐ 01/26-27 - ROSCO')).toBeTruthy()
    expect(findCell(ws, 'Trưởng phòng kế hoạch')).toBeTruthy()

    // Hàng tiêu đề nền VÀNG; cột Số PO đỏ + IN ĐẬM; kiểm tra hồ sơ KHÔNG xuất.
    const poHead = findCell(ws, 'Số PO')!
    expect(poHead).toBeTruthy()
    expect(poHead.font?.color?.argb).toBe('FFDC2626')
    expect(poHead.font?.bold).toBe(true)
    expect((poHead.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFFEF08A')
    expect(findCell(ws, 'BOM')).toBeNull()

    // Giá trị 3 cột nhấn (Số PO · SL · Thời gian xuất) cũng đỏ đậm.
    const poCellRed = findCell(ws, 'PT-138-155-HG')!
    expect(poCellRed.font?.bold).toBe(true)
    expect(poCellRed.font?.color?.argb).toBe('FFDC2626')
    const qtyCell = findCell(ws, 120)!
    expect(qtyCell.font?.bold).toBe(true)
    expect(qtyCell.font?.color?.argb).toBe('FFDC2626')

    // SL là SỐ thật (sum được), dòng Total Cube + Tổng đúng giá trị.
    const qty = findCell(ws, 120)!
    expect(qty).toBeTruthy()
    expect(findCell(ws, 'Total Cube:')).toBeTruthy()
    expect(findCell(ws, 120 * 0.35 + 80 * 0.5)).toBeTruthy() // 82
    expect(findCell(ws, 'Tổng')).toBeTruthy()
    expect(findCell(ws, 200)).toBeTruthy()

    // Ô nhóm Số PO được gộp dọc (merge) qua các dòng.
    const poCell = findCell(ws, 'PT-138-155-HG')!
    expect(poCell.isMerged).toBe(true)

    // Tín hiệu màu: mã SP đủ mẫu nền xanh; "xác nhận sau" nền cam chữ đỏ.
    const ready = findCell(ws, 'HG-01-123')!
    expect((ready.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFDCFCE7')
    const pending = findCell(ws, 'xác nhận sau')!
    expect((pending.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFFFEDD5')
    expect(pending.font?.color?.argb).toBe('FFDC2626')
  })

  it('bản chỉnh sửa: dòng vừa đổi tô XANH (không vàng — vàng là màu tiêu đề)', async () => {
    const buf = await buildLsxExcel({
      company: { company_name: 'HG', company_locality: 'Gia Lai' },
      header: {
        customer_name: 'ROSCO',
        code: '01/26-27 - ROSCO',
        issued_at: '2026-08-05',
        received_date: null,
        completed_at: null,
        container_summary: null,
        note: null,
        revision: 2,
        revised_at: '2026-08-06',
      },
      template: resolveLsxTemplate(null),
      groups: [
        {
          id: 'g1',
          title: 'PO PT-138-155-HG',
          buyer_name: null,
          po_no: 'PT-138-155-HG',
          ship_date: null,
          ship_label: 'w37.26',
          note: null,
          lines: [
            line({ name_vi: 'Ghế đã sửa', specs: {}, checks: {}, changed_in_rev: 2 }),
            line({ id: 'l2', name_vi: 'Ghế giữ nguyên', specs: {}, checks: {} }),
          ],
        },
      ],
      images: new Map(),
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet('LSX')!

    expect(findCell(ws, 'CHỈNH SỬA LẦN 2 — NGÀY 06/08/2026')).toBeTruthy()
    const changed = findCell(ws, 'Ghế đã sửa')!
    expect((changed.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFE0F2FE')
    const intact = findCell(ws, 'Ghế giữ nguyên')!
    // Ô không tô: exceljs trả { pattern: 'none' } chứ không phải undefined.
    expect((intact.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBeUndefined()
    // STT dòng đổi gắn ▲ để xưởng thấy ngay dòng nào khác bản trước.
    expect(findCell(ws, '▲ 1')).toBeTruthy()
  })
})
