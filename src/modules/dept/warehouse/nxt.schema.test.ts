import { describe, expect, it } from 'vitest'
import { chotKySchema, moLaiKySchema } from './nxt.schema'

describe('chotKySchema', () => {
  it('nhận tháng YYYY-MM và khoá lưu ý đúng dạng', () => {
    expect(
      chotKySchema.parse({ thang: '2026-10', luu_y: ['lenh:2026-10', 'gia:2026-09', 'tygia:2026-10'] }), // prettier-ignore
    ).toEqual({ thang: '2026-10', luu_y: ['lenh:2026-10', 'gia:2026-09', 'tygia:2026-10'] })
  })

  it('từ chối tháng sai dạng và khoá lạ', () => {
    expect(chotKySchema.safeParse({ thang: '2026-13', luu_y: [] }).success).toBe(false)
    expect(chotKySchema.safeParse({ thang: '2026-10-01', luu_y: [] }).success).toBe(false)
    expect(chotKySchema.safeParse({ thang: '2026-10', luu_y: ['xoa:2026-10'] }).success).toBe(false)
  })
})

describe('moLaiKySchema', () => {
  it('bắt lý do ≥ 10 ký tự sau khi cắt khoảng trắng', () => {
    expect(moLaiKySchema.parse({ thang: '2026-10', ly_do: '  ghi bù phiếu xuất lệnh 09-MX  ' })).toEqual({ thang: '2026-10', ly_do: 'ghi bù phiếu xuất lệnh 09-MX' }) // prettier-ignore
    expect(moLaiKySchema.safeParse({ thang: '2026-10', ly_do: '   ngắn    ' }).success).toBe(false)
    expect(moLaiKySchema.safeParse({ thang: '10/2026', ly_do: 'đủ dài để qua ngưỡng' }).success).toBe(false) // prettier-ignore
  })
})
