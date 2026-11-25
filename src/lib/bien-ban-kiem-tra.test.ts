import { describe, expect, it } from 'vitest'
import { dongChecklist, tenQuyCach, TIEU_CHI_KHAC } from './bien-ban-kiem-tra'

describe('dongChecklist', () => {
  it('phiếu nào cũng có Hồ sơ + Số lượng đứng đầu', () => {
    expect(dongChecklist([]).map((t) => t.nhom)).toEqual(['Hồ sơ', 'Số lượng'])
  })

  it('bao bì lặp nhiều dòng chỉ ra một tiêu chí', () => {
    const r = dongChecklist([
      'Bao bì - đóng gói - tem nhãn',
      'Bao bì - đóng gói - tem nhãn',
    ])
    expect(r.map((t) => t.nhom)).toEqual(['Hồ sơ', 'Số lượng', 'Bao bì / nhãn'])
  })

  it('nhóm gỗ ra ba tiêu chí gỗ, ván, veneer', () => {
    const r = dongChecklist(['Gỗ - ván - chi tiết gỗ mua ngoài'])
    expect(r.slice(2).map((t) => t.nhom)).toEqual([
      'Gỗ tự nhiên / gỗ xẻ',
      'Ván công nghiệp',
      'Veneer / laminate',
    ])
  })

  it('bu lông và phụ kiện nội thất chung một tiêu chí kim khí', () => {
    const r = dongChecklist(['Bu lông - vít - đinh - liên kết', 'Phụ kiện nội thất'])
    expect(r.slice(2).map((t) => t.nhom)).toEqual(['Phụ kiện kim khí'])
  })

  it('nhóm chưa có tiêu chí riêng thì mang tên nhóm + câu chung; trống thành "Khác"', () => {
    const r = dongChecklist(['Kính - mica - nhựa tấm', null, ''])
    expect(r.slice(2)).toEqual([
      { nhom: 'Kính - mica - nhựa tấm', tieu_chi: TIEU_CHI_KHAC },
      { nhom: 'Khác', tieu_chi: TIEU_CHI_KHAC },
    ])
  })

  it('giữ thứ tự gặp trong phiếu', () => {
    const r = dongChecklist(['Mút - xốp - nệm - gòn', 'Sơn - keo - hoá chất', 'Vải - da - chỉ - phụ liệu may']) // prettier-ignore
    expect(r.slice(2).map((t) => t.nhom)).toEqual(['Mút / foam', 'Keo / sơn / hóa chất', 'Vải / da']) // prettier-ignore
  })
})

describe('tenQuyCach', () => {
  it('nối quy cách sau tên', () => {
    expect(tenQuyCach('Hộp Chân 3L', '670x255x65')).toBe('Hộp Chân 3L · 670x255x65')
  })
  it('tên đã chứa quy cách thì không lặp', () => {
    expect(tenQuyCach('Thùng carton bàn Polywood (1525x925x110)', '1525x925x110')).toBe(
      'Thùng carton bàn Polywood (1525x925x110)',
    )
  })
  it('x và × là một dấu nhân — không lặp quy cách', () => {
    expect(tenQuyCach('Xốp mặt 555x555x20 D18', '555×555×20')).toBe(
      'Xốp mặt 555x555x20 D18',
    )
  })
  it('không có quy cách thì chỉ tên', () => {
    expect(tenQuyCach('Bì nhựa 50x60', null)).toBe('Bì nhựa 50x60')
  })
})
