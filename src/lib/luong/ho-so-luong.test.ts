import { describe, expect, it } from 'vitest'
import {
  banHieuLuc,
  che,
  chuanNganHang,
  cungTen,
  cungTo,
  docDan,
  docSo,
  khopNguoi,
  khopTen,
  tachTsv,
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
    expect(docSo('15,000,000')).toBe(15000000)
    expect(docSo('21,5')).toBe(21.5)
    expect(docSo('')).toBeNull()
    expect(che('2003206275887')).toBe('•••••••••5887')
  })
})

// Sổ lương T9 của Kế toán (20/10/2026): có "Mã số NV", tiêu đề hai tầng, ô tiêu đề xuống dòng.
describe('dán sổ lương T9 (TTSX · GTSX · VP)', () => {
  const ds: NguoiKhop[] = [
    { id: 'hung', ma: '6011', ten: 'Trương Văn Hùng', to: 'Phòng Nhân Sự' },
    { id: 'hau', ma: '441', ten: 'Lương Đức Hậu', to: 'Tổ Cơ Điện' },
    { id: 'hoa', ma: '331', ten: 'THI HOA', to: 'Tổ Phôi' },
  ]
  const so = [
    'BẢNG THANH TOÁN LƯƠNG',
    'STT\tMã số NV\tHọ Và Tên\t"M/ Lương \nNgày"\tLƯƠNG LÀM VIỆC\t\tThưởng hỗ trợ phòng ban khác\tTổng tiền lương',
    '\t\t\t\tC.thời gian\t"Trừ tiền \nBHXH+ BHYT+ BHTN"\t\t',
    '\t 02. VĂN PHÒNG\t\t\t\t\t\t',
    '1\t6011\tTrương Văn Hùng\t15000000\t27\t1127518\t0\t15576923',
    '2\t00441\tLương Đức Hậu\t350000\t25\t415800\t0\t8750000',
    '3\t00331\tTrịnh Thị Hoa\t360000\t21,5\t0\t0\t7740000',
  ].join('\n')

  it('ô trong ngoặc kép có xuống dòng là MỘT ô', () => {
    expect(tachTsv('a\t"M/ Lương \nNgày"\tb\nc\td')).toEqual([
      ['a', 'M/ Lương  Ngày', 'b'],
      ['c', 'd'],
    ])
    expect(tachTsv('5" ống\tx')).toEqual([['5" ống', 'x']])
  })

  it('nhận Mã NV, tầng tiêu đề dưới; "M/ Lương Ngày" tách theo độ lớn', () => {
    const r = docDan(so)
    expect(r.cot.sort()).toEqual(['donGia', 'luongThang', 'ma', 'ten', 'truBh'])
    expect(r.dong).toHaveLength(3)
    expect(r.dong[0]).toMatchObject({
      ma: '6011',
      luongThang: '15000000',
      truBh: '1127518',
    })
    expect(r.dong[1]).toMatchObject({ ma: '00441', donGia: '350000', truBh: '415800' })
    // "phòng ban khác" là cột tiền, không bị hiểu thành cột tổ
    expect(r.dong[1].to).toBeUndefined()
  })

  it('khớp theo mã (bỏ số 0 đầu) trước, tên sổ ghi khác vẫn khớp', () => {
    expect(khopNguoi('00441', 'Lương Đức Hậu', null, ds)).toMatchObject({
      kieu: 'khop',
      nguoi: { id: 'hau' },
    })
    expect(khopNguoi('00331', 'Trịnh Thị Hoa', null, ds)).toMatchObject({
      nguoi: { id: 'hoa' },
    })
    // mã lạ → rơi về khớp tên
    expect(khopNguoi('9999', 'Trương Văn Hùng', null, ds)).toMatchObject({
      nguoi: { id: 'hung' },
    })
    expect(khopNguoi(null, 'Không Ai', null, ds)).toEqual({ kieu: 'khong' })
  })
})

describe('mã trong sổ trỏ nhầm người', () => {
  const ds: NguoiKhop[] = [
    { id: 'lien', ma: '5034', ten: 'Nguyễn Thị Mỹ Liên', to: null },
    { id: 'kieu', ma: '5099', ten: 'Nguyễn Thị Thanh Kiều', to: null },
    { id: 'thong', ma: '330', ten: 'BA THONG', to: null },
    { id: 'sanh', ma: '278', ten: 'DUYSANH', to: null },
  ]
  it('tên ERP bị máy cắt đuôi vẫn là cùng người', () => {
    expect(cungTen('BA THONG', 'Diệp Bảo Thông')).toBe(true)
    expect(cungTen('DUYSANH', 'Đào Thị Duy Sanh')).toBe(true)
    expect(cungTen('THI HOA', 'Trịnh Thị Hòa')).toBe(true)
    expect(cungTen('Nguyễn Thị Thúy Văn', 'Nguyễn Thị Thuý Văn')).toBe(true)
    expect(cungTen('T THANH', 'Lê Minh Thu')).toBe(false)
    expect(cungTen('Nguyễn Thị Mỹ Liên', 'Nguyễn Thị Thanh Kiều')).toBe(false)
  })
  it('mã trùng mà tên lệch → không tự khớp, đưa cả hai người ra chọn', () => {
    const r = khopNguoi('5.034', 'Nguyễn Thị Thanh Kiều', null, ds)
    expect(r.kieu).toBe('nhieu')
    if (r.kieu !== 'nhieu') return
    expect(r.ungVien.map((n) => n.id)).toEqual(['lien', 'kieu'])
    expect(r.lyDo).toContain('Nguyễn Thị Mỹ Liên')
    expect(khopNguoi('00330', 'Diệp Bảo Thông', null, ds)).toMatchObject({ kieu: 'khop' })
  })
})
