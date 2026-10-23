import { describe, expect, it } from 'vitest'
import fixture from '@/test/fixtures/cham-cong-son-sat-t9.json'
import {
  THAM_SO_MAC_DINH,
  catDoan,
  ghepNgayLam,
  gio2,
  lamTronRa,
  lamTronVao,
  phutCua,
  tinhGioNgay,
  xuyenTrua,
} from './gio-khung'

const p = phutCua

describe('làm tròn bậc thang (ví dụ nguyên văn tờ "Khung giờ & hệ số")', () => {
  it('giờ ra: 10:53 → 11:00 · 17:23 → 17:30 · 19:12 → 19:00 · 15:13 → 15:00', () => {
    expect(lamTronRa(p('10:53'))).toBe(p('11:00'))
    expect(lamTronRa(p('17:23'))).toBe(p('17:30'))
    expect(lamTronRa(p('19:12'))).toBe(p('19:00'))
    expect(lamTronRa(p('15:13'))).toBe(p('15:00'))
  })
  it('giờ vào chiều: 13:36 → 13:30 · 13:05 → 13:00 · 13:50 → 14:00', () => {
    expect(lamTronVao(p('13:36'))).toBe(p('13:30'))
    expect(lamTronVao(p('13:05'))).toBe(p('13:00'))
    expect(lamTronVao(p('13:50'))).toBe(p('14:00'))
  })
  it('đến sớm 5:00–7:00 kéo về 7:00; ân hạn tới 7:30; muộn hơn tính giờ thật', () => {
    expect(lamTronVao(p('05:30'))).toBe(p('07:00'))
    expect(lamTronVao(p('06:41'))).toBe(p('07:00'))
    expect(lamTronVao(p('07:30'))).toBe(p('07:00'))
    expect(lamTronVao(p('07:31'))).toBe(p('07:31'))
    expect(lamTronVao(p('08:50'))).toBe(p('08:50'))
  })
  it('bật "tính đến sớm" thì 6:41 giữ nguyên', () => {
    expect(lamTronVao(p('06:41'), { ...THAM_SO_MAC_DINH, tinhDenSom: true })).toBe(
      p('06:41'),
    )
  })
})

describe('giờ một ngày', () => {
  it('06:41 → 19:00 = 8 giờ hành chính + 3 giờ 16–19', () => {
    const g = tinhGioNgay(catDoan([p('06:41'), p('19:00')])!)
    expect(g.theoKhung).toMatchObject({ K1: 480, K2: 180, K3: 0 })
  })
  it('làm trưa 60 phút × hệ số 2 = +2 giờ vào hành chính', () => {
    const g = tinhGioNgay(catDoan([p('06:41'), p('19:00')])!, 60)
    expect(g.truaQuyDoi).toBe(120)
    expect(g.tong).toBe(480 + 180 + 120)
  })
  it('3 lượt → lượt đầu đến lượt cuối; 4 lượt → bỏ khoảng ra ngoài giữa', () => {
    expect(catDoan([p('07:01'), p('16:04'), p('17:09')])).toHaveLength(1)
    const bon = tinhGioNgay(catDoan([p('06:52'), p('10:53'), p('13:36'), p('19:12')])!)
    // 7:00–11:00 = 4h · 13:30–16:00 = 2h30 → K1 = 390 phút; 16:00–19:00 = 180
    expect(bon.theoKhung).toMatchObject({ K1: 390, K2: 180 })
  })
  it('1 lượt không tính được', () => {
    expect(catDoan([p('07:02')])).toBeNull()
  })
  it('xuyên trưa = ứng viên duyệt làm trưa', () => {
    expect(xuyenTrua(catDoan([p('06:45'), p('16:02')]))).toBe(true)
    expect(xuyenTrua(catDoan([p('13:00'), p('22:00')]))).toBe(false)
  })
})

describe('ca đêm qua 0h ghi vào ngày bắt đầu', () => {
  it('16/09 06:59 → 17/09 00:01 = 8 + 3 + 3 + 2 giờ', () => {
    const ngays = ghepNgayLam([
      '2026-09-16 06:59',
      '2026-09-17 00:01',
      '2026-09-17 06:56',
      '2026-09-17 23:03',
    ])
    const d16 = ngays.find((n) => n.ngay === '2026-09-16')!
    expect(d16.quaDem).toBe(true)
    expect(tinhGioNgay(d16.doan!).theoKhung).toMatchObject({
      K1: 480,
      K2: 180,
      K3: 180,
      K4: 120,
    })
    const d17 = ngays.find((n) => n.ngay === '2026-09-17')!
    expect(d17.luot).toEqual([p('06:56'), p('23:03')])
  })
})

/**
 * CHUẨN VÀNG: file HCNS "Thống kê giờ theo khung T9-2026 - Tổ sơn sắt" (ẩn danh).
 * Mọi ngày có giờ máy phải ra ĐÚNG giờ từng khung như Excel (K1 trước khi cộng làm trưa).
 */
describe('khớp file Excel Tổ sơn sắt T9/2026', () => {
  const ngayCua = new Map(
    Object.entries(fixture.luot as Record<string, string[]>).map(([nv, l]) => [
      nv,
      new Map(ghepNgayLam(l).map((n) => [n.ngay, n])),
    ]),
  )
  const ky = fixture.ky as {
    nv: string
    ngay: string
    may: string
    K1: number
    K2: number
    K3: number
    K4: number
    K5: number
    K6: number
    motLuot: boolean
  }[]

  it(`${ky.length} ngày có giờ máy, đủ người`, () => {
    expect(ky.length).toBe(241)
  })

  it('mọi ngày: giờ từng khung khớp Excel', () => {
    const lech: string[] = []
    for (const r of ky) {
      const n = ngayCua.get(r.nv)?.get(r.ngay)
      // Cột "giờ máy" của Excel chỉ ghi lượt CỦA NGÀY ĐÓ — ca đêm (06:59 → 00:01 hôm sau)
      // hiện 1 lượt mà vẫn có giờ. "Không tính được" = 1 lượt VÀ Excel ra 0 giờ.
      const excel0 = [r.K1, r.K2, r.K3, r.K4, r.K5, r.K6].every((x) => x === 0)
      if (r.motLuot && excel0) {
        if (n?.doan) lech.push(`${r.nv} ${r.ngay}: Excel 1 lượt, ERP lại tính được`)
        continue
      }
      if (!n?.doan) {
        lech.push(`${r.nv} ${r.ngay} [${r.may}]: ERP không cắt được đoạn làm`)
        continue
      }
      const g = tinhGioNgay(n.doan).theoKhung
      for (const k of ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'] as const) {
        if (gio2(g[k]) !== r[k])
          lech.push(
            `${r.nv} ${r.ngay} [${r.may}] ${k}: ERP ${gio2(g[k])} ≠ Excel ${r[k]}`,
          )
      }
    }
    expect(lech).toEqual([])
  })
})

describe('làm tròn giờ vào buổi tối (cờ lamTronVaoToi, sổ NS T9)', () => {
  it('tắt (mặc định): 20:43 giữ nguyên; bật: 20:43 → 21:00, 20:35 → 20:30', () => {
    expect(lamTronVao(p('20:43'))).toBe(p('20:43'))
    const t = { ...THAM_SO_MAC_DINH, lamTronVaoToi: true }
    expect(lamTronVao(p('20:43'), t)).toBe(p('21:00'))
    expect(lamTronVao(p('20:35'), t)).toBe(p('20:30'))
    expect(lamTronVao(p('13:05'), t)).toBe(p('13:00'))
  })
})
