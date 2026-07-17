import { describe, expect, it } from 'vitest'
import {
  loanCreateSchema,
  sampleCreateSchema,
  sampleStatusSchema,
} from './samples.schema'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('loanCreateSchema — người mượn đa hình', () => {
  it('mượn kiểu user phải có borrower_user_id', () => {
    const bad = loanCreateSchema.safeParse({ borrower_kind: 'user' })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['borrower_user_id'])

    const ok = loanCreateSchema.safeParse({
      borrower_kind: 'user',
      borrower_user_id: uuid,
    })
    expect(ok.success).toBe(true)
  })

  it('mượn kiểu customer phải có borrower_customer_id', () => {
    expect(loanCreateSchema.safeParse({ borrower_kind: 'customer' }).success).toBe(false)
    expect(
      loanCreateSchema.safeParse({
        borrower_kind: 'customer',
        borrower_customer_id: uuid,
      }).success,
    ).toBe(true)
  })

  it('đối tác ngoài phải nhập tên — không có FK nào để suy ra', () => {
    expect(loanCreateSchema.safeParse({ borrower_kind: 'other' }).success).toBe(false)
    expect(
      loanCreateSchema.safeParse({ borrower_kind: 'other', borrower_name: 'Cty ABC' })
        .success,
    ).toBe(true)
  })

  it('gửi nhầm id của loại khác không lách được ràng buộc', () => {
    // Khai 'user' nhưng chỉ đưa customer_id → vẫn phải trượt.
    const r = loanCreateSchema.safeParse({
      borrower_kind: 'user',
      borrower_customer_id: uuid,
    })
    expect(r.success).toBe(false)
  })

  it('loại người mượn lạ bị chặn', () => {
    expect(loanCreateSchema.safeParse({ borrower_kind: 'supplier' }).success).toBe(false)
  })
})

describe('sampleStatusSchema', () => {
  it('KHÔNG cho đặt tay sang on_loan — chỉ ghi phiếu mượn mới vào được', () => {
    // Nếu lọt, `status` sẽ trôi khỏi sổ mượn: mẫu hiện "đang cho mượn" mà không
    // có phiếu nào, không biết ai cầm.
    expect(sampleStatusSchema.safeParse({ status: 'on_loan' }).success).toBe(false)
  })

  it('cho các trạng thái thủ công hợp lệ', () => {
    for (const s of ['in_showroom', 'maintenance', 'lost', 'disposed']) {
      expect(sampleStatusSchema.safeParse({ status: s }).success).toBe(true)
    }
  })
})

describe('sampleCreateSchema', () => {
  it('mặc định 1 hiện vật, tình trạng tốt', () => {
    const r = sampleCreateSchema.parse({ product_id: uuid })
    expect(r.quantity).toBe(1)
    expect(r.condition).toBe('good')
  })

  it('tạo hàng loạt bị chặn trên 20 — tránh lỡ tay sinh 1000 mã', () => {
    expect(sampleCreateSchema.safeParse({ product_id: uuid, quantity: 21 }).success).toBe(
      false,
    )
    expect(sampleCreateSchema.safeParse({ product_id: uuid, quantity: 0 }).success).toBe(
      false,
    )
    expect(sampleCreateSchema.safeParse({ product_id: uuid, quantity: 20 }).success).toBe(
      true,
    )
  })
})
