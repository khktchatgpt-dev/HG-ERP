import { describe, expect, it } from 'vitest'
import { docDanNv, docGioiTinh, docNgay, nhanCot, soKhac } from './nap-ho-so'

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
