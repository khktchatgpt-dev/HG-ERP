import { describe, it, expect } from 'vitest'
import {
  moTaVuong,
  phanLoaiDong,
  viecTiepTheo,
  type DongCap,
  type VuongMac,
} from './cap-vat-tu'

function dong(over: Partial<DongCap> = {}): DongCap {
  return {
    conPhaiCap: 100,
    dungDuoc: 0,
    choKiem: 0,
    dangKhoa: 0,
    giuChoLenhKhac: 0,
    ...over,
  }
}

describe('dòng đã xong', () => {
  it('cấp đủ định mức → nhãn du, không vướng gì', () => {
    expect(phanLoaiDong(dong({ conPhaiCap: 0 }))).toEqual({
      nhan: 'du',
      capNgay: 0,
      conThieu: 0,
      vuong: [],
    })
  })

  it('cấp VƯỢT định mức (số âm) vẫn là du, không ra số âm', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: -5, dungDuoc: 50 }))
    expect(r.nhan).toBe('du')
    expect(r.capNgay).toBe(0)
  })
})

describe('cấp được', () => {
  it('kho đủ hàng dùng được → cấp hết, không vướng', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 40, dungDuoc: 100 }))
    expect(r).toEqual({ nhan: 'cap-duoc', capNgay: 40, conThieu: 0, vuong: [] })
  })

  it('kho vừa đúng → vẫn cấp được', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 40, dungDuoc: 40 }))
    expect(r.nhan).toBe('cap-duoc')
    expect(r.capNgay).toBe(40)
  })
})

/**
 * KHẢ DỤNG = dùng được − phần đã hứa cho lệnh KHÁC. Lấy thẳng `dungDuoc` thì
 * cấp cho lệnh này là rút chân lệnh kia, và lỗi chỉ lộ ra khi tổ bên đó ra
 * lấy hàng không còn.
 */
describe('phần giữ cho lệnh khác', () => {
  it('500 trong kho nhưng 480 đã hứa → chỉ cấp được 20', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 100, dungDuoc: 500, giuChoLenhKhac: 480 }))
    expect(r.nhan).toBe('mot-phan')
    expect(r.capNgay).toBe(20)
    expect(r.conThieu).toBe(80)
    expect(r.vuong).toEqual([{ loai: 'giu-cho-lenh-khac', luong: 80 }])
  })

  it('hứa hết sạch → không cấp được gam nào, và nói đúng vì sao', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 50, dungDuoc: 50, giuChoLenhKhac: 50 }))
    expect(r.nhan).toBe('khong-cap-duoc')
    expect(r.capNgay).toBe(0)
    expect(r.vuong).toEqual([{ loai: 'giu-cho-lenh-khac', luong: 50 }])
  })
})

describe('bốn nhãn KHÔNG được gộp — mỗi cái dẫn tới một việc khác', () => {
  it('hàng có nhưng chờ kiểm → nói chờ kiểm, không nói "không đủ tồn"', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 100, choKiem: 100 }))
    expect(r.nhan).toBe('khong-cap-duoc')
    expect(r.vuong).toEqual([{ loai: 'cho-kiem', luong: 100 }])
    expect(viecTiepTheo(r.vuong[0].loai).href).toContain('bucket=qc')
  })

  it('hàng đang khoá → dẫn sang màn Hàng mắc', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 100, dangKhoa: 100 }))
    expect(r.vuong).toEqual([{ loai: 'dang-khoa', luong: 100 }])
    expect(viecTiepTheo('dang-khoa').href).toBe('/warehouse/hang-mac')
  })

  it('kho không có gì → dẫn sang đề xuất mua', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 100 }))
    expect(r.vuong).toEqual([{ loai: 'chua-co-hang', luong: 100 }])
    expect(viecTiepTheo('chua-co-hang').label).toBe('Đề xuất mua')
  })
})

describe('nhiều vướng mắc cùng lúc', () => {
  /**
   * Ca trung tâm: cấp được một phần, phần còn lại tán ra ba chỗ. Thứ tự phải
   * là DỄ GỠ TRƯỚC — chờ kiểm gỡ trong ngày, hàng khoá gỡ trong tuần, chưa
   * có hàng gỡ trong tháng.
   */
  it('xếp theo mức dễ gỡ: chờ kiểm → khoá → chưa có', () => {
    const r = phanLoaiDong(
      dong({ conPhaiCap: 100, dungDuoc: 30, choKiem: 20, dangKhoa: 10 }),
    )
    expect(r.nhan).toBe('mot-phan')
    expect(r.capNgay).toBe(30)
    expect(r.conThieu).toBe(70)
    expect(r.vuong).toEqual([
      { loai: 'cho-kiem', luong: 20 },
      { loai: 'dang-khoa', luong: 10 },
      { loai: 'chua-co-hang', luong: 40 },
    ])
  })

  /**
   * KHÔNG CỘNG QUÁ PHẦN THIẾU. Có 100 chờ kiểm và 100 khoá mà chỉ thiếu 30
   * thì không phải "vướng 200" — con số đó làm người đọc tưởng vấn đề to gấp
   * bảy lần thực tế.
   */
  it('mỗi rổ chỉ đóng góp tối đa phần còn thiếu', () => {
    const r = phanLoaiDong(
      dong({ conPhaiCap: 30, dungDuoc: 0, choKiem: 100, dangKhoa: 100 }),
    )
    expect(r.conThieu).toBe(30)
    expect(r.vuong).toEqual([{ loai: 'cho-kiem', luong: 30 }])
    const tong = r.vuong.reduce((s, v) => s + v.luong, 0)
    expect(tong).toBe(r.conThieu)
  })

  it('tổng vướng mắc LUÔN bằng phần còn thiếu — bất biến của cả hàm', () => {
    const cases: DongCap[] = [
      dong({ conPhaiCap: 100, dungDuoc: 10, choKiem: 5, dangKhoa: 5 }),
      dong({ conPhaiCap: 7, dungDuoc: 0, choKiem: 3, dangKhoa: 2 }),
      dong({ conPhaiCap: 50, dungDuoc: 60, giuChoLenhKhac: 55 }),
      dong({ conPhaiCap: 1, dungDuoc: 0, dangKhoa: 1000 }),
    ]
    for (const c of cases) {
      const r = phanLoaiDong(c)
      const tong = r.vuong.reduce((s, v) => s + v.luong, 0)
      expect(tong).toBeCloseTo(r.conThieu, 9)
    }
  })
})

describe('sai số dấu phẩy động', () => {
  it('0.1 + 0.2 kiểu trừ nhau không đẻ ra dòng "thiếu 0.0000001"', () => {
    const r = phanLoaiDong(dong({ conPhaiCap: 0.3, dungDuoc: 0.1 + 0.2 }))
    expect(r.nhan).toBe('cap-duoc')
    expect(r.conThieu).toBe(0)
    expect(r.vuong).toEqual([])
  })
})

describe('mô tả và việc tiếp theo phủ hết bốn loại', () => {
  it('không loại nào rơi ra ngoài', () => {
    const loai: VuongMac[] = [
      'cho-kiem',
      'dang-khoa',
      'giu-cho-lenh-khac',
      'chua-co-hang',
    ]
    for (const l of loai) {
      expect(moTaVuong(l)).toBeTruthy()
      expect(viecTiepTheo(l).label).toBeTruthy()
      expect(viecTiepTheo(l).href.startsWith('/')).toBe(true)
    }
  })
})
