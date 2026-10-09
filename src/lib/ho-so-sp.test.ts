import { describe, expect, it } from 'vitest'
import {
  bomRequiredFor,
  hoSoCheck,
  hoSoDiem,
  hoSoThieu,
  matchThieu,
  type HoSoInput,
} from './ho-so-sp'

const full: HoSoInput = {
  has_parts: true,
  has_drawing: true,
  has_image: true,
  has_packing: true,
  has_loading: true,
  has_sample: true,
  bom_required: true,
}

describe('hoSoCheck', () => {
  it('đủ hết thì 6 ô đều có', () => {
    const c = hoSoCheck(full)
    expect(Object.values(c).every((v) => v === 'co')).toBe(true)
    expect(hoSoThieu(c)).toEqual([])
    expect(hoSoDiem(c)).toEqual({ co: 6, apDung: 6 })
  })

  it('SP phụ kiện không cần BOM → ô BOM là không áp dụng, không đếm thiếu', () => {
    const c = hoSoCheck({ ...full, has_parts: false, bom_required: false })
    expect(c.bom).toBe('khong_ap_dung')
    expect(hoSoThieu(c)).toEqual([])
    expect(hoSoDiem(c)).toEqual({ co: 5, apDung: 5 })
  })

  it('chưa có mẫu thì ô Mẫu xám, không phải lỗi', () => {
    const c = hoSoCheck({ ...full, has_sample: false })
    expect(c.mau).toBe('khong_ap_dung')
    expect(hoSoThieu(c)).toEqual([])
  })

  it('chưa có đóng gói thì chỉ thiếu ĐG, ô XC không đếm thành thiếu thứ hai', () => {
    const c = hoSoCheck({ ...full, has_packing: false, has_loading: false })
    expect(hoSoThieu(c)).toEqual(['dg'])
    expect(c.xc).toBe('khong_ap_dung')
  })

  it('có đóng gói mà chưa khai 40HC thì thiếu XC', () => {
    const c = hoSoCheck({ ...full, has_loading: false })
    expect(hoSoThieu(c)).toEqual(['xc'])
  })

  it('SP mới tinh: thiếu BOM, BV, Ảnh, ĐG; Mẫu/XC không áp dụng', () => {
    const c = hoSoCheck({
      has_parts: false,
      has_drawing: false,
      has_image: false,
      has_packing: false,
      has_loading: false,
      has_sample: false,
      bom_required: true,
    })
    expect(hoSoThieu(c)).toEqual(['bom', 'bv', 'anh', 'dg'])
    expect(hoSoDiem(c)).toEqual({ co: 0, apDung: 4 })
  })
})

describe('matchThieu', () => {
  const c = hoSoCheck({ ...full, has_drawing: false })
  it('any = thiếu bất kỳ ô nào', () => {
    expect(matchThieu(c, 'any')).toBe(true)
    expect(matchThieu(hoSoCheck(full), 'any')).toBe(false)
  })
  it('lọc đúng ô', () => {
    expect(matchThieu(c, 'bv')).toBe(true)
    expect(matchThieu(c, 'bom')).toBe(false)
  })
})

describe('bomRequiredFor', () => {
  it('AC (phụ kiện) không cần, còn lại cần', () => {
    expect(bomRequiredFor('AC')).toBe(false)
    expect(bomRequiredFor('TB')).toBe(true)
    expect(bomRequiredFor(null)).toBe(true)
  })
})
