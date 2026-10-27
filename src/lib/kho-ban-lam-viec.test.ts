import { describe, expect, it } from 'vitest'
import { dungDangDo, dungHomNay, nhanHen, type SoBan } from './kho-ban-lam-viec'

/** Số đo DB thật 27/10/2026. */
const so: SoBan = {
  hangVe: { tong: 35, overdue: 16, today: 0, week: 9 },
  thieuNcc: { tong: 95, ganDay: 37 },
  lenh: {
    con: 14,
    conMa: 234,
    han: 2,
    hanTen: ['01/26-27 - YOTRIO', '01/26-27 - JAWOLL', 'X'],
    xong: 3,
  },
  ton: { has: 240, low: 5, short: 73 },
  kiemKe: { lam: 0, cho: 1 },
  deNghi: { viec: 0 },
}

const tim = (k: string) =>
  dungHomNay(so)
    .flatMap((g) => g.so)
    .find((o) => o.key === k)!

describe('dungHomNay', () => {
  it('đúng 4 việc theo bản vẽ A, mỗi việc tối đa một nút', () => {
    const g = dungHomNay(so)
    expect(g.map((x) => x.ten)).toEqual([
      'Nhận hàng NCC',
      'Xuất cho tổ',
      'Tra tồn',
      'Cập nhật số thực tế',
    ])
    expect(g.map((x) => x.nut?.href ?? null)).toEqual([
      '/warehouse/nhap',
      '/warehouse/xuat',
      null,
      '/warehouse/cap-nhat-ton',
    ])
    expect(g[0].phu).toBe('35 đơn đang về')
    expect(g[2].phu).toBe('240 mã đang có hàng')
  })

  it('số bấm vào mở đúng rổ của màn đích', () => {
    expect(tim('qua-hen')).toMatchObject({ n: 16, tone: 'stop', href: '/warehouse/nhap?hen=overdue' }) // prettier-ignore
    expect(tim('lenh-con')).toMatchObject({
      n: 14,
      href: '/warehouse/ton?xem=lenh&ro=con',
    })
    expect(tim('kk-cho')).toMatchObject({ n: 1, href: '/warehouse/kiem-ke?ro=cho' })
  })

  it('số 0 vẫn hiện, tông nhạt — không tô đỏ', () => {
    expect(tim('hom-nay')).toMatchObject({ n: 0, tone: 'z' })
    expect(tim('kk-lam')).toMatchObject({ n: 0, tone: 'z' })
  })

  it('câu nhắc: đơn quá hẹn có thể đã về; lệnh gấp nêu tối đa 2 lệnh', () => {
    const g = dungHomNay(so)
    expect(g[0].nhac).toBe('16 đơn quá hẹn có thể đã về mà chưa ai ghi phiếu')
    expect(g[1].nhac).toBe('Gấp: 01/26-27 - YOTRIO · 01/26-27 - JAWOLL')
    const yen = dungHomNay({ ...so, hangVe: { ...so.hangVe, overdue: 0 }, lenh: { ...so.lenh, hanTen: [] } }) // prettier-ignore
    expect([yen[0].nhac, yen[1].nhac]).toEqual([null, null])
  })
})

describe('dungDangDo', () => {
  const base = {
    laTruong: true,
    choDuyet: [{ id: 'd9', code: 'KK-2026-0009', nguoi: 'Hà Nguyễn Nữ', so_ma: 3 }],
    dotLam: [{ id: 'd7', code: 'KK-2026-0007', trang_thai: 'đang đếm' }],
    deNghiNhap: 2,
    thieuNccGanDay: 37,
  }

  it('trưởng kho thấy "chờ bạn duyệt"; người khác thấy "chờ trưởng kho duyệt"', () => {
    expect(dungDangDo(base)[0]).toEqual({
      key: 'cho-d9',
      chu: 'KK-2026-0009 · Hà Nguyễn Nữ cập nhật 3 mã — chờ bạn duyệt',
      href: '/warehouse/kiem-ke/d9',
    })
    expect(dungDangDo({ ...base, laTruong: false })[0].chu).toBe(
      'KK-2026-0009 · cập nhật 3 mã — chờ trưởng kho duyệt',
    )
  })

  it('đủ 4 loại việc dở, loại nào 0 thì không hiện', () => {
    expect(dungDangDo(base).map((x) => x.href)).toEqual([
      '/warehouse/kiem-ke/d9',
      '/warehouse/kiem-ke/d7',
      '/warehouse/de-nghi',
      '/warehouse/phieu?ro=thieu_ncc',
    ])
    expect(
      dungDangDo({ ...base, choDuyet: [], dotLam: [], deNghiNhap: 0, thieuNccGanDay: 0 }),
    ).toEqual([])
  })
})

describe('nhanHen', () => {
  it('trễ / hôm nay / sắp tới / chưa hẹn', () => {
    expect(nhanHen('2026-10-09', '2026-10-19')).toEqual({
      chu: '09/10 · trễ 10 ngày',
      tone: 'stop',
    })
    expect(nhanHen('2026-10-19', '2026-10-19')).toEqual({ chu: 'hôm nay', tone: 'warn' })
    expect(nhanHen('2026-10-21', '2026-10-19')).toEqual({ chu: '21/10', tone: 'b' })
    expect(nhanHen(null, '2026-10-19')).toEqual({ chu: 'chưa hẹn', tone: 'z' })
  })
})
