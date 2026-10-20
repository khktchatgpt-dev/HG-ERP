import { describe, expect, it } from 'vitest'
import { stampNote } from './po-note'

describe('stampNote — vết lý do trên ghi chú đơn', () => {
  it('đơn chưa có ghi chú thì vết là cả ghi chú', () => {
    expect(stampNote('Huỷ', 'NCC báo hết hàng', null)).toBe('[Huỷ] NCC báo hết hàng')
  })

  /**
   * ĐÂY LÀ CA CANH LỐI MÒN #2. Trước khi có hàm này, `decide('reject')` ghi đè
   * `note` nên câu người soạn viết cho Kho biến mất khi Giám đốc từ chối.
   */
  it('KHÔNG BAO GIỜ ghi đè ghi chú cũ — vết mới lên đầu, cũ xuống dưới', () => {
    expect(stampNote('Từ chối', 'Giá cao hơn báo giá', 'Giao cổng B, gọi bác Tư')).toBe(
      '[Từ chối] Giá cao hơn báo giá\nGiao cổng B, gọi bác Tư',
    )
  })

  it('nhiều lượt thì xếp lớp, đọc từ trên xuống là ra lịch sử', () => {
    const l1 = stampNote('Từ chối', 'thiếu báo giá', 'Giao cổng B')
    const l2 = stampNote('Huỷ', 'lệnh SX bị huỷ', l1)
    expect(l2?.split('\n')).toEqual([
      '[Huỷ] lệnh SX bị huỷ',
      '[Từ chối] thiếu báo giá',
      'Giao cổng B',
    ])
  })

  it('lý do trống thì giữ nguyên ghi chú cũ, không đóng nhãn rỗng', () => {
    expect(stampNote('Từ chối', '', 'Giao cổng B')).toBe('Giao cổng B')
    expect(stampNote('Từ chối', '   ', 'Giao cổng B')).toBe('Giao cổng B')
    expect(stampNote('Từ chối', undefined, 'Giao cổng B')).toBe('Giao cổng B')
  })

  it('không ghi chú cũ mà lý do cũng trống thì null, không phải chuỗi rỗng', () => {
    expect(stampNote('Huỷ', null, null)).toBeNull()
    // Ghi chú cũ chỉ có khoảng trắng cũng coi như trống — đừng dựng vết trên nó.
    expect(stampNote('Huỷ', null, '   ')).toBeNull()
  })

  it('cắt khoảng trắng thừa cả hai đầu', () => {
    expect(stampNote('Huỷ', '  hết hàng  ', '  Giao cổng B  ')).toBe(
      '[Huỷ] hết hàng\nGiao cổng B',
    )
  })
})
