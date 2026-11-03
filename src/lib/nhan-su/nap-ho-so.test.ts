import { describe, expect, it } from 'vitest'
import { chuanO, docDanNv, docGioiTinh, docNgay, nhanCot, soKhac } from './nap-ho-so'

describe('nhận cột theo tiêu đề', () => {
  it('tiêu đề hay gặp, thứ tự đúng', () => {
    expect(nhanCot('Mã NV')).toBe('ma')
    expect(nhanCot('Họ và Tên')).toBe('ten')
    expect(nhanCot('Bộ phận')).toBe('chucDanh')
    expect(nhanCot('Bộ phận / Tổ')).toBe('to')
    expect(nhanCot('Ngày cấp CCCD')).toBe('ngayCap')
    expect(nhanCot('Số CCCD')).toBe('cccd')
    expect(nhanCot('Mã số thuế')).toBe('mst')
    expect(nhanCot('SĐT khẩn cấp')).toBe('khanCapSdt')
    expect(nhanCot('Điện thoại')).toBe('dienThoai')
    expect(nhanCot('Địa chỉ thường trú')).toBe('thuongTru')
    expect(nhanCot('Chỗ ở hiện tại')).toBe('choO')
    expect(nhanCot('STT')).toBeNull()
  })
})

describe('đọc vùng dán', () => {
  it('file "chua co cccd": STT · Họ và Tên · MST · CCCD · Bộ phận', () => {
    const t = [
      '\tSTT\tHọ và Tên\tMã số thuế\tSố CCCD\tBộ phận',
      '\t1\tLê Quang Huy\t033072015279\t033072015279\tQuản đốc',
      '\t2\tNguyễn Thị Thu Hậu\t\t052191012360\t',
      '\t\t\t\t\t',
    ].join('\n')
    const r = docDanNv(t)
    expect(r.cot).toEqual(['ten', 'mst', 'cccd', 'chucDanh'])
    expect(r.dong).toEqual([
      {
        dong: 2,
        ten: 'Lê Quang Huy',
        mst: '033072015279',
        cccd: '033072015279',
        chucDanh: 'Quản đốc',
      },
      { dong: 3, ten: 'Nguyễn Thị Thu Hậu', cccd: '052191012360' },
    ])
  })
  it('không có dòng tiêu đề → rỗng', () => {
    expect(docDanNv('1\t2\t3').dong).toEqual([])
  })
})

describe('đọc giá trị, so khác', () => {
  it('ngày + giới tính', () => {
    expect(docNgay('14/05/1990')).toBe('1990-05-14')
    expect(docNgay('4-5-1990')).toBe('1990-05-04')
    expect(docNgay('1990-05-14')).toBe('1990-05-14')
    expect(docNgay('31/02/1990')).toBeUndefined()
    expect(docNgay('14/05/90')).toBeUndefined()
    expect(docGioiTinh('Nữ')).toBe('female')
    expect(docGioiTinh('x')).toBeUndefined()
  })
  it('chỉ điền ô trống trừ khi bật ghi đè; ô sai báo lỗi', () => {
    const dong = {
      dong: 2,
      ma: '105',
      chucDanh: 'Thợ hàn',
      to: 'Tổ Phôi',
      cccd: '123',
      dienThoai: '0905 123 456',
    }
    const cot = ['ma', 'chucDanh', 'to', 'cccd', 'dienThoai'] as const
    const r = soKhac(
      dong,
      { chucDanh: null, to: 'Tổ Hàn', dienThoai: '0905123456' },
      [...cot],
      false,
    )
    expect(r.doi).toEqual([{ cot: 'chucDanh', cu: null, moi: 'Thợ hàn' }])
    expect(r.giu).toEqual([{ cot: 'to', cu: 'Tổ Hàn', moi: 'Tổ Phôi' }])
    expect(r.loi).toHaveLength(1)
    expect(soKhac(dong, { to: 'Tổ Hàn' }, ['to'], true).doi).toHaveLength(1)
  })
})

describe('Mã số BHXH (B5, 0286)', () => {
  it('nhận cột "Mã số BHXH" của file đóng BHXH; "Tổng nộp BHXH" không phải mã', () => {
    expect(nhanCot('Mã số BHXH')).toBe('maBhxh')
    expect(nhanCot('Mã BHXH')).toBe('maBhxh')
    expect(nhanCot('Tổng nộp BHXH')).toBeNull()
    expect(nhanCot('Mã NV')).toBe('ma')
  })
  it('đúng 10 chữ số (bỏ cách / chấm); sai thì báo', () => {
    expect(chuanO('maBhxh', '5212 345 678')).toBe('5212345678')
    expect(chuanO('maBhxh', '521234567')).toBeUndefined()
  })
  it('vùng dán kiểu file BHXH: Họ và tên + CCCD + Mã số BHXH, không có mã NV', () => {
    const d = docDanNv(
      'Stt\tHọ và tên\tChức vụ\tMã số BHXH\tNgày sinh\tCCCD\tTổng nộp BHXH\n1\tTrần Thị Mỹ Duyên\tCông nhân\t5212345678\t14/03/2001\t052301004417\t1.234.000\n',
    )
    expect(d.cot).toEqual(['ten', 'chucDanh', 'maBhxh', 'ngaySinh', 'cccd'])
    expect(d.dong[0]).toMatchObject({
      ten: 'Trần Thị Mỹ Duyên',
      maBhxh: '5212345678',
      cccd: '052301004417',
    })
  })
})
