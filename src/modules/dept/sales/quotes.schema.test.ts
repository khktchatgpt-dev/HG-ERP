import { describe, it, expect } from 'vitest'
import {
  quoteCreateSchema,
  quoteDecideSchema,
  quoteListQuerySchema,
} from './quotes.schema'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'

describe('quoteCreateSchema', () => {
  it('parse OK: báo giá XK đủ trường mẫu in (valid date, FOB, L/C)', () => {
    const p = quoteCreateSchema.parse({
      customer_id: UUID,
      currency: 'usd',
      valid_from: '2026-03-18',
      valid_to: '2026-06-18',
      price_term: 'FOB Quy Nhon',
      payment_terms: 'L/C at sight',
      lines: [
        { product_id: UUID, qty: '48', unit_price: '301.72', note: '1 set/ctn' },
        { product_id: UUID2, qty: 11, unit_price: 60 },
      ],
    })
    expect(p.currency).toBe('USD') // tự uppercase
    expect(p.lines[0].qty).toBe(48)
    expect(p.lines[0].unit_price).toBe(301.72)
  })

  it('currency mặc định USD (bán B2B xuất khẩu); lines mặc định rỗng', () => {
    const p = quoteCreateSchema.parse({ customer_id: UUID })
    expect(p.currency).toBe('USD')
    expect(p.lines).toEqual([])
  })

  it('từ chối SL ≤ 0 và đơn giá âm', () => {
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [{ product_id: UUID, qty: 0, unit_price: 10 }],
      }),
    ).toThrow()
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [{ product_id: UUID, qty: 1, unit_price: -1 }],
      }),
    ).toThrow()
  })

  it('từ chối SP trùng dòng', () => {
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [
          { product_id: UUID, qty: 1, unit_price: 1 },
          { product_id: UUID, qty: 2, unit_price: 2 },
        ],
      }),
    ).toThrow()
  })

  it('từ chối hiệu lực ngược (from > to)', () => {
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        valid_from: '2026-06-18',
        valid_to: '2026-03-18',
      }),
    ).toThrow()
  })
})

describe('quoteDecideSchema (BR-04 — GĐ duyệt)', () => {
  it('approve không cần lý do', () => {
    expect(quoteDecideSchema.parse({ decision: 'approve' }).decision).toBe('approve')
  })

  it('reject BẮT BUỘC kèm lý do', () => {
    expect(() => quoteDecideSchema.parse({ decision: 'reject' })).toThrow()
    expect(() => quoteDecideSchema.parse({ decision: 'reject', reason: '' })).toThrow()
    const p = quoteDecideSchema.parse({
      decision: 'reject',
      reason: 'Giá chưa duyệt được',
    })
    expect(p.reason).toBe('Giá chưa duyệt được')
  })

  it('từ chối decision lạ', () => {
    expect(() => quoteDecideSchema.parse({ decision: 'maybe' })).toThrow()
  })
})

describe('quoteListQuerySchema', () => {
  it('lọc theo trạng thái + khách', () => {
    const p = quoteListQuerySchema.parse({ status: 'pending', customer_id: UUID })
    expect(p.status).toBe('pending')
    expect(p.page).toBe(1)
  })

  it('từ chối status lạ', () => {
    expect(() => quoteListQuerySchema.parse({ status: 'done' })).toThrow()
  })
})
