import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildLsxDetailExcel, sheetName, type LsxDetailReport } from './lsx-detail-excel'
import type { LsxSupplyDetail } from './lsx-supply.service'
import { assessMeetingRisk } from '@/lib/supply-meeting'

/**
 * HỒ SƠ CUNG ỨNG MỘT LỆNH — file đi từ lệnh → đơn → dòng vật tư. Khoá: (1) mỗi
 * đơn một sheet, tên sheet hợp lệ dù mã có "/", (2) cột đợt nhận sinh theo số
 * phiếu nhập thật và số về đúng ô, (3) kết luận Thiếu/Đủ/Dư/Chốt thiếu đúng,
 * (4) lệnh không đơn thì nói ra, không để sheet trắng.
 */

const TODAY = '2026-09-05'

const po = (
  over: Partial<LsxSupplyDetail['pos'][number]> = {},
): LsxSupplyDetail['pos'][number] => ({
  id: 'p1',
  code: 'PO-02/26 VISA',
  supplier_name: 'Visa',
  status: 'partial',
  ordered_at: '2026-08-28',
  expected_at: '2026-08-31',
  currency: 'VND',
  note: null,
  assignee_name: 'Thảo',
  shared: false,
  shared_with: [],
  late: true,
  amount: 6_258_000,
  paid: 0,
  qty_ordered: 1900,
  qty_received: 1885,
  lines_missing: 1,
  received_at: '2026-08-31',
  material_group: 'Hộp',
  line_count: 2,
  unpriced_lines: 0,
  supplier_doc_no: 'ĐH 02/2026',
  ...over,
})

const lsx = (over: Partial<LsxSupplyDetail> = {}): LsxSupplyDetail => ({
  id: 'l1',
  code: '02/26-27 - ROSCO',
  customer_name: 'ROSCO',
  order_codes: ['HG-ROSCO'],
  status: 'in_progress',
  priority: 0,
  ship_date: '2026-10-17',
  materials_due_at: '2026-09-05',
  materials_received_at: null,
  coverage: {
    needed: 8,
    covered: 7,
    missing: 1,
    missing_top: [{ code: 'T-VUO-20X0.7', name: 'Vuông 20x0.7', unit: 'cây', qty: 15 }],
  },
  products: [{ code: '2722875', name: 'IBIZA Ghế xoay', qty: 8816 }],
  pos: [po()],
  ...over,
})

function report(
  l: LsxSupplyDetail,
  over: Partial<LsxDetailReport> = {},
): LsxDetailReport {
  const risk = assessMeetingRisk(
    {
      materials_received_at: l.materials_received_at,
      materials_due_at: l.materials_due_at,
      ship_date: l.ship_date,
      pos: l.pos.map((p) => ({ status: p.status, expected_at: p.expected_at })),
      posTotal: l.pos.length,
      posUnsent: 0,
      posOpen: l.pos.filter((p) => p.status !== 'received').length,
      posLate: l.pos.filter((p) => p.late).length,
    },
    TODAY,
  )
  return { today: TODAY, lsx: l, risk, lines: {}, batches: {}, ...over }
}

async function open(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

/** Số dòng tiêu đề bảng = dòng đóng băng của sheet. */
const headRowOf = (ws: ExcelJS.Worksheet) =>
  (ws.views[0] as { ySplit?: number }).ySplit ?? 0

const text = (ws: ExcelJS.Worksheet) =>
  ws
    .getSheetValues()
    .flat()
    .filter((v) => v != null)
    .map(String)
    .join(' | ')

describe('sheetName', () => {
  it('bỏ ký tự Excel cấm, cắt 31 ký tự, không trùng', () => {
    const taken = new Set<string>()
    expect(sheetName('ĐH', 'PO-02/26 VISA', taken)).toBe('ĐH PO-02-26 VISA')
    expect(sheetName('ĐH', 'PO-02/26 VISA', taken)).toBe('ĐH PO-02-26 VISA (2)')
    const long = sheetName('ĐH', 'X'.repeat(40), taken)
    expect(long.length).toBe(31)
  })
})

describe('hai loại file tách riêng (user chốt 06/09/2026)', () => {
  const r = () =>
    report(lsx(), {
      lines: {
        p1: [
          {
            id: 'ln1',
            material_code: 'T-HOP-20X40X0.8',
            material_name: 'Hộp 20x40',
            spec: null,
            unit: 'cây',
            qty_ordered: 1400,
            qty_received: 0,
            qty_rejected: 0,
            qty_missing: 1400,
            closed_short_at: null,
            last_received_at: null,
            unit_price: 4470,
            qty2: null,
            unit2: null,
            note: null,
          },
        ],
      },
      bangKe: {
        rows: [
          {
            material_id: 'm1',
            material_code: 'T-VUO-20X0.7',
            material_name: 'Vuông 20',
            unit: 'cây',
            group_name: 'Sắt thép',
            source: 'bom',
            deviates: false,
            auto_needed: 100,
            draft_needed: 0,
            edited_by: null,
            edited_at: null,
            from_products: [],
            incomplete: false,
            qty_needed: 100,
            qty_issued: 0,
            qty_remaining: 100,
            on_hand: 0,
            reserved_others: 0,
            available: 0,
            ordered: 0,
            pending: 0,
            draft: 0,
            received: 0,
            suggest: 100,
            status: 'none',
            note: null,
            pos: [],
          },
        ],
        blocked: [],
        include_draft: false,
        unconfirmed_products: [],
      },
    })

  it("loại 'bangke': chỉ Lệnh + Bảng kê VT, KHÔNG có sheet đơn hàng", async () => {
    const wb = await open(await buildLsxDetailExcel(r(), 'bangke'))
    const names = wb.worksheets.map((w) => w.name)
    expect(names).toContain('Bảng kê VT')
    expect(names).not.toContain('Đơn mua')
    expect(names.some((n) => n.startsWith('ĐH'))).toBe(false)
  })

  it("loại 'lsx': Lệnh + Đơn mua + sheet từng đơn, KHÔNG có bảng kê", async () => {
    const wb = await open(await buildLsxDetailExcel(r(), 'lsx'))
    const names = wb.worksheets.map((w) => w.name)
    expect(names).toContain('Đơn mua')
    expect(names.some((n) => n.startsWith('ĐH'))).toBe(true)
    expect(names).not.toContain('Bảng kê VT')
    expect(names).not.toContain('Phân bổ theo SP')
  })

  /*
   * KHUÔN TRÌNH BÀY (07/09/2026) — mấy thứ này hỏng thì không ai báo lỗi, chỉ
   * âm thầm khó dùng: mất lọc thì người nhận tự bật, mất ghim thì cuộn xuống
   * là quên cột, mất printTitlesRow thì in ra trang 2 không có tiêu đề.
   */
  it('bảng có lọc tự động, ghim tiêu đề và lặp tiêu đề khi in', async () => {
    const wb = await open(await buildLsxDetailExcel(r(), 'bangke'))
    const sb = wb.getWorksheet('Bảng kê VT')!
    expect(sb.autoFilter).toBeTruthy()
    expect(sb.views[0]?.state).toBe('frozen')
    expect(sb.views[0]?.ySplit).toBeGreaterThan(0)
    expect(sb.pageSetup.printTitlesRow).toBe(
      `${sb.views[0]?.ySplit}:${sb.views[0]?.ySplit}`,
    )
    expect(sb.pageSetup.orientation).toBe('landscape')
  })

  it('tiêu đề cột số vẫn xuống dòng được (không bị style cột đè)', async () => {
    // exceljs cho `column.alignment` đè lên mọi ô đang có, kể cả ô tiêu đề —
    // đặt cột số căn phải là tiêu đề mất wrapText và bị cắt chữ.
    const wb = await open(await buildLsxDetailExcel(r(), 'bangke'))
    const sb = wb.getWorksheet('Bảng kê VT')!
    const head = sb.getRow(sb.views[0]!.ySplit as number)
    const conPhaiDat = head.getCell(13)
    expect(conPhaiDat.value).toBe('Còn phải đặt')
    expect(conPhaiDat.alignment?.wrapText).toBe(true)
    expect(conPhaiDat.alignment?.horizontal).toBe('center')
  })

  it('cột số giữ KIỂU SỐ, số 0 không bị đổi thành chuỗi rỗng', async () => {
    const wb = await open(await buildLsxDetailExcel(r(), 'bangke'))
    const sb = wb.getWorksheet('Bảng kê VT')!
    const head = sb.views[0]!.ySplit as number
    // Dòng vật tư mẫu có "Đã về" = 0 (cột 12) — phải là số 0, không phải ''.
    const c = sb.getRow(head + 1).getCell(12)
    expect(typeof c.value).toBe('number')
    expect(c.value).toBe(0)
    expect(String(c.numFmt)).toContain('""')
  })
})

describe('buildLsxDetailExcel', () => {
  it('lệnh → đơn → dòng: đủ 3 tầng sheet, đợt nhận sinh theo phiếu, kết luận đúng', async () => {
    const r = report(lsx(), {
      lines: {
        p1: [
          {
            id: 'ln1',
            material_code: 'T-HOP-20X40X0.8',
            material_name: 'Hộp 20x40x0.8',
            spec: 'Hộp Kẽm 20X40 (8 Dem)',
            unit: 'cây',
            qty_ordered: 1400,
            qty_received: 1400,
            qty_rejected: 0,
            qty_missing: 0,
            closed_short_at: null,
            last_received_at: '2026-08-31',
            unit_price: 4470,
            qty2: 6258,
            unit2: 'kg',
            note: null,
          },
          {
            id: 'ln2',
            material_code: 'T-VUO-20X0.7',
            material_name: 'Vuông 20x0.7',
            spec: null,
            unit: 'cây',
            qty_ordered: 500,
            qty_received: 485,
            qty_rejected: 5,
            qty_missing: 15,
            closed_short_at: null,
            last_received_at: '2026-09-02',
            unit_price: null,
            qty2: null,
            unit2: null,
            note: 'Phải lấy tròn bó',
          },
        ],
      },
      batches: {
        p1: [
          {
            date: '2026-08-31',
            doc_code: 'PNK-001',
            supplier_doc_no: 'HD-88',
            by_line: { ln1: { qty: 1400, rejected: 0 }, ln2: { qty: 300, rejected: 0 } },
          },
          {
            date: '2026-09-02',
            doc_code: 'PNK-002',
            supplier_doc_no: null,
            by_line: { ln2: { qty: 185, rejected: 5 } },
          },
        ],
      },
    })
    const wb = await open(await buildLsxDetailExcel(r))
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Lệnh 02-26-27 - ROSCO',
      'Đơn mua',
      'ĐH PO-02-26 VISA',
    ])

    const s1 = text(wb.worksheets[0])
    expect(s1).toContain('Nguy cơ dừng SX')
    expect(s1).toContain('IBIZA Ghế xoay')
    expect(s1).toContain('Vuông 20x0.7') // mã còn hụt theo định mức

    const s2 = wb.worksheets[1]
    const row = s2.getRow(2).values as unknown[]
    expect(row[2]).toBe('PO-02/26 VISA')
    expect(row[4]).toBe('ĐH 02/2026')
    expect(row[10]).toBe('Quá hẹn — giục nhà cung cấp')
    expect(row[14]).toBeCloseTo(1885 / 1900)

    const s3 = wb.worksheets[2]
    const head = s3.getRow(headRowOf(s3)).values as unknown[]
    expect(head).toContain('Đợt 1 (31/8/2026) · HD-88 — nhận')
    expect(head).toContain('Đợt 2 (2/9/2026) — nhận')
    const ln2 = s3.getRow(headRowOf(s3) + 2).values as unknown[]
    expect(ln2[2]).toBe('T-VUO-20X0.7')
    expect(ln2[11]).toBe(300) // đợt 1 nhận
    expect(ln2[13]).toBe(185) // đợt 2 nhận
    expect(ln2[14]).toBe(5) // đợt 2 loại QC
    expect(ln2.slice(15, 19)).toEqual([485, 5, 15, 'Thiếu 15'])
  })

  it('kết luận: Đủ / Dư / Chưa về / Chốt thiếu', async () => {
    const mk = (over: Partial<LsxDetailReport['lines'][string][number]>) => ({
      id: 'x',
      material_code: 'M',
      material_name: 'm',
      spec: null,
      unit: 'cái',
      qty_ordered: 10,
      qty_received: 10,
      qty_rejected: 0,
      qty_missing: 0,
      closed_short_at: null,
      last_received_at: null,
      unit_price: null,
      qty2: null,
      unit2: null,
      note: null,
      ...over,
    })
    const cases: [Partial<LsxDetailReport['lines'][string][number]>, string][] = [
      [{}, 'Đủ'],
      [{ qty_received: 12, qty_missing: -2 }, 'Dư 2'],
      [{ qty_received: 0, qty_missing: 10 }, 'Chưa về'],
      [
        { qty_received: 4, qty_missing: 6, closed_short_at: '2026-09-01' },
        'Chốt thiếu 6',
      ],
    ]
    for (const [over, want] of cases) {
      const wb = await open(
        await buildLsxDetailExcel(report(lsx(), { lines: { p1: [mk(over)] } })),
      )
      const s3 = wb.worksheets[2]
      const vals = s3.getRow(headRowOf(s3) + 1).values as unknown[]
      expect(vals).toContain(want)
    }
  })

  it('lệnh không có đơn: chỉ 2 sheet và nói thẳng', async () => {
    const wb = await open(await buildLsxDetailExcel(report(lsx({ pos: [] }))))
    expect(wb.worksheets.length).toBe(2)
    expect(text(wb.worksheets[1])).toContain('Lệnh chưa có đơn mua nào')
  })
})
