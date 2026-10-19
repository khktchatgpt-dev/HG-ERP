import { describe, expect, it } from 'vitest'
import { dungBanLamViec, nhanHen, type SoBan } from './kho-ban-lam-viec'

const so: SoBan = {
  hangVe: { overdue: 5, today: 2, week: 9 },
  thieuNcc: { tong: 95, ganDay: 37 },
  lenh: {
    con: 12,
    conMa: 205,
    han: 2,
    hanTen: ['01/26-27 YOTRIO', '01/26-27 JAWOLL', 'X'],
    xong: 0,
  },
  ton: { low: 5, short: 73 },
  kiemKe: { lam: 0, cho: 0 },
  deNghi: { viec: 0 },
}

const tim = (k: string) =>
  dungBanLamViec(so)
    .flatMap((g) => g.o)
    .find((o) => o.key === k)!

describe('dungBanLamViec', () => {
  it('3 nhóm, 11 ô, đúng số đo 19/10', () => {
    const g = dungBanLamViec(so)
    expect(g.map((x) => x.ten)).toEqual([
      'Nhận hàng',
      'Xuất cho lệnh',
      'Tồn · kiểm kê · đề nghị',
    ])
    expect(g.flatMap((x) => x.o)).toHaveLength(11)
    expect(tim('qua-hen')).toMatchObject({
      n: 5,
      tone: 'stop',
      href: '/warehouse/nhap?hen=overdue',
    })
    expect(tim('lenh-con')).toMatchObject({ n: 12, s: '205 mã · Tồn kho › Theo lệnh' })
  })

  it('ô 0 vẫn có, tông nhạt — không tô đỏ', () => {
    expect(tim('lenh-xong')).toMatchObject({ n: 0, tone: 'z' })
    expect(tim('kiem-ke')).toMatchObject({ n: 0, tone: 'z' })
  })

  it('thiếu số NCC đếm cả sổ như tab Sổ phiếu; 14 ngày ở dòng phụ', () => {
    expect(tim('thieu-ncc')).toMatchObject({ n: 95, s: '37 trong 14 ngày · Sổ phiếu' })
  })

  it('rổ hạn xuất gộp quá hạn + ≤ 7 ngày (đúng một rổ của Theo lệnh), nêu tối đa 2 lệnh', () => {
    expect(tim('lenh-han')).toMatchObject({ n: 2, s: '01/26-27 YOTRIO · 01/26-27 JAWOLL', href: '/warehouse/ton?xem=lenh&ro=han' }) // prettier-ignore
  })

  it('kiểm kê có đợt chờ duyệt thì dẫn thẳng rổ Chờ duyệt', () => {
    const g = dungBanLamViec({ ...so, kiemKe: { lam: 1, cho: 2 } })
    expect(g[2].o.find((o) => o.key === 'kiem-ke')).toMatchObject({ n: 3, href: '/warehouse/kiem-ke?ro=cho' }) // prettier-ignore
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
