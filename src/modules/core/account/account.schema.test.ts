import { describe, it, expect } from 'vitest'
import { accountPasswordSchema, accountProfileSchema } from './account.schema'

describe('accountProfileSchema', () => {
  it('ô SĐT để trống → null (xoá số cũ), không phải chuỗi rỗng', () => {
    expect(accountProfileSchema.parse({ phone: '' })).toEqual({ phone: null })
  })

  it('nhận số nội bộ / có đầu số nước ngoài / hai số cách nhau', () => {
    for (const phone of ['0905123456', '+84 256 3847 123', '0905123456, 0912000111']) {
      expect(accountProfileSchema.parse({ phone })).toEqual({ phone })
    }
  })

  it('chặn ký tự rác trong SĐT', () => {
    expect(accountProfileSchema.safeParse({ phone: 'gọi số máy bàn' }).success).toBe(
      false,
    )
  })

  it('họ tên trống là lỗi, không phải xoá tên', () => {
    expect(accountProfileSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('bỏ qua trường không gửi lên (patch từng phần)', () => {
    expect(accountProfileSchema.parse({})).toEqual({})
  })
})

describe('accountPasswordSchema', () => {
  const ok = { current_password: 'cu-rich-123', new_password: 'moi-toanh-456' }

  it('nhận cặp mật khẩu hợp lệ', () => {
    expect(accountPasswordSchema.parse(ok)).toEqual(ok)
  })

  it('chặn đặt lại đúng mật khẩu đang dùng', () => {
    const res = accountPasswordSchema.safeParse({
      current_password: 'trung-nhau-123',
      new_password: 'trung-nhau-123',
    })
    expect(res.success).toBe(false)
  })

  it('mật khẩu mới dưới 8 ký tự bị chặn', () => {
    expect(
      accountPasswordSchema.safeParse({ ...ok, new_password: 'ngan12' }).success,
    ).toBe(false)
  })
})
