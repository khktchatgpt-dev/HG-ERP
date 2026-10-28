import { describe, expect, it } from 'vitest'
import { luiThang, tuKhoaDanhMuc } from './tra-gia.service'
import { traGiaSchema } from './tra-gia.schema'

describe('luiThang — mốc đầu kỳ giá', () => {
  it('lùi theo lịch, giữ ngày', () => {
    expect(luiThang('2026-10-28', 6)).toBe('2026-04-28')
    expect(luiThang('2026-02-15', 3)).toBe('2025-11-15')
  })
  it('ngày không có ở tháng đích thì kẹp về cuối tháng', () => {
    expect(luiThang('2026-08-31', 6)).toBe('2026-02-28')
  })
})

describe('traGiaSchema', () => {
  it('kỳ mặc định 6 tháng; chữ món được cắt khoảng trắng', () => {
    const r = traGiaSchema.parse({ items: [{ text: '  nhôm phi 25 x1.0 ', sl: 650 }] })
    expect(r.thang).toBe(6)
    expect(r.items[0].text).toBe('nhôm phi 25 x1.0')
  })
  it('chặn danh sách rỗng, món trống, kỳ lạ', () => {
    expect(traGiaSchema.safeParse({ items: [] }).success).toBe(false)
    expect(traGiaSchema.safeParse({ items: [{ text: '   ' }] }).success).toBe(false)
    expect(traGiaSchema.safeParse({ items: [{ text: 'a' }], thang: 5 }).success).toBe(
      false,
    )
  })
})

describe('tuKhoaDanhMuc — nới dần từ khoá khi hỏi danh mục', () => {
  it('bỏ chữ đệm và số độ dày / kích cỡ lẻ, cuối cùng còn hai chữ đầu', () => {
    expect(tuKhoaDanhMuc('inox hộp 20x20 dày 1.0')).toEqual([
      'inox hộp 20x20 dày 1.0',
      'inox hộp 20x20',
      'inox hộp',
    ])
    expect(tuKhoaDanhMuc('bản lề âm 35mm')).toEqual([
      'bản lề âm 35mm',
      'bản lề âm',
      'bản lề',
    ])
  })
  it('không lặp lại từ khoá trùng', () => {
    expect(tuKhoaDanhMuc('bulon')).toEqual(['bulon'])
  })
})
