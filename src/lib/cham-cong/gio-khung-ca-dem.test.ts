import { describe, expect, it } from 'vitest'
import {
  catDoan,
  ghepNgayLam,
  laDoanCaDem,
  THAM_SO_MAC_DINH,
  tinhGioNgay,
  type ThamSoKhung,
} from './gio-khung'

/**
 * KHUNG CA ĐÊM (quy tắc 8, 24/10/2026) — kiểm bằng lượt máy THẬT kỳ T9/2026 của Tổ Phôi /
 * Cơ Điện / Hàn Nhôm / Sơn Sắt (mã người giữ ở tên ca để tra ngược sổ Nhân sự). Tham số = Bản 2
 * (kỳ 10: mốc đủ giờ 45, làm tròn giờ vào buổi tối) + khung K7 Ca đêm 18:00 → 06:00 (+1).
 */
const h = (g: number, p = 0) => g * 60 + p
const T: ThamSoKhung = {
  ...THAM_SO_MAC_DINH,
  nguongDuGio: 45,
  lamTronVaoToi: true,
  khung: [
    ...THAM_SO_MAC_DINH.khung,
    { ma: 'K7', ten: 'Ca đêm', tu: h(18), den: h(30), boPhanLo: false, caDem: true },
  ],
}
const tho = (ngay: Record<string, string>) =>
  Object.entries(ngay).flatMap(([d, s]) => s.split(' ').map((g) => `2026-09-${d} ${g}`))
/** Giờ theo khung của ngày `d` (chỉ các khung có giờ). */
const khungCua = (luot: string[], d: string) => {
  const n = ghepNgayLam(luot, T).find((x) => x.ngay === `2026-09-${d}`)!
  return Object.fromEntries(
    Object.entries(tinhGioNgay(n.doan!, 0, T).theoKhung).filter(([, v]) => v > 0),
  )
}

describe('11 đêm ca thuần 21h → 5h của T9 (sổ NS: TC2 1 giờ + TC3 7 giờ mỗi đêm) đổ hết vào K7', () => {
  it('105 Phan Đình Hậu — 6 đêm: 09, 10, 11, 12, 17, 24/09', () => {
    const l = tho({
      '09': '20:57',
      '10': '04:59 20:53',
      '11': '05:08 20:48',
      '12': '05:00 20:43',
      '13': '04:08',
      '17': '20:45',
      '18': '05:04',
      '24': '20:45',
      '25': '05:26',
    })
    // vào 20:43–20:57 → 21:00 (bậc thang buổi tối); ra 04:59 / 05:08 / 05:00 / 05:04 → 05:00
    expect(khungCua(l, '09')).toEqual({ K7: 480 })
    expect(khungCua(l, '10')).toEqual({ K7: 480 })
    expect(khungCua(l, '11')).toEqual({ K7: 480 })
    // ra 04:08 → 04:00: 7 giờ (sổ NS cũng ghi TC3 6 + TC2 1 = 7)
    expect(khungCua(l, '12')).toEqual({ K7: 420 })
    expect(khungCua(l, '17')).toEqual({ K7: 480 })
    // ra 05:26 → 05:30
    expect(khungCua(l, '24')).toEqual({ K7: 510 })
  })
  it('6037 Trần Thế Bảo 14, 15/09 · 6038 Lê Công Phú 09, 10/09 · 6049 Nguyễn Văn Danh 11/09', () => {
    expect(
      khungCua(tho({ '14': '21:00', '15': '05:14 20:43', '16': '05:03' }), '14'),
    ).toEqual({
      K7: 480,
    })
    expect(
      khungCua(tho({ '14': '21:00', '15': '05:14 20:43', '16': '05:03' }), '15'),
    ).toEqual({
      K7: 480,
    })
    const phu = tho({ '09': '20:52', '10': '04:59 20:44', '11': '05:08' })
    expect(khungCua(phu, '09')).toEqual({ K7: 480 })
    expect(khungCua(phu, '10')).toEqual({ K7: 480 })
    // Cơ Điện 21:00 → 01:00: 4 giờ ca đêm
    expect(khungCua(tho({ '11': '21:00', '12': '01:00' }), '11')).toEqual({ K7: 240 })
  })
  it('tổng 11 đêm = 83,5 giờ ca đêm → 83,5 × 140 % ÷ 8 = 14,61 công (sổ T9 trả 20,9 công theo khung)', () => {
    const gio = (8 * 480 + 420 + 510 + 240) / 60
    expect(gio).toBe(83.5)
    expect(Math.round(((gio * 1.4) / 8) * 100) / 100).toBe(14.61)
  })
})

describe('ngày có hai đoạn: sáng làm theo khung, tối quay lại ca đêm (4 lượt)', () => {
  it('105 ngày 08/09: 06:49 → 11:29 là 4 giờ hành chính; 20:56 → 04:58 là 8 giờ ca đêm', () => {
    const l = tho({ '08': '06:49 11:29 20:56', '09': '04:58' })
    expect(khungCua(l, '08')).toEqual({ K1: 240, K7: 480 })
  })
  it('6049 ngày 24/09: 06:51 → 16:19 đủ công; 21:00 → 05:00 ca đêm — không dính K2–K6', () => {
    const l = tho({ '24': '06:51 16:19 21:00', '25': '05:00' })
    expect(khungCua(l, '24')).toEqual({ K1: 480, K7: 480 })
  })
})

describe('KHÔNG phải ca đêm — vẫn tính theo khung K2–K6', () => {
  it('ca dài 529 ngày 05/09: 07:00 → 05:00 hôm sau (vào sáng)', () => {
    const l = tho({ '05': '07:00', '06': '05:00' })
    const k = khungCua(l, '05')
    expect(k).toEqual({ K1: 480, K2: 180, K3: 180, K4: 120, K5: 300 })
    expect(k.K7).toBeUndefined()
  })
  it('Sơn Sắt 1043 ngày 16/09: 06:54 → 00:01 — tăng ca tới nửa đêm, ra tính 24:00 không qua 0h', () => {
    expect(khungCua(tho({ '16': '06:54', '17': '00:01' }), '16')).toEqual({
      K1: 480,
      K2: 180,
      K3: 180,
      K4: 120,
    })
  })
  it('6037 Chủ nhật 13/09: 15:40 → 04:12 — vào trước giờ tan ca, không phải ca đêm', () => {
    // vào 15:40 → 15:30 (bậc thang chiều), ra 04:12 → 04:00
    expect(khungCua(tho({ '13': '15:40', '14': '04:12' }), '13')).toEqual({
      K1: 30,
      K2: 180,
      K3: 180,
      K4: 120,
      K5: 240,
    })
  })
  it('bản không có khung ca đêm (Bản 1): đoạn 21:00 → 05:00 vẫn ra K3 60 + K4 120 + K5 300', () => {
    const n = ghepNgayLam(tho({ '09': '21:00', '10': '05:00' })).find(
      (x) => x.ngay === '2026-09-09',
    )!
    expect(laDoanCaDem(n.doan![0])).toBe(false)
    expect(tinhGioNgay(n.doan!).theoKhung).toMatchObject({
      K3: 60,
      K4: 120,
      K5: 300,
      K6: 0,
    })
  })
})

describe('phần thừa ngoài khung ca đêm về khung thường (giờ lẻ tính tỉ lệ)', () => {
  // Máy ghép lượt hôm sau vào ca hôm trước tới trước 6:00 (laLuotRaQuaDem); ra 06:00 trở đi
  // Nhân sự bổ sung bằng điều chỉnh "thuộc ngày trước" — nên hai ca này dựng thẳng từ đoạn.
  const doanCua = (vao: number, ra: number) =>
    Object.fromEntries(
      Object.entries(tinhGioNgay(catDoan([vao, ra], T)!, 0, T).theoKhung).filter(([, v]) => v > 0),
    )
  it('vào 17:00, ra 06:30 hôm sau: 1 giờ K2 (17–18h) + 12 giờ K7 + 30 phút K6 (6h–6h30)', () => {
    expect(doanCua(h(17), h(30, 30))).toEqual({ K2: 60, K7: 720, K6: 30 })
  })
  it('trọn ca 18:00 → 06:00 = 12 giờ K7 → 12 × 140 % ÷ 8 = 2,1 công', () => {
    expect(doanCua(h(18), h(30))).toEqual({ K7: 720 })
    expect(((720 / 60) * 1.4) / 8).toBeCloseTo(2.1, 10)
  })
  it('ra 05:59 còn được máy ghép vào ca hôm trước; ra 06:00 thì không (giới hạn ghép lượt)', () => {
    expect(khungCua(tho({ '20': '18:00', '21': '05:59' }), '20')).toEqual({ K7: 720 })
    const n = ghepNgayLam(tho({ '22': '18:00', '23': '06:00' }), T)
    expect(n.map((x) => x.luot.length)).toEqual([1, 1])
  })
})
