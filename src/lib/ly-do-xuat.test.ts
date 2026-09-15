import { describe, expect, it } from 'vitest'
import {
  LY_DO_XUAT,
  laMaLyDoXuat,
  lyDoMacDinh,
  nhanLyDo,
  thieuDienGiai,
  vaoGiaThanhLenh,
} from './ly-do-xuat'

describe('bộ mã lý do xuất', () => {
  it('mã không trùng nhau', () => {
    const ma = LY_DO_XUAT.map((x) => x.ma)
    expect(new Set(ma).size).toBe(ma.length)
  })

  it('nhận đúng mã trong bộ, từ chối mã lạ', () => {
    expect(laMaLyDoXuat('sx')).toBe(true)
    expect(laMaLyDoXuat('huy')).toBe(true)
    expect(laMaLyDoXuat('cap-sx')).toBe(false)
    expect(laMaLyDoXuat('')).toBe(false)
  })
})

describe('nhanLyDo', () => {
  it('đổi mã thành nhãn đọc được', () => {
    expect(nhanLyDo('sx')).toBe('Cấp cho sản xuất')
    expect(nhanLyDo('huy')).toBe('Huỷ · hỏng không dùng được')
  })

  it('MÃ LẠ trả về chính nó, KHÔNG trả rỗng', () => {
    // Thà hiện chuỗi khó hiểu còn hơn hiện ô trống làm người đọc tưởng phiếu
    // không có lý do — dữ liệu cũ và mã bị gỡ đều rơi vào đây.
    expect(nhanLyDo('mot-ma-cu')).toBe('mot-ma-cu')
  })

  it('không có mã thì null — màn tự quyết bày dấu gì', () => {
    expect(nhanLyDo(null)).toBeNull()
    expect(nhanLyDo(undefined)).toBeNull()
    expect(nhanLyDo('')).toBeNull()
  })
})

describe('vaoGiaThanhLenh — tiền đi về đâu', () => {
  it('cấp cho SX và cấp bù hao đi vào giá thành lệnh', () => {
    expect(vaoGiaThanhLenh('sx')).toBe(true)
    expect(vaoGiaThanhLenh('bu-hao')).toBe(true)
  })

  it('sửa máy · nội bộ · mẫu · huỷ KHÔNG vào giá thành lệnh', () => {
    for (const m of ['sua-may', 'noi-bo', 'mau', 'huy', 'khac']) {
      expect(vaoGiaThanhLenh(m), m).toBe(false)
    }
  })

  it('mã lạ hoặc rỗng thì KHÔNG vào giá thành — không đoán bừa vào tiền', () => {
    expect(vaoGiaThanhLenh('ma-la')).toBe(false)
    expect(vaoGiaThanhLenh(null)).toBe(false)
  })
})

describe('thieuDienGiai — "Khác" bắt buộc ghi rõ', () => {
  it('chọn Khác mà bỏ trống diễn giải là thiếu', () => {
    expect(thieuDienGiai('khac', '')).toBe(true)
    expect(thieuDienGiai('khac', '   ')).toBe(true)
    expect(thieuDienGiai('khac', null)).toBe(true)
  })

  it('chọn Khác có ghi rõ thì đủ', () => {
    expect(thieuDienGiai('khac', 'Xuất cho hội chợ')).toBe(false)
  })

  it('mã khác KHÔNG bắt ghi diễn giải', () => {
    // Nếu không, "Khác" thành thùng rác nuốt mọi phiếu và bộ mã mất tác dụng —
    // nhưng bắt mọi mã đều ghi thì người dùng gõ cho xong, cũng hỏng như nhau.
    expect(thieuDienGiai('sx', '')).toBe(false)
    expect(thieuDienGiai(null, '')).toBe(false)
  })
})

describe('lyDoMacDinh', () => {
  it('xuất theo lệnh thì mặc định là cấp cho sản xuất', () => {
    expect(lyDoMacDinh('lsx')).toBe('sx')
  })

  it('xuất thường ngày KHÔNG đoán hộ — bắt người dùng chọn', () => {
    expect(lyDoMacDinh('daily')).toBe('')
  })
})
