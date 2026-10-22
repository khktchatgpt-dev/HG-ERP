import { describe, expect, it } from 'vitest'
import { giaTheoCoSo, goiYMauDon } from './ke-hoach-len-don'

describe('giaTheoCoSo — giá đi đúng cơ sở dòng đơn', () => {
  it('đ/kg vào dòng tính kg: giữ nguyên', () => {
    expect(giaTheoCoSo(108000, 'kg', 'unit2', 1.2)).toBe(108000)
  })
  it('đ/kg vào dòng tính theo cây: nhân kg/cây', () => {
    expect(giaTheoCoSo(108000, 'kg', 'unit', 1.2)).toBe(129600)
  })
  it('đ/cây vào dòng tính kg: chia kg/cây', () => {
    expect(giaTheoCoSo(129600, 'unit', 'unit2', 1.2)).toBe(108000)
  })
  it('thiếu kg/cây thì KHÔNG đoán — để trống', () => {
    expect(giaTheoCoSo(108000, 'kg', 'unit', null)).toBeNull()
    expect(giaTheoCoSo(129600, 'unit', 'unit2', 0)).toBeNull()
  })
  it('chưa có giá vẫn là chưa có giá', () => {
    expect(giaTheoCoSo(null, 'unit', 'unit', null)).toBeNull()
  })
  it('cùng cơ sở ĐVT: giữ nguyên', () => {
    expect(giaTheoCoSo(47, 'unit', 'unit', null)).toBe(47)
  })
})

describe('goiYMauDon', () => {
  const vit = { group_name: 'Bu lông - vít - đinh - liên kết', sub_group: 'Vít các loại', co_so: 'unit' as const } // prettier-ignore
  const nhom = {
    group_name: 'Nhôm định hình - tấm',
    sub_group: null,
    co_so: 'kg' as const,
  }
  it('có dòng tính kg → mẫu kim loại, kể cả NCC quen mẫu khác', () => {
    expect(goiYMauDon([nhom], 'accessory')).toBe('aluminium')
    expect(goiYMauDon([{ ...nhom, group_name: 'Sắt thép - tôn - tấm' }])).toBe('metal_kg')
  })
  it('NCC đã có đơn → mẫu đơn gần nhất của NCC', () => {
    expect(goiYMauDon([vit], 'simple')).toBe('simple')
  })
  it('NCC mới → theo nhóm hàng nhiều dòng nhất', () => {
    expect(goiYMauDon([vit, vit])).toBe('accessory')
    expect(goiYMauDon([{ group_name: 'Bao bì - đóng gói - tem nhãn', sub_group: 'Tem - nhãn - thẻ - decal', co_so: 'unit' }])).toBe('label') // prettier-ignore
    expect(goiYMauDon([{ group_name: 'Mút - xốp - nệm - gòn', sub_group: null, co_so: 'unit' }])).toBe('foam') // prettier-ignore
  })
})
