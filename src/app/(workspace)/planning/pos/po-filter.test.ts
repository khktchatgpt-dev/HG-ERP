import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTER,
  PO_BUCKETS,
  bucketOf,
  countPos,
  isFilterActive,
  poMatches,
  type PoFilterState,
} from './po-filter'
import { PO_STATUSES } from '@/lib/po-status'
import type { Po } from './po-types'

const TODAY = '2026-08-11'

function po(over: Partial<Po> = {}): Po {
  return {
    id: over.id ?? 'p1',
    code: 'PO-2026-0001',
    production_order_id: 'lsx1',
    supplier_id: 's1',
    status: 'draft',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    expected_at: '2026-09-01',
    terms: null,
    note: null,
    created_at: '2026-08-01',
    supplier_name: 'Nhôm Tiến Đạt',
    lsx_code: '02/26-27',
    order_code: '17984 HG-MX',
    ...over,
  }
}

const ctx = { meId: 'u1', today: TODAY }
const f = (over: Partial<PoFilterState> = {}): PoFilterState => ({
  ...EMPTY_FILTER,
  ...over,
})

describe('nhóm vòng đời', () => {
  it('phủ hết 9 trạng thái, không trạng thái nào lọt ra ngoài', () => {
    for (const s of PO_STATUSES) expect(bucketOf(s)).not.toBeNull()
  })

  it('không trạng thái nào nằm ở hai nhóm', () => {
    const seen = new Set<string>()
    for (const b of PO_BUCKETS)
      for (const s of b.statuses) {
        expect(seen.has(s)).toBe(false)
        seen.add(s)
      }
  })

  it('"đã duyệt · chưa gửi" tách riêng khỏi "đang về" — đây là chỗ đơn hay nằm im', () => {
    expect(bucketOf('approved')).toBe('ready')
    expect(bucketOf('ordered')).toBe('inflight')
  })
})

describe('poMatches — công tắc cộng dồn với nhóm', () => {
  it('lọc theo nhóm', () => {
    expect(poMatches(po({ status: 'draft' }), f({ bucket: 'draft' }), ctx)).toBe(true)
    expect(poMatches(po({ status: 'approved' }), f({ bucket: 'draft' }), ctx)).toBe(false)
  })

  it('CHỜ DUYỆT ĐANG QUÁ HẸN — câu hỏi bản cũ không hỏi được', () => {
    const overdue = po({ status: 'pending_approval', expected_at: '2026-08-01' })
    const onTime = po({ status: 'pending_approval', expected_at: '2026-12-01' })
    const filter = f({ bucket: 'pending', late: true })
    expect(poMatches(overdue, filter, ctx)).toBe(true)
    expect(poMatches(onTime, filter, ctx)).toBe(false)
  })

  it('"của tôi" xét theo người phụ trách, không phải người tạo', () => {
    expect(poMatches(po({ assigned_to: 'u1' }), f({ mine: true }), ctx)).toBe(true)
    expect(poMatches(po({ assigned_to: 'u2' }), f({ mine: true }), ctx)).toBe(false)
    expect(poMatches(po({ assigned_to: null }), f({ mine: true }), ctx)).toBe(false)
  })

  it('chưa hẹn giao: chỉ tính đơn còn sống (đơn đã huỷ không kêu)', () => {
    const open = po({ status: 'approved', expected_at: null })
    const cancelled = po({ status: 'cancelled', expected_at: null })
    expect(poMatches(open, f({ noEta: true }), ctx)).toBe(true)
    expect(poMatches(cancelled, f({ noEta: true }), ctx)).toBe(false)
  })

  it('lọc NCC / loại đơn / ô tìm', () => {
    expect(poMatches(po(), f({ supplierId: 's2' }), ctx)).toBe(false)
    expect(poMatches(po({ lsx_code: null }), f({ type: 'lsx' }), ctx)).toBe(false)
    expect(poMatches(po({ lsx_code: null }), f({ type: 'standalone' }), ctx)).toBe(true)
    expect(poMatches(po(), f({ q: 'tiến đạt' }), ctx)).toBe(true)
    // Tìm được cả bằng MÃ ĐƠN HÀNG của khách — Sale hay hỏi ngược từ phía đó.
    expect(poMatches(po(), f({ q: '17984' }), ctx)).toBe(true)
    expect(poMatches(po(), f({ q: 'xyz' }), ctx)).toBe(false)
  })

  it('bộ lọc rỗng thì mọi đơn đều lọt', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    for (const s of PO_STATUSES)
      expect(poMatches(po({ status: s }), EMPTY_FILTER, ctx)).toBe(true)
  })
})

describe('countPos — số trên chip', () => {
  it('đếm theo nhóm và theo từng công tắc', () => {
    const rows = [
      po({ id: '1', status: 'draft', assigned_to: 'u1' }),
      po({ id: '2', status: 'pending_approval', expected_at: '2026-08-01' }),
      po({ id: '3', status: 'approved', expected_at: null }),
      po({ id: '4', status: 'ordered' }),
      po({ id: '5', status: 'received' }),
      po({ id: '6', status: 'cancelled', expected_at: null }),
    ]
    const c = countPos(rows, 'u1', TODAY)
    expect(c.all).toBe(6)
    expect(c.draft).toBe(1)
    expect(c.pending).toBe(1)
    expect(c.ready).toBe(1)
    expect(c.inflight).toBe(1)
    expect(c.received).toBe(1)
    expect(c.cancelled).toBe(1)
    expect(c.mine).toBe(1)
    expect(c.late).toBe(1)
    // Đơn đã huỷ trống ngày KHÔNG tính là "chưa hẹn giao".
    expect(c.noEta).toBe(1)
  })
})
