import { describe, it, expect } from 'vitest'
import { quoteCreateSchema, quoteListQuerySchema } from './quotes.schema'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'

describe('quoteCreateSchema', () => {
  it('parse OK: báo giá XK đủ trường mẫu in (valid date, FOB, L/C) — không có SL', () => {
    const p = quoteCreateSchema.parse({
      customer_id: UUID,
      currency: 'usd',
      valid_from: '2026-03-18',
      valid_to: '2026-06-18',
      price_term: 'FOB Quy Nhon',
      payment_terms: 'L/C at sight',
      lines: [
        { product_id: UUID, unit_price: '301.72', note: '1 set/ctn' },
        { product_id: UUID2, unit_price: 60 },
      ],
    })
    expect(p.currency).toBe('USD') // tự uppercase
    expect(p.lines[0].unit_price).toBe(301.72)
    // Báo giá không còn khái niệm số lượng.
    expect('qty' in p.lines[0]).toBe(false)
  })

  it('currency mặc định USD (bán B2B xuất khẩu); lines mặc định rỗng', () => {
    const p = quoteCreateSchema.parse({ customer_id: UUID })
    expect(p.currency).toBe('USD')
    expect(p.lines).toEqual([])
  })

  it('chiết khấu %: nhận 0–100 (coerce), từ chối ngoài khoảng', () => {
    const p = quoteCreateSchema.parse({
      customer_id: UUID,
      lines: [{ product_id: UUID, unit_price: 10, discount_pct: '12.5' }],
    })
    expect(p.lines[0].discount_pct).toBe(12.5)
    // không gửi → undefined (không chiết khấu)
    const p2 = quoteCreateSchema.parse({
      customer_id: UUID,
      lines: [{ product_id: UUID, unit_price: 10 }],
    })
    expect(p2.lines[0].discount_pct).toBeUndefined()
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [{ product_id: UUID, unit_price: 10, discount_pct: 101 }],
      }),
    ).toThrow()
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [{ product_id: UUID, unit_price: 10, discount_pct: -5 }],
      }),
    ).toThrow()
  })

  it('từ chối đơn giá âm', () => {
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [{ product_id: UUID, unit_price: -1 }],
      }),
    ).toThrow()
  })

  it('từ chối SP trùng dòng', () => {
    expect(() =>
      quoteCreateSchema.parse({
        customer_id: UUID,
        lines: [
          { product_id: UUID, unit_price: 1 },
          { product_id: UUID, unit_price: 2 },
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

describe('quoteListQuerySchema', () => {
  it('lọc theo trạng thái + khách', () => {
    const p = quoteListQuerySchema.parse({ status: 'sent', customer_id: UUID })
    expect(p.status).toBe('sent')
    expect(p.page).toBe(1)
  })

  it('từ chối status lạ', () => {
    expect(() => quoteListQuerySchema.parse({ status: 'done' })).toThrow()
  })
})
