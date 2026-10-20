import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildSupplyOrdersExcel } from './supply-orders-excel'
import type { SupplyOrdersPo, SupplyOrdersReport } from './supply-orders-report.service'
import type { LsxSupplyRow } from './lsx-supply.service'
import { assessMeetingRisk, buildMeeting } from '@/lib/supply-meeting'

/**
 * BÁO CÁO ĐƠN HÀNG THEO LỆNH — khoá: (1) bốn loại tờ đúng tên, đơn mua chung
 * chỉ có MỘT tờ con; (2) tờ Tổng hợp có khối công ty + chỉ tiêu + dòng khối
 * theo lệnh + cộng tiền theo tiền tệ; (3) rỗng thì nói ra.
 */

const TODAY = '2026-09-13'

const po = (over: Partial<SupplyOrdersPo> = {}): SupplyOrdersPo => ({
  id: 'p1',
  code: 'PO-01',
  supplier_name: 'Visa',
  status: 'received',
  expected_at: '2026-09-01',
  currency: 'VND',
  ordered_at: '2026-08-20',
  note: null,
  assignee_name: 'Thảo',
  shared: false,
  late: false,
  material_group: 'Hộp',
  received_at: '2026-09-01',
  qty_ordered: 100,
  qty_received: 100,
  lines_missing: 0,
  amount: 1_000_000,
  paid: 400_000,
  line_count: 1,
  unpriced_lines: 0,
  supplier_doc_no: null,
  shared_with: [],
  ...over,
})

const row = (over: Partial<LsxSupplyRow> = {}): LsxSupplyRow => ({
  id: 'l1',
  code: '01/26-27 - ROSCO',
  customer_name: 'ROSCO',
  order_codes: [],
  ship_date: null,
  materials_due_at: null,
  materials_received_at: '2026-09-01',
  priority: 0,
  products: [{ code: 'CH0001', name: 'Ghế', qty: 10 }],
  pos: [],
  posTotal: 0,
  posUnsent: 0,
  posOpen: 0,
  posLate: 0,
  ...over,
})

function report(
  lsxPos: { row: LsxSupplyRow; pos: SupplyOrdersPo[] }[],
): SupplyOrdersReport {
  const rows = lsxPos.map(({ row: r, pos }) => ({
    ...r,
    pos: pos.map((p) => ({ ...p })),
    posTotal: pos.length,
    posUnsent: pos.filter((p) => p.status === 'draft').length,
  }))
  const m = buildMeeting(rows, TODAY)
  return {
    today: TODAY,
    scope: { kind: 'all', total: rows.length },
    company: {
      company_name: 'Công ty SXTM Hoàng Gia',
      company_address: 'Gia Lai',
      company_tax_code: '123',
      company_phone: '',
    },
    prepared_by: 'Hằng',
    lsx: m.rows.map(({ row: r }) => ({
      row: r,
      risk: assessMeetingRisk(r, TODAY),
      pos: lsxPos.find((x) => x.row.id === r.id)!.pos,
    })),
    counts: m.counts,
    issues: m.issues.length,
    lines: {},
    batches: {},
  }
}

async function open(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

const text = (ws: ExcelJS.Worksheet) =>
  ws
    .getSheetValues()
    .flat()
    .filter((v) => v != null)
    .map(String)
    .join(' | ')

describe('buildSupplyOrdersExcel', () => {
  const shared = po({
    id: 'p2',
    code: 'PO-02',
    status: 'draft',
    currency: 'USD',
    amount: 500,
    paid: 0,
  })
  const rep = () =>
    report([
      { row: row(), pos: [po(), shared] },
      {
        row: row({
          id: 'l2',
          code: '02/26-27 - MX',
          customer_name: 'MERXX',
          materials_received_at: null,
        }),
        pos: [{ ...shared, shared: true, shared_with: ['01/26-27 - ROSCO'] }],
      },
      { row: row({ id: 'l3', code: '03/26-27 - MX', customer_name: 'MERXX' }), pos: [] },
    ])

  it('bốn loại tờ; đơn mua chung chỉ một tờ con', async () => {
    const wb = await open(await buildSupplyOrdersExcel(rep()))
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tổng hợp',
      'Tình trạng lệnh',
      'Việc cần quyết định',
      'ĐH PO-02',
      'ĐH PO-01',
    ])
  })

  it('tờ Tổng hợp: công ty, chỉ tiêu, dòng khối từng lệnh, cộng tiền theo tiền tệ', async () => {
    const wb = await open(await buildSupplyOrdersExcel(rep()))
    const t = text(wb.worksheets[0])
    expect(t).toContain('CÔNG TY SXTM HOÀNG GIA')
    expect(t).toContain('BÁO CÁO ĐƠN HÀNG THEO LỆNH SẢN XUẤT')
    expect(t).toContain('Phạm vi: mọi lệnh đang chạy (3 lệnh)')
    expect(t).toContain('Người lập: Hằng')
    // Chỉ tiêu xếp NGANG: nhãn ở dòng trên, số ở ô ngay dưới. 2 đơn (mua chung
    // đếm một lần), 1 chưa gửi.
    const s1 = wb.worksheets[0]
    const kpi = (label: string) => {
      for (let i = 1; i <= 8; i++) {
        const row = s1.getRow(i)
        for (let c = 1; c <= 25; c++) {
          if (row.getCell(c).value === label) return s1.getRow(i + 1).getCell(c).value
        }
      }
      return undefined
    }
    expect(kpi('Đơn mua')).toBe(2)
    expect(kpi('Chưa gửi NCC')).toBe(1)
    expect(kpi('Tiền hàng (VND)')).toBe(1_000_000)
    // Bảng bắt đầu ngay dòng 7 — không còn khối dọc đẩy bảng xuống.
    expect(s1.getRow(7).getCell(1).value).toBe('STT')
    // Dòng khối theo lệnh, lệnh không đơn thì nói ra.
    expect(t).toContain('LSX 01/26-27 - ROSCO · ROSCO')
    expect(t).toContain('— chưa có đơn mua nào —')
    // Cộng theo tiền tệ, không trộn VND với USD.
    expect(t).toContain('TỔNG CỘNG (VND)')
    expect(t).toContain('TỔNG CỘNG (USD)')
    expect(t).toContain('mua chung với 01/26-27 - ROSCO')
  })

  it('rỗng thì nói ra ở cả ba tờ', async () => {
    const wb = await open(await buildSupplyOrdersExcel(report([])))
    expect(wb.worksheets).toHaveLength(3)
    for (const ws of wb.worksheets) expect(text(ws)).toMatch(/Không có/)
  })
})
