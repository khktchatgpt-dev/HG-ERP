import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
  apiErrorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import { api } from '@/lib/api'
import {
  dateEditState,
  diffShipments,
  plannedColumns,
  saveSuaTaiCho,
  shipmentsPreflight,
  suaTaiChoPreflight,
} from './sua-tai-cho'

const LINES = [
  { id: 'L1', name: 'Bulon 6x10', qty_ordered: 19_890 },
  { id: 'L2', name: 'Bulong 6x20', qty_ordered: 73_114 },
]
const ship = (id: string, status: string, date: string, lines: [string, number][]) => ({
  id,
  seq: 1,
  expected_date: date,
  status,
  note: null,
  lines: lines.map(([po_line_id, qty]) => ({ po_line_id, qty })),
})

describe('plannedColumns / diffShipments — đợt giao sửa thẳng trong lưới (B2)', () => {
  const before = [
    ship('d1', 'planned', '2026-10-05', [['L1', 19_890]]),
    ship('d2', 'planned', '2026-10-12', [['L2', 73_114]]),
    ship('d0', 'received', '2026-09-20', [['L1', 5_000]]),
    ship('dx', 'cancelled', '2026-09-01', [['L2', 1]]),
  ]

  it('chỉ đợt đang hẹn vào lưới, giữ id; đã nhận / huỷ đứng ngoài', () => {
    const cols = plannedColumns(before, LINES)
    expect(cols).toEqual([
      { id: 'd1', date: '2026-10-05', qty: { 0: 19_890 } },
      { id: 'd2', date: '2026-10-12', qty: { 1: 73_114 } },
    ])
  })

  it('không đổi gì → không gọi gì', () => {
    const d = diffShipments(plannedColumns(before, LINES), LINES, before)
    expect(d).toEqual({ edits: [], adds: [], cancels: [] })
  })

  it('đổi ngày đợt 1, đổi số đợt 2 → hai lệnh sửa đúng đợt', () => {
    const cols = plannedColumns(before, LINES)
    cols[0] = { ...cols[0], date: '2026-10-08' }
    cols[1] = { ...cols[1], qty: { 1: 70_000 } }
    const d = diffShipments(cols, LINES, before)
    expect(d.edits).toEqual([
      {
        id: 'd1',
        expected_date: '2026-10-08',
        lines: [{ po_line_id: 'L1', qty: 19_890 }],
      },
      {
        id: 'd2',
        expected_date: '2026-10-12',
        lines: [{ po_line_id: 'L2', qty: 70_000 }],
      },
    ])
    expect(d.adds).toEqual([])
    expect(d.cancels).toEqual([])
  })

  it('cột mới có ngày + số → thêm; cột mới trống → bỏ qua; bỏ cột cũ hoặc xoá hết số → bỏ đợt', () => {
    const cols = plannedColumns(before, LINES)
    const d = diffShipments(
      [cols[0], { ...cols[1], qty: {} }, { date: '2026-10-20', qty: { 1: 3_114 } }, { date: '', qty: { 0: 5 } }], // prettier-ignore
      LINES,
      before,
    )
    expect(d.adds).toEqual([{ expected_date: '2026-10-20', lines: [{ po_line_id: 'L2', qty: 3_114 }] }]) // prettier-ignore
    expect(d.cancels).toEqual(['d2'])
    expect(d.edits).toEqual([])
  })

  it('shipmentsPreflight cộng đợt ĐÃ NHẬN vào phần đã chia — vượt SL đặt thì chặn bằng câu của server', () => {
    // d0 đã nhận 5.000 của L1; đợt hẹn 19.890 nữa là 24.890 > 19.890.
    const errs = shipmentsPreflight(plannedColumns(before, LINES), LINES, before)
    expect(errs.length).toBeGreaterThan(0)
    expect(errs.join(' ')).toMatch(/Bulon 6x10/)
    // Không cột nào → không lỗi (bỏ hết đợt là chuyện hợp lệ).
    expect(shipmentsPreflight([], LINES, before)).toEqual([])
  })
})

const header = {
  expectedAt: '2026-10-05',
  contractNo: ' HĐ 12 ',
  terms: {
    quality: '',
    delivery_place: 'Xưởng',
    payment: 'COD',
    invoice: '',
    lead_time: '',
  },
  signerRole: 'TP Cung ứng',
  note: '',
}

describe('dateEditState — hẹn giao đổi được khi nào trong chế độ Sửa', () => {
  it('đơn đã gửi: mở, và "changed" chỉ khi ngày khác bản đang lưu', () => {
    const po = { status: 'ordered', expected_at: '2026-09-29T00:00:00Z' }
    expect(dateEditState(po, '2026-09-29', true)).toMatchObject({ ok: true, current: '2026-09-29', changed: false }) // prettier-ignore
    expect(dateEditState(po, '2026-10-05', true).changed).toBe(true)
    // Không ở chế độ sửa thì không có gì "đã đổi" dù header lệch.
    expect(dateEditState(po, '2026-10-05', false).changed).toBe(false)
  })

  it('đơn về đủ / chờ duyệt: khoá kèm lý do đọc được, không bao giờ "changed"', () => {
    const d = dateEditState({ status: 'received', expected_at: '2026-09-12' }, '2026-10-01', true) // prettier-ignore
    expect(d.ok).toBe(false)
    expect(d.why).toMatch(/về đủ/)
    expect(d.changed).toBe(false)
    expect(dateEditState({ status: 'pending_approval', expected_at: null }, '2026-10-01', true).why).toMatch(/Sửa đơn/) // prettier-ignore
  })

  it('đơn chưa từng hẹn: current rỗng, chọn ngày là "changed"', () => {
    expect(dateEditState({ status: 'ordered', expected_at: null }, '2026-10-01', true)).toMatchObject({ current: '', changed: true }) // prettier-ignore
  })
})

describe('suaTaiChoPreflight — chặn trước khi gọi server', () => {
  const open = { ok: true, current: '2026-09-29', changed: true }
  it('ghi chú quá dài, hoặc xoá trắng hạn giao → câu chặn', () => {
    expect(suaTaiChoPreflight(12, { ...open, changed: false }, '2026-09-29')).toMatch(
      /12 ký tự/,
    )
    expect(suaTaiChoPreflight(0, open, '')).toMatch(/Hạn giao đang trống/)
  })
  it('bình thường → null', () => {
    expect(suaTaiChoPreflight(0, open, '2026-10-05')).toBeNull()
  })
})

describe('saveSuaTaiCho — lưu theo phần, hỏng giữa chừng nói phần nào đã vào', () => {
  it('ngày đổi: gọi /reschedule TRƯỚC (lý do để trống được) rồi /terms; cắt khoảng trắng', async () => {
    vi.mocked(api).mockResolvedValue({})
    const r = await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-09-29', changed: true },
      '  ',
    )
    expect(r.ok).toBe(true)
    const calls = vi.mocked(api).mock.calls.map((c) => [c[0], c[1]?.method, c[1]?.body])
    expect(calls[0]).toEqual(['/api/dept/supply/pos/p1/reschedule', 'POST', { expected_at: '2026-10-05', reason: '' }]) // prettier-ignore
    expect(calls[1][0]).toBe('/api/dept/supply/pos/p1/terms')
    expect(calls[1][2]).toMatchObject({
      contract_no: 'HĐ 12',
      terms_quality: null,
      terms_payment: 'COD',
    })
    if (r.ok) expect(r.detail).toMatch(/29\/09\/2026 → 05\/10\/2026/)
  })

  it('ngày không đổi: không gọi /reschedule', async () => {
    vi.mocked(api).mockClear().mockResolvedValue({})
    await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-10-05', changed: false },
      '',
    )
    expect(vi.mocked(api).mock.calls.map((c) => c[0])).toEqual([
      '/api/dept/supply/pos/p1/terms',
    ])
  })

  it('dời hẹn xong mà điều khoản hỏng → báo phần đã ghi, phần chưa; dateSaved=true', async () => {
    vi.mocked(api)
      .mockClear()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Ghi chú quá dài'))
    const r = await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-09-29', changed: true },
      'NCC báo trễ',
    )
    expect(r).toMatchObject({ ok: false, dateSaved: true, detail: 'Ghi chú quá dài' })
    if (!r.ok) expect(r.title).toMatch(/Đã ghi hẹn giao — phần còn lại CHƯA lưu/)
  })

  it('đợt giao: bỏ → sửa → thêm, mỗi đợt đúng route và lý do máy ghi; hỏng ở đợt thứ 2 thì nói "1/3 đợt"', async () => {
    vi.mocked(api).mockClear().mockResolvedValue({})
    const ships = {
      cancels: ['d9'],
      edits: [
        { id: 'd1', expected_date: '2026-10-08', lines: [{ po_line_id: 'L1', qty: 1 }] },
      ],
      adds: [{ expected_date: '2026-10-20', lines: [{ po_line_id: 'L2', qty: 2 }] }],
    }
    const noDate = { ok: true, current: '', changed: false }
    const r = await saveSuaTaiCho('p1', header, noDate, '', ships)
    const calls = vi.mocked(api).mock.calls.map((c) => [c[0], c[1]?.method])
    expect(calls).toEqual([
      ['/api/dept/supply/pos/p1/terms', 'PATCH'],
      ['/api/dept/supply/shipments/d9', 'PATCH'],
      ['/api/dept/supply/shipments/d1', 'PATCH'],
      ['/api/dept/supply/pos/p1/shipments', 'POST'],
    ])
    expect(vi.mocked(api).mock.calls[1][1]?.body).toMatchObject({ action: 'cancel', reason: expect.stringMatching(/sửa đơn tại chỗ/) }) // prettier-ignore
    expect(vi.mocked(api).mock.calls[2][1]?.body).toMatchObject({ action: 'edit', expected_date: '2026-10-08' }) // prettier-ignore
    if (r.ok) expect(r.detail).toMatch(/3 đợt giao \(1 sửa · 1 thêm · 1 bỏ\)/)

    vi.mocked(api).mockClear().mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('vượt SL đặt')) // prettier-ignore
    const r2 = await saveSuaTaiCho('p1', header, noDate, '', ships)
    expect(r2).toMatchObject({ ok: false, dateSaved: true, detail: 'vượt SL đặt' })
    if (!r2.ok) expect(r2.title).toMatch(/điều khoản, 1\/3 đợt/)
  })
})
