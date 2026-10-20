import { describe, expect, it } from 'vitest'
import {
  banHieuLuc,
  che,
  chuanNganHang,
  cungTo,
  docDan,
  docSo,
  khopTen,
  thieu,
  type NguoiKhop,
} from './ho-so-luong'

describe('banHieuLuc', () => {
  const b = [{ tuKy: '2026-10' }, { tuKy: '2026-12' }]
  it('kỳ dùng bản có từ-kỳ lớn nhất không vượt kỳ', () => {
    expect(banHieuLuc(b, '2026-11')?.tuKy).toBe('2026-10')
    expect(banHieuLuc(b, '2026-12')?.tuKy).toBe('2026-12')
    expect(banHieuLuc(b, '2026-09')).toBeNull()
  })
})

describe('thieu', () => {
  it('theo công thiếu đơn giá; theo tháng thiếu lương tháng; BH chỉ khi tham gia', () => {
    const hs = {
      cachTra: 'daily' as const,
      donGia: null,
      luongThang: null,
      luongBh: null,
      coBh: true,
    }
    expect(thieu(hs, null)).toEqual({ luong: true, stk: true, bh: true })
    expect(thieu({ ...hs, donGia: 636000, coBh: false }, '123')).toEqual({
      luong: false,
      stk: false,
      bh: false,
    })
    expect(thieu(null, '1').luong).toBe(true)
  })
})

describe('khớp tên từ file Kế toán', () => {
  const ds: NguoiKhop[] = [
    { id: 'a', ma: '5052', ten: 'Huỳnh Thị Thanh Thư', to: 'Phòng Nhân Sự' },
    { id: 'b', ma: '11', ten: 'Nguyễn Thị Hoa', to: 'Tổ Phôi' },
    { id: 'c', ma: '12', ten: 'Nguyễn Thị Hoa', to: 'Tổ May' },
    { id: 'd', ma: '13', ten: 'Nguyễn Thị Hoa', to: 'Tổ May' },
  ]
  it('đúng tên (bỏ dấu, hoa thường) → khớp', () => {
    expect(khopTen('HUỲNH THỊ THANH THƯ', 'Phòng nhân sự', ds)).toEqual({
      kieu: 'khop',
      nguoi: ds[0],
    })
  })
  it('trùng tên → tổ gỡ được thì khớp, không gỡ được thì để người chọn', () => {
    expect(khopTen('Nguyễn Thị Hoa', 'Tổ Phôi', ds)).toEqual({
      kieu: 'khop',
      nguoi: ds[1],
    })
    const r = khopTen('Nguyễn Thị Hoa', 'Tổ May', ds)
    expect(r.kieu).toBe('nhieu')
    expect(r.kieu === 'nhieu' && r.ungVien.map((x) => x.id)).toEqual(['c', 'd'])
  })
  it('không ai tên đó → không thấy', () => {
    expect(khopTen('Lê Văn Tèo', null, ds)).toEqual({ kieu: 'khong' })
  })
  it('tên phòng ban lệch danh mục vẫn nhận là cùng tổ', () => {
    expect(cungTo('Bộ phận Kho', 'Kho')).toBe(true)
    expect(cungTo('Phòng nhân sự', 'Phòng Nhân Sự')).toBe(true)
    expect(cungTo('Tổ May', 'Tổ Phôi')).toBe(false)
  })
})

describe('đọc dán từ Excel', () => {
  const dan = [
    'CÔNG TY TNHH SX - TM HOÀNG GIA',
    'DANH SÁCH THANH TOÁN TIỀN LƯƠNG',
    'STT\tTÊN NGƯỜI THỤ HƯỞNG\tSỐ TÀI KHOẢN\tSỐ TIỀN\tTÊN NGÂN HÀNG\tDIỄN GIẢI\tPHÒNG BAN',
    '1\tHuỳnh Thị Thanh Thư\t2003206275887\t14964400\tAGRIBANK\tThanh toán\tPhòng nhân sự',
    '\t\t\t\t\t\t',
  ].join('\n')
  it('tìm dòng tiêu đề, bỏ cột không nhận ra (SỐ TIỀN = thực lĩnh)', () => {
    const r = docDan(dan)
    expect(r.cot.sort()).toEqual(['nganHang', 'stk', 'ten', 'to'])
    expect(r.dong).toEqual([
      {
        dong: 4,
        ten: 'Huỳnh Thị Thanh Thư',
        stk: '2003206275887',
        nganHang: 'AGRIBANK',
        to: 'Phòng nhân sự',
      },
    ])
  })
  it('sheet đơn giá (HỌ VÀ TÊN · SỐ CÔNG · ĐƠN GIÁ)', () => {
    const r = docDan(
      'HỌ VÀ TÊN\tSỐ CÔNG\tĐƠN GIÁ\tTHÀNH TIỀN\nTrần Quang Vang\t14\t636.000\t8.904.000',
    )
    expect(r.dong[0]).toMatchObject({ ten: 'Trần Quang Vang', donGia: '636.000' })
    expect(docSo(r.dong[0].donGia)).toBe(636000)
  })
})

describe('chuẩn hoá', () => {
  it('tên ngân hàng một cách viết', () => {
    expect(chuanNganHang('AGRIBANK')).toBe('Agribank')
    expect(chuanNganHang('TP BANK')).toBe('TPBank')
    expect(chuanNganHang('MBBANK')).toBe('MB Bank')
    expect(chuanNganHang('Ngân hàng lạ')).toBe('Ngân hàng lạ')
  })
  it('số VN và che số định danh', () => {
    expect(docSo('1.215.000,5')).toBe(1215000.5)
    expect(docSo('')).toBeNull()
    expect(che('2003206275887')).toBe('•••••••••5887')
  })
})
