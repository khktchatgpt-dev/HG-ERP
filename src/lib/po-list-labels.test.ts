import { describe, expect, it } from 'vitest'
import { givenNames, materialSummary, supplierShortName } from './po-list-labels'

describe('supplierShortName — bỏ loại hình công ty, giữ phần gọi nhau', () => {
  it.each([
    ['CÔNG TY TNHH SX & TM DV TÂN THÀNH LONG', 'TÂN THÀNH LONG'],
    ['CÔNG TY CỔ PHẦN BAO BÌ 3/2', 'BAO BÌ 3/2'],
    ['CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN', 'TƯỜNG NGUYÊN'],
    ['Doanh Nghiệp Tư Nhân PQ', 'PQ'],
    ['HỘ KINH DOANH THIẾT BỊ THÔNG MINH1', 'THIẾT BỊ THÔNG MINH1'],
    ['CÔNG TY TNHH MTV DV TM XNK CAO ĐẠT', 'CAO ĐẠT'],
    ['CÔNG TY TNHH THÁI DANH', 'THÁI DANH'],
    ['NGŨ KIM THÀNH NGHĨA', 'NGŨ KIM THÀNH NGHĨA'],
    [
      'TAIZHOU XU-DAN HOME TECHNOLOGY CO., LTD.',
      'TAIZHOU XU-DAN HOME TECHNOLOGY CO., LTD.',
    ],
    ['KIMPACK PACKAGING JOINT STOCK COMPANY', 'KIMPACK PACKAGING JOINT STOCK COMPANY'],
  ])('%s → %s', (full, short) => {
    expect(supplierShortName(full)).toBe(short)
  })

  it('tên chỉ có loại hình thì trả nguyên tên, không trả rỗng', () => {
    expect(supplierShortName('CÔNG TY TNHH')).toBe('CÔNG TY TNHH')
    expect(supplierShortName(null)).toBe('')
  })

  it('không nuốt chữ đầu của tên riêng trùng từ viết tắt (SX, TM…)', () => {
    // "TM" chỉ bị bỏ khi nằm trong cụm loại hình ngay sau "CÔNG TY …".
    expect(supplierShortName('TM PHÁT')).toBe('TM PHÁT')
  })
})

describe('givenNames — chip người phụ trách', () => {
  it('lấy tên gọi, viết hoa chữ đầu', () => {
    const m = givenNames([
      { id: 'a', name: 'Đặng Thị Thanh Nga' },
      { id: 'b', name: 'nguyễn đình huy' },
    ])
    expect(m.get('a')).toBe('Nga')
    expect(m.get('b')).toBe('Huy')
  })

  it('trùng tên gọi thì cả hai hiện họ tên đầy đủ', () => {
    const m = givenNames([
      { id: 'a', name: 'Đặng Thị Thanh Nga' },
      { id: 'b', name: 'lê thị nga' },
    ])
    expect(m.get('a')).toBe('Đặng Thị Thanh Nga')
    expect(m.get('b')).toBe('Lê Thị Nga')
  })
})

describe('materialSummary — đơn mua cái gì', () => {
  it('hai tên đầu khác nhau + số còn lại', () => {
    expect(
      materialSummary(['Vít 4x20', 'Vít 4x20', 'Tán M6', 'Long đền', 'Bulon']),
    ).toEqual({
      head: 'Vít 4x20, Tán M6',
      more: 2,
    })
  })
  it('đơn một dòng / không dòng', () => {
    expect(materialSummary(['Xơ gòn tấm'])).toEqual({ head: 'Xơ gòn tấm', more: 0 })
    expect(materialSummary([])).toEqual({ head: '', more: 0 })
  })
})
