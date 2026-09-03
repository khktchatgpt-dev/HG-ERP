import { describe, expect, it } from 'vitest'
import { groupGateError } from './material-group-gate'

const KNOWN = ['Sắt thép - tôn - tấm', 'Nhôm định hình - tấm', 'Inox']

describe('groupGateError — nhóm chính là danh sách chốt', () => {
  it('nhóm có trong danh mục → qua', () => {
    expect(groupGateError(KNOWN, 'Inox')).toBeNull()
    expect(groupGateError(KNOWN, '  Nhôm định hình - tấm ')).toBeNull()
  })

  it('bỏ trống nhóm vẫn được — chặn cái sai, không ép cái thiếu', () => {
    expect(groupGateError(KNOWN, null)).toBeNull()
    expect(groupGateError(KNOWN, undefined)).toBeNull()
    expect(groupGateError(KNOWN, '   ')).toBeNull()
  })

  it('nhóm lạ → câu lỗi chỉ đường sang Quản lý nhóm', () => {
    const msg = groupGateError(KNOWN, 'Sắt thép')
    expect(msg).toMatch(/không có trong danh mục/)
    expect(msg).toMatch(/Quản lý nhóm/)
  })

  it('gõ lệch hoa/thường → gợi ý đúng nhãn thay vì bắt đoán', () => {
    expect(groupGateError(KNOWN, 'inox')).toMatch(/ý bạn là "Inox"/)
    expect(groupGateError(KNOWN, 'SẮT THÉP - TÔN - TẤM')).toMatch(
      /"Sắt thép - tôn - tấm"/,
    )
  })
})
