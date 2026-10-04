import { describe, expect, it } from 'vitest'
import { ghiChuLuiNgay, kiemNgayChungTu, soNgayLui } from './ngay-chung-tu-nhap'

const T = '2026-10-05'

describe('soNgayLui', () => {
  it('đếm theo ngày lịch, qua tháng', () => {
    expect(soNgayLui('2026-09-20', T)).toBe(15)
    expect(soNgayLui(T, T)).toBe(0)
    expect(soNgayLui('2026-10-06', T)).toBe(-1)
  })
})

describe('kiemNgayChungTu', () => {
  it('trống / hôm nay / lùi 7 ngày → ok, không cần lý do', () => {
    expect(kiemNgayChungTu({ docDate: null, today: T }).muc).toBe('ok')
    expect(kiemNgayChungTu({ docDate: T, today: T }).muc).toBe('ok')
    expect(kiemNgayChungTu({ docDate: '2026-09-28', today: T }).muc).toBe('ok')
  })
  it('tương lai → chặn', () => {
    expect(kiemNgayChungTu({ docDate: '2026-10-06', today: T }).muc).toBe('chan')
  })
  it('lùi 8–60 ngày: thiếu lý do → cần lý do; có lý do → ok', () => {
    const r = kiemNgayChungTu({ docDate: '2026-09-20', today: T })
    expect(r).toMatchObject({ muc: 'can_ly_do', lui: 15 })
    expect(kiemNgayChungTu({ docDate: '2026-09-20', today: T, lyDo: '  ' }).muc).toBe(
      'can_ly_do',
    )
    expect(
      kiemNgayChungTu({
        docDate: '2026-08-06',
        today: T,
        lyDo: 'nhập bù hàng về trước khi dùng hệ thống',
      }),
    ).toMatchObject({ muc: 'ok', lui: 60 })
  })
  it('lùi > 60 ngày → chặn kể cả có lý do', () => {
    expect(
      kiemNgayChungTu({ docDate: '2026-08-05', today: T, lyDo: 'nhập bù' }),
    ).toMatchObject({ muc: 'chan', lui: 61 })
  })
  it('phiếu lập lại để sửa: giữ ngày cũ, không giới hạn, không cần lý do', () => {
    expect(
      kiemNgayChungTu({ docDate: '2026-07-01', today: T, ngayPhieuCu: '2026-07-01' }).muc,
    ).toBe('ok')
  })
})

describe('ghiChuLuiNgay', () => {
  it('nêu số ngày lùi + lý do', () => {
    expect(ghiChuLuiNgay(15, ' nhập bù ')).toBe('[Nhập lùi 15 ngày] nhập bù')
  })
})

describe('lập lại phiếu — đổi ngày (sửa ngày chứng từ sai)', () => {
  it('đổi sang ngày khác thì áp luật thường', () => {
    expect(kiemNgayChungTu({ docDate: '2026-09-20', today: T, ngayPhieuCu: '2026-07-01' })).toMatchObject({ muc: 'can_ly_do', lui: 15 }) // prettier-ignore
    expect(kiemNgayChungTu({ docDate: '2026-10-03', today: T, ngayPhieuCu: '2026-07-01' }).muc).toBe('ok') // prettier-ignore
    expect(kiemNgayChungTu({ docDate: '2026-06-01', today: T, ngayPhieuCu: '2026-07-01', lyDo: 'x' }).muc).toBe('chan') // prettier-ignore
  })
})
