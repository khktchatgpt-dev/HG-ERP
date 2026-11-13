import { describe, expect, it } from 'vitest'
import { chotKySchema } from './nxt.schema'

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
