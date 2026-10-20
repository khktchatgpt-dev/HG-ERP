import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./pos.repo', () => ({ posRepo: { findById: vi.fn(), listLines: vi.fn() } }))
vi.mock('./supply.repo', () => ({ supplyRepo: { docsByPo: vi.fn() } }))
vi.mock('./po-receipts.service', () => ({ loadReceiptBatches: vi.fn() }))
vi.mock('./po-tracking.repo', () => ({ poTrackingRepo: { logCommits: vi.fn() } }))
vi.mock('./po-shipments.sync', () => ({ syncPoExpectedAt: vi.fn() }))
vi.mock('./pos.service', () => ({ assertPoOwner: vi.fn() }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('@/lib/date-vn', () => ({ todayVn: () => '2026-10-07' }))
vi.mock('./po-shipments.repo', () => ({
  poShipmentsRepo: {
    listByPo: vi.fn(),
    findById: vi.fn(),
    shipmentOfDocs: vi.fn(),
    insertMany: vi.fn(),
    linkDoc: vi.fn(),
    replaceLines: vi.fn(),
    patch: vi.fn(),
  },
}))

import { posRepo } from './pos.repo'
import { supplyRepo } from './supply.repo'
import { loadReceiptBatches } from './po-receipts.service'
import { poShipmentsRepo } from './po-shipments.repo'
import { poTrackingRepo } from './po-tracking.repo'
import { tachDotPlan, tachDotTheoPhieuNhap } from './po-shipments-tach.service'

/* PO-2026-0084 (07/10/2026), rút gọn hai dòng. */
const PO = 'po84'
const SHIP = {
  id: 's1',
  po_id: PO,
  code: 'GH-2026-0020',
  seq: 1,
  expected_date: '2026-10-01',
  status: 'arrived',
  note: null,
  lines: [
    { po_line_id: 'A', qty: 59405 },
    { po_line_id: 'C', qty: 127447 },
  ],
}
const batch = (id: string, code: string, date: string, a: number, c: number) => ({
  date,
  doc_id: id,
  doc_code: code,
  supplier_doc_no: null,
  by_line: { A: { qty: a, rejected: 0 }, C: { qty: c, rejected: 0 } },
})
const doc = (id: string, code: string, extra: Record<string, unknown> = {}) => ({
  doc_id: id,
  code,
  kind: 'receipt',
  reversed_by: null,
  ...extra,
})
const user = { id: 'u1', role: 'employee' } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(poShipmentsRepo.listByPo).mockResolvedValue([SHIP] as never)
  vi.mocked(poShipmentsRepo.findById).mockResolvedValue(SHIP as never)
  vi.mocked(poShipmentsRepo.shipmentOfDocs).mockResolvedValue(new Map())
  vi.mocked(poShipmentsRepo.insertMany).mockResolvedValue(new Map([[2, 's2'], [3, 's3']])) // prettier-ignore
  vi.mocked(loadReceiptBatches).mockResolvedValue({
    [PO]: [
      batch('d96', 'PNK-2026-0096', '2026-10-05', 7800, 10000),
      batch('d79', 'PNK-2026-0079', '2026-10-02', 4270, 23400),
    ],
  } as never)
  vi.mocked(supplyRepo.docsByPo).mockResolvedValue([doc('d79', 'PNK-2026-0079'), doc('d96', 'PNK-2026-0096')] as never) // prettier-ignore
  vi.mocked(posRepo.findById).mockResolvedValue({ id: PO, status: 'partial' } as never)
  vi.mocked(posRepo.listLines).mockResolvedValue([
    { id: 'A', material_name: 'Bulon 8x25', qty_ordered: 59405 },
    { id: 'C', material_name: 'LĐS 6x16', qty_ordered: 127447 },
  ] as never)
})

describe('tachDotPlan', () => {
  it('phiếu chưa nối đợt → đề xuất trên đợt mở sớm nhất', async () => {
    const r = await tachDotPlan(PO)
    expect(r?.shipment_id).toBe('s1')
    expect(r?.plan.receipts.map((x) => x.doc_code)).toEqual(['PNK-2026-0079', 'PNK-2026-0096']) // prettier-ignore
    expect(r?.plan.rest).toEqual([
      { po_line_id: 'A', qty: 47335 },
      { po_line_id: 'C', qty: 94047 },
    ])
  })

  it('mọi phiếu đã nối đợt (luồng thường) → không làm phiền', async () => {
    vi.mocked(poShipmentsRepo.shipmentOfDocs).mockResolvedValue(new Map([['d79', 's1'], ['d96', 's1']])) // prettier-ignore
    expect(await tachDotPlan(PO)).toBeNull()
  })

  it('phiếu đã bị đảo không thành đợt', async () => {
    vi.mocked(supplyRepo.docsByPo).mockResolvedValue([doc('d79', 'PNK-2026-0079'), doc('d96', 'PNK-2026-0096', { reversed_by: 'PNK-2026-0100' })] as never) // prettier-ignore
    const r = await tachDotPlan(PO)
    expect(r?.plan.receipts.map((x) => x.doc_code)).toEqual(['PNK-2026-0079'])
    expect(r?.plan.rest).toEqual([
      { po_line_id: 'A', qty: 55135 },
      { po_line_id: 'C', qty: 104047 },
    ])
  })
})

describe('tachDotTheoPhieuNhap', () => {
  const rest = [
    {
      expected_date: '2026-10-20',
      lines: [
        { po_line_id: 'A', qty: 47335 },
        { po_line_id: 'C', qty: 94047 },
      ],
    },
  ]

  it('PO-0084: chèn đợt PNK-0096 (đã nhận) + đợt còn chờ, nối phiếu, rồi mới co đợt gốc', async () => {
    const r = await tachDotTheoPhieuNhap(user, 's1', { reason: 'NCC giao nhiều chuyến', rest }) // prettier-ignore
    expect(r).toEqual({ created: 2 })
    const [, rows] = vi.mocked(poShipmentsRepo.insertMany).mock.calls[0]
    expect(rows).toMatchObject([
      { seq: 2, expected_date: '2026-10-05', status: 'received', lines: [{ po_line_id: 'A', qty: 7800 }, { po_line_id: 'C', qty: 10000 }] }, // prettier-ignore
      { seq: 3, expected_date: '2026-10-20', lines: rest[0].lines },
    ])
    expect(rows[1]).not.toHaveProperty('status')
    expect(vi.mocked(poShipmentsRepo.linkDoc).mock.calls).toEqual([
      ['d96', 's2'],
      ['d79', 's1'],
    ])
    expect(poShipmentsRepo.replaceLines).toHaveBeenCalledWith('s1', [
      { po_line_id: 'A', qty: 4270 },
      { po_line_id: 'C', qty: 23400 },
    ])
    expect(poShipmentsRepo.patch).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'received' })) // prettier-ignore
    // Đợt gốc giữ ngày hẹn cũ — không patch expected_date.
    expect(vi.mocked(poShipmentsRepo.patch).mock.calls[0][1]).not.toHaveProperty(
      'expected_date',
    )
    // Thứ tự: chèn trước, co đợt gốc sau cùng.
    const order = (fn: unknown) =>
      vi.mocked(fn as never as () => void).mock.invocationCallOrder[0]
    expect(order(poShipmentsRepo.insertMany)).toBeLessThan(
      order(poShipmentsRepo.replaceLines),
    )
    const logs = vi.mocked(poTrackingRepo.logCommits).mock.calls[0][0]
    expect(logs.every((l) => l.reason?.startsWith('Tách theo phiếu nhập'))).toBe(true)
  })

  it('phần còn chờ chia lệch → chặn, không ghi gì', async () => {
    const lech = [{ ...rest[0], lines: [{ po_line_id: 'A', qty: 47000 }, { po_line_id: 'C', qty: 94047 }] }] // prettier-ignore
    await expect(tachDotTheoPhieuNhap(user, 's1', { reason: 'x', rest: lech })).rejects.toThrow('47.335') // prettier-ignore
    expect(poShipmentsRepo.insertMany).not.toHaveBeenCalled()
    expect(poShipmentsRepo.replaceLines).not.toHaveBeenCalled()
  })

  it('đợt không phải ứng viên (không có phiếu chưa nối) → chặn', async () => {
    vi.mocked(poShipmentsRepo.shipmentOfDocs).mockResolvedValue(new Map([['d79', 's1'], ['d96', 's1']])) // prettier-ignore
    await expect(tachDotTheoPhieuNhap(user, 's1', { reason: 'x', rest })).rejects.toThrow('không có gì để tách') // prettier-ignore
  })

  it('đơn đã về đủ / huỷ → chặn', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ id: PO, status: 'received' } as never)
    await expect(tachDotTheoPhieuNhap(user, 's1', { reason: 'x', rest })).rejects.toThrow('chưa về đủ') // prettier-ignore
  })
})
