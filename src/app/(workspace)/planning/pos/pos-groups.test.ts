import { describe, expect, it } from 'vitest'
import { groupPosByLsx, type LsxRef } from './pos-groups'
import type { Po } from './PosManager'

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
  { id: 'l1', code: 'LSX-2026-0001', order_codes: ['DH-01'], customer_name: 'MERXX' },
  { id: 'l2', code: 'LSX-2026-0002', order_codes: ['DH-02'], customer_name: 'YOTRIO' },
  { id: 'l3', code: 'LSX-2026-0003', order_codes: ['DH-03'], customer_name: 'VIETECO' },
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
