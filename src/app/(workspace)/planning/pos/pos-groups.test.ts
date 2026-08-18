import { describe, expect, it } from 'vitest'
import { groupPosByLsx, type LsxRef } from './pos-groups'
import type { Po } from './po-types'

const TODAY = '2026-08-03'

function po(over: Partial<Po> & { code: string }): Po {
  return {
    id: over.code,
    production_order_id: null,
    supplier_id: 's1',
    status: 'approved',
    currency: 'VND',
    vat_rate: null,
    price_includes_vat: false,
    expected_at: null,
    terms: null,
    note: null,
    created_at: '2026-07-01',
    supplier_name: 'NCC A',
    lsx_code: null,
    order_code: null,
    total: 0,
    ...over,
  }
}

const LSXS: LsxRef[] = [
  {
    id: 'l1',
    code: 'LSX-2026-0001',
    order_codes: ['DH-01'],
    customer_name: 'MERXX',
    materials_due_at: null,
  },
  {
    id: 'l2',
    code: 'LSX-2026-0002',
    order_codes: ['DH-02'],
    customer_name: 'YOTRIO',
    materials_due_at: null,
  },
  {
    id: 'l3',
    code: 'LSX-2026-0003',
    order_codes: ['DH-03'],
    customer_name: 'VIETECO',
    materials_due_at: null,
  },
]

describe('groupPosByLsx', () => {
  it('gom đơn về đúng lệnh và cộng sẵn số liệu đầu nhóm', () => {
    const { groups } = groupPosByLsx(
      [
        po({
          code: 'PO-1',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 1000,
          status: 'pending_approval',
        }),
        po({
          code: 'PO-2',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 500,
          status: 'received',
        }),
      ],
      LSXS,
      TODAY,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].pos.map((p) => p.code)).toEqual(['PO-1', 'PO-2'])
    expect(groups[0].total).toBe(1500)
    expect(groups[0].pending).toBe(1)
    expect(groups[0].received).toBe(1)
    // Tên khách không nằm trên đơn — phải lấy từ danh sách LSX.
    expect(groups[0].customer_name).toBe('MERXX')
  })

  it('KHÔNG cộng đơn đã huỷ vào tiền của nhóm', () => {
    const { groups } = groupPosByLsx(
      [
        po({
          code: 'PO-1',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 1000,
        }),
        po({
          code: 'PO-2',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 900,
          status: 'cancelled',
        }),
      ],
      LSXS,
      TODAY,
    )
    expect(groups[0].total).toBe(1000)
    expect(groups[0].cancelled).toBe(1)
  })

  it('KHÔNG cộng lẫn đơn khác loại tiền', () => {
    const { groups } = groupPosByLsx(
      [
        po({
          code: 'PO-1',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 1000,
        }),
        po({
          code: 'PO-2',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          total: 50,
          currency: 'USD',
        }),
      ],
      LSXS,
      TODAY,
    )
    // 50 USD cộng thẳng vào 1.000 VND ra 1.050 — con số vô nghĩa mà nhìn như thật.
    expect(groups[0].total).toBe(1000)
    expect(groups[0].currency).toBe('VND')
  })

  it('đếm đơn quá hẹn giao', () => {
    const { groups } = groupPosByLsx(
      [
        po({
          code: 'PO-1',
          production_order_id: 'l1',
          lsx_code: 'LSX-2026-0001',
          expected_at: '2026-07-01',
          status: 'ordered',
        }),
      ],
      LSXS,
      TODAY,
    )
    expect(groups[0].late).toBe(1)
  })

  it('tách riêng đơn ngoài LSX', () => {
    const { groups, standalone } = groupPosByLsx(
      [po({ code: 'PO-9', total: 300 })],
      LSXS,
      TODAY,
    )
    expect(groups).toHaveLength(0)
    expect(standalone.pos.map((p) => p.code)).toEqual(['PO-9'])
    expect(standalone.total).toBe(300)
  })

  it('nêu tên LSX đang chạy mà CHƯA có đơn nào', () => {
    const { emptyLsxs } = groupPosByLsx(
      [po({ code: 'PO-1', production_order_id: 'l2', lsx_code: 'LSX-2026-0002' })],
      LSXS,
      TODAY,
    )
    expect(emptyLsxs.map((l) => l.code)).toEqual(['LSX-2026-0001', 'LSX-2026-0003'])
  })

  it('LSX mới nhất xếp trước', () => {
    const { groups } = groupPosByLsx(
      [
        po({ code: 'PO-1', production_order_id: 'l1', lsx_code: 'LSX-2026-0001' }),
        po({ code: 'PO-2', production_order_id: 'l3', lsx_code: 'LSX-2026-0003' }),
        po({ code: 'PO-3', production_order_id: 'l2', lsx_code: 'LSX-2026-0002' }),
      ],
      LSXS,
      TODAY,
    )
    expect(groups.map((g) => g.lsx_code)).toEqual([
      'LSX-2026-0003',
      'LSX-2026-0002',
      'LSX-2026-0001',
    ])
  })

  it('đơn cũ chỉ còn mã LSX vẫn gom đúng một nhóm', () => {
    const { groups } = groupPosByLsx(
      [
        po({ code: 'PO-1', lsx_code: 'LSX-2025-0009', total: 100 }),
        po({ code: 'PO-2', lsx_code: 'LSX-2025-0009', total: 200 }),
      ],
      LSXS,
      TODAY,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].total).toBe(300)
  })
})

describe('đơn gộp nhiều lệnh (0125)', () => {
  /** Một đơn của lệnh 1, mua hộ cả lệnh 2 và 3 — đơn thật ghi "LSX 1+2+3". */
  const merged = po({
    code: 'PO-GOP',
    production_order_id: 'l1',
    lsx_code: 'LSX-2026-0001',
    order_code: 'DH-01',
    total: 9_000_000,
    status: 'pending_approval',
    lines_done: 1,
    lines_total: 4,
    extra_lsx: [
      { id: 'l2', code: 'LSX-2026-0002' },
      { id: 'l3', code: 'LSX-2026-0003' },
    ],
  })

  it('hiện ở CẢ ba lệnh, không riêng lệnh chính', () => {
    const { groups } = groupPosByLsx([merged], LSXS, TODAY)
    expect(groups.map((g) => g.key).sort()).toEqual(['l1', 'l2', 'l3'])
    for (const g of groups) expect(g.pos.map((p) => p.code)).toEqual(['PO-GOP'])
  })

  it('lệnh phụ KHÔNG còn bị báo "chưa có đơn đặt nào"', () => {
    const { emptyLsxs } = groupPosByLsx([merged], LSXS, TODAY)
    expect(emptyLsxs).toEqual([])
  })

  it('TIỀN chỉ cộng một lần, ở lệnh chính — không nhân ba tổng chi', () => {
    const { groups } = groupPosByLsx([merged], LSXS, TODAY)
    const by = new Map(groups.map((g) => [g.key, g]))
    expect(by.get('l1')!.total).toBe(9_000_000)
    expect(by.get('l2')!.total).toBe(0)
    expect(by.get('l3')!.total).toBe(0)
  })

  it('đánh dấu đơn MƯỢN ở lệnh phụ, không đánh dấu ở lệnh chính', () => {
    const { groups } = groupPosByLsx([merged], LSXS, TODAY)
    const by = new Map(groups.map((g) => [g.key, g]))
    expect(by.get('l1')!.borrowed.has('PO-GOP')).toBe(false)
    expect(by.get('l2')!.borrowed.has('PO-GOP')).toBe(true)
  })

  it('việc còn dở vẫn tính cho lệnh phụ — vật tư chưa về thì lệnh đó cũng kẹt', () => {
    const { groups } = groupPosByLsx([merged], LSXS, TODAY)
    const l2 = groups.find((g) => g.key === 'l2')!
    expect(l2.pending).toBe(1)
    expect(l2.linesDone).toBe(1)
    expect(l2.linesTotal).toBe(4)
  })

  it('thẻ lệnh phụ không mượn mã đơn hàng của lệnh chính', () => {
    const { groups } = groupPosByLsx([merged], LSXS, TODAY)
    const by = new Map(groups.map((g) => [g.key, g]))
    expect(by.get('l1')!.order_code).toBe('DH-01')
    // Lấy từ chính LSX-2026-0002, không phải DH-01 của lệnh 1.
    expect(by.get('l2')!.order_code).toBe('DH-02')
    expect(by.get('l2')!.customer_name).toBe('YOTRIO')
  })

  it('lệnh phụ trùng lệnh chính thì không xếp hai lần', () => {
    const odd = po({
      code: 'PO-X',
      production_order_id: 'l1',
      lsx_code: 'LSX-2026-0001',
      extra_lsx: [{ id: 'l1', code: 'LSX-2026-0001' }],
    })
    const { groups } = groupPosByLsx([odd], LSXS, TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].pos).toHaveLength(1)
  })
})
