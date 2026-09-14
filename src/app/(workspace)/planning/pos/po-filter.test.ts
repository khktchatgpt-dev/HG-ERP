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

  describe('lọc theo lệnh sản xuất', () => {
    it('giữ đơn của đúng lệnh, loại đơn của lệnh khác', () => {
      expect(poMatches(po(), f({ lsxId: 'lsx1' }), ctx)).toBe(true)
      expect(poMatches(po(), f({ lsxId: 'lsx9' }), ctx)).toBe(false)
    })

    it('ĐƠN GỘP lọt khi lọc theo lệnh PHỤ của nó', () => {
      /*
        Đây là ca dễ sai nhất và là lý do nhánh lọc phải xét `extra_lsx`
        (0125 — một đơn mua chung cho nhiều lệnh). Chỉ so
        `production_order_id` thì đơn mua chung biến mất khỏi lệnh nó đang
        phục vụ, và người mua kết luận nhầm rằng lệnh đó chưa đặt gì.
      */
      const gop = po({
        production_order_id: 'lsx1',
        extra_lsx: [{ id: 'lsx2', code: '03/26-27' }],
      })
      expect(poMatches(gop, f({ lsxId: 'lsx2' }), ctx)).toBe(true)
      expect(poMatches(gop, f({ lsxId: 'lsx3' }), ctx)).toBe(false)
    })

    it('đơn ngoài lệnh rớt khi lọc theo bất kỳ lệnh nào', () => {
      const ngoai = po({ production_order_id: null, lsx_code: null })
      expect(poMatches(ngoai, f({ lsxId: 'lsx1' }), ctx)).toBe(false)
      // …nhưng vẫn lọt khi KHÔNG lọc lệnh.
      expect(poMatches(ngoai, EMPTY_FILTER, ctx)).toBe(true)
    })

    it('đếm là bộ lọc đang hoạt động — nếu không nút "Bỏ lọc" không hiện ra', () => {
      expect(isFilterActive(f({ lsxId: 'lsx1' }))).toBe(true)
      expect(isFilterActive(f({ lsxId: 'all' }))).toBe(false)
    })
  })

  describe('lọc theo khoảng ngày lập đơn', () => {
    const p1 = po({ created_at: '2026-08-01T09:00:00+00:00' })

    it('hai đầu BAO GỒM ngày biên — gõ "đến 01/08" thì đơn ngày 01/08 phải lọt', () => {
      expect(poMatches(p1, f({ fromDate: '2026-08-01' }), ctx)).toBe(true)
      expect(poMatches(p1, f({ toDate: '2026-08-01' }), ctx)).toBe(true)
      expect(poMatches(p1, f({ fromDate: '2026-08-01', toDate: '2026-08-01' }), ctx)).toBe(true) // prettier-ignore
    })

    it('ngoài khoảng thì rớt', () => {
      expect(poMatches(p1, f({ fromDate: '2026-08-02' }), ctx)).toBe(false)
      expect(poMatches(p1, f({ toDate: '2026-07-31' }), ctx)).toBe(false)
    })

    it('chỉ khai một đầu thì đầu kia không chặn', () => {
      expect(poMatches(p1, f({ fromDate: '2026-01-01' }), ctx)).toBe(true)
      expect(poMatches(p1, f({ toDate: '2026-12-31' }), ctx)).toBe(true)
    })

    it('so CHUỖI, không parse Date — giờ trong ngày không đẩy đơn sang ngày khác', () => {
      // 23:30 giờ UTC vẫn phải nằm trong ngày 01/08 khi lọc theo chuỗi.
      const khuya = po({ created_at: '2026-08-01T23:30:00+00:00' })
      expect(poMatches(khuya, f({ fromDate: '2026-08-01', toDate: '2026-08-01' }), ctx)).toBe(true) // prettier-ignore
    })

    it('là bộ lọc đang hoạt động — nếu không nút "Bỏ lọc" không hiện', () => {
      expect(isFilterActive(f({ fromDate: '2026-08-01' }))).toBe(true)
      expect(isFilterActive(f({ toDate: '2026-08-01' }))).toBe(true)
      expect(isFilterActive(f({ fromDate: '', toDate: '' }))).toBe(false)
    })
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
    // Đơn CHỜ DUYỆT quá hẹn là lỗi của mình, không phải NCC trễ (tách 05/09/2026).
    expect(c.late).toBe(0)
    expect(c.lateUnsent).toBe(1)
    // Đơn đã huỷ trống ngày KHÔNG tính là "chưa hẹn giao".
    expect(c.noEta).toBe(1)
  })

  it('chỉ đơn ĐÃ GỬI mà quá hẹn mới là NCC trễ', () => {
    const c = countPos(
      [
        po({ id: '1', status: 'ordered', expected_at: '2026-08-01' }),
        po({ id: '2', status: 'draft', expected_at: '2026-08-01' }),
      ],
      null,
      TODAY,
    )
    expect(c.late).toBe(1)
    expect(c.lateUnsent).toBe(1)
  })
})
