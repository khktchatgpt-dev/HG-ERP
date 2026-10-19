import { describe, expect, it } from 'vitest'
import { bangCongQuerySchema, keoSchema, nhanVienTuyenSchema } from './cham-cong.schema'

describe('keoSchema', () => {
  it('nhận khoảng ngày ISO', () => {
    expect(keoSchema.safeParse({ tu: '2026-09-01', den: '2026-09-07' }).success).toBe(
      true,
    )
    expect(keoSchema.safeParse({ tu: '2026-09-07', den: '2026-09-07' }).success).toBe(
      true,
    )
  })
  it('chặn ngày sai dạng, đến trước từ, quá 1 năm', () => {
    expect(keoSchema.safeParse({ tu: '01/09/2026', den: '2026-09-07' }).success).toBe(
      false,
    )
    expect(keoSchema.safeParse({ tu: '2026-09-07', den: '2026-09-01' }).success).toBe(
      false,
    )
    expect(keoSchema.safeParse({ tu: '2025-01-01', den: '2026-09-01' }).success).toBe(
      false,
    )
  })
})

describe('bangCongQuerySchema', () => {
  it('chỉ nhận YYYY-MM', () => {
    expect(bangCongQuerySchema.safeParse({ thang: '2026-09' }).success).toBe(true)
    expect(bangCongQuerySchema.safeParse({ thang: '2026-13' }).success).toBe(false)
  })
})

describe('tuyển vào (0248)', () => {
  const base = {
    full_name: 'Nguyễn Văn An',
    hire_date: '2026-10-01',
    team: 'Tổ Phôi',
    shift_id: '60d43a48-6c4f-4e6f-9469-33ff4a73e464',
  }
  it('mã số trên máy, bỏ số 0 đầu', () => {
    const v = nhanVienTuyenSchema.parse({ ...base, khong_cham: false, code: '0604' })
    expect(v.code).toBe('604')
  })
  it('không chấm công thì không cần mã; quẹt máy mà thiếu mã thì chặn', () => {
    expect(nhanVienTuyenSchema.safeParse({ ...base, khong_cham: true }).success).toBe(
      true,
    )
    expect(nhanVienTuyenSchema.safeParse({ ...base, khong_cham: false }).success).toBe(
      false,
    )
    expect(
      nhanVienTuyenSchema.safeParse({ ...base, khong_cham: false, code: 'KCC-1' })
        .success,
    ).toBe(false)
  })
})
