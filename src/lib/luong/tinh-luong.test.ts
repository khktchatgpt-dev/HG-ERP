import { describe, expect, it } from 'vitest'
import {
  congChuan,
  thueLuyTien,
  tinhPhieu,
  type BoiCanhTinh,
  type HoSoTinh,
  type NgayTinh,
} from './tinh-luong'

const HE_SO: Record<string, number> = {
  'K1|thuong': 100,
  'K2|thuong': 150,
  'K3|thuong': 150,
  'K4|thuong': 200,
  'K1|cn': 200,
}
const bc = (p: Partial<BoiCanhTinh> = {}): BoiCanhTinh => ({
  thang: '2026-10',
  phutMotCong: 480,
  khung: [
    { ma: 'K1', ten: 'Ca hành chính', hanhChinh: true },
    { ma: 'K2', ten: '16h – 19h', hanhChinh: false },
    { ma: 'K3', ten: '19h – 22h', hanhChinh: false },
    { ma: 'K4', ten: '22h – 24h', hanhChinh: false },
  ],
  congChuan: 25,
  ngayLe: [],
  loaiNgay: (d) => (new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? 'cn' : 'thuong'),
  heSoKhung: (ma, n) => HE_SO[`${ma}|${n}`] ?? null,
  heSoNghi: (ma) => (ma === 'unpaid' || ma === 'sick' ? 0 : 100),
  heSoTrua: 2,
  ptTrua: null,
  truThue: true,
  ...p,
})
const ngay = (
  iso: string,
  k: Record<string, number>,
  p: Partial<NgayTinh> = {},
): NgayTinh => ({
  ngay: iso,
  k,
  trua: 0,
  nghi: null,
  khong: false,
  ...p,
})
/** 23 ngày thường (thứ 2–7 đầu tháng 10/2026), mỗi ngày 8 giờ hành chính. */
const NGAY23 = Array.from(
  { length: 30 },
  (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`,
)
  .filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0)
  .slice(0, 23)

const CHIA = { cach: 'chia' as const, chia: null, coTangCa: false }

const KIEU: HoSoTinh = {
  cachTra: 'daily',
  donGia: 657_000,
  luongThang: null,
  luongBh: 5_310_000,
  coBh: true,
  npt: 1,
  khauTru10: false,
  tangCaGio: null,
  doanPhi: false,
  phuCap: [
    { ten: 'Ăn ca', muc: 400_000, chiuThue: false, theoNgay: true, ...CHIA },
    { ten: 'Chuyên cần', muc: 300_000, chiuThue: true, theoNgay: false, ...CHIA },
  ],
}

describe('phiếu lương theo công — ví dụ trong bản vẽ B5', () => {
  const ngays = NGAY23.map((d, i) =>
    ngay(d, i === 0 ? { K1: 480, K2: 51 * 60, K3: 39 * 60, K4: 13 * 60 } : { K1: 480 }),
  )
  const p = tinhPhieu(KIEU, ngays, [{ loai: 'advance', tien: 2_000_000 }], bc())
  it('lương công, tăng ca từng khung, giá giờ = đơn giá ÷ 8', () => {
    expect(p.luongCong).toBe(15_111_000)
    expect(p.dong.filter((d) => d.nhom === 'tang_ca').map((d) => d.tien)).toEqual([
      6_282_563, 4_804_313, 2_135_250,
    ])
    expect(p.tangCa).toBe(13_222_126)
  })
  it('phụ cấp chia theo công thực 23/25; ăn ca theo 23 ngày đi làm (Q2)', () => {
    expect(p.phuCap).toBe(368_000 + 276_000)
  })
  it('BH 10,5 % lương đóng BH; thuế 0 vì tăng ca miễn + giảm trừ; thực lĩnh trừ tạm ứng', () => {
    expect(p.bhNld).toBe(557_550)
    expect(p.bhDn).toBe(1_141_650)
    expect(p.thue).toBe(0)
    expect(p.tong).toBe(15_111_000 + 13_222_126 + 644_000)
    expect(p.thucLinh).toBe(28_977_126 - 557_550 - 2_000_000)
    expect(p.thieuHeSo).toEqual([])
    expect(p.why.at(-1)).toBe('Thực lĩnh = 26.419.576')
  })
})

describe('các trường hợp khác', () => {
  it('ô hệ số trống mà có giờ → báo thiếu, tiền dòng đó 0 (Q1)', () => {
    const p = tinhPhieu(KIEU, [ngay('2026-10-04', { K1: 480, K2: 60 })], [], bc())
    // 04/10/2026 là chủ nhật: K1 CN có hệ số 200, K2 CN chưa có
    expect(p.thieuHeSo).toEqual(['K2 CN'])
    // Chủ nhật làm hành chính = ngày công (sổ KT), không thành dòng tăng ca
    expect(p.luongCong).toBe(r(657_000 * 2))
    expect(p.dong.some((d) => d.ten.startsWith('K1'))).toBe(false)
  })
  it('theo tháng: lương tháng × công thực ÷ công chuẩn, nghỉ phép tính như ngày làm', () => {
    const hs: HoSoTinh = {
      ...KIEU,
      cachTra: 'monthly',
      donGia: null,
      luongThang: 12_000_000,
      phuCap: [],
    }
    const ngays = [
      ...NGAY23.map((d) => ngay(d, { K1: 480 })),
      ngay('2026-10-28', {}, { nghi: 'annual' }),
    ]
    expect(tinhPhieu(hs, ngays, [], bc()).luongCong).toBe(r((12_000_000 * 24) / 25))
  })
  it('người không chấm công: đủ công chuẩn', () => {
    const hs: HoSoTinh = {
      ...KIEU,
      cachTra: 'monthly',
      donGia: null,
      luongThang: 9_500_000,
      phuCap: [],
    }
    expect(tinhPhieu(hs, [], [], bc(), true).luongCong).toBe(9_500_000)
  })
  it('không chấm công, nghỉ giữa kỳ: theo phần công chuẩn còn làm (0248)', () => {
    const hs: HoSoTinh = {
      ...KIEU,
      cachTra: 'monthly',
      donGia: null,
      luongThang: 9_500_000,
      phuCap: [
        { ten: 'Chuyên cần', muc: 500_000, chiuThue: true, theoNgay: false, ...CHIA },
      ],
    }
    const p = tinhPhieu(hs, [], [], bc(), 10)
    expect(p.luongCong).toBe(3_800_000)
    expect(p.phuCap).toBe(200_000)
    expect(tinhPhieu({ ...KIEU, phuCap: [] }, [], [], bc(), 10).luongCong).toBe(6_570_000)
    // Số công lớn hơn công chuẩn bị chặn ở công chuẩn.
    expect(tinhPhieu(hs, [], [], bc(), 30).luongCong).toBe(9_500_000)
  })
  it('khấu trừ 10 % (Q4); trần BH 50,6 triệu từ kỳ 07/2026', () => {
    const hs: HoSoTinh = { ...KIEU, khauTru10: true, luongBh: 80_000_000, phuCap: [] }
    const p = tinhPhieu(
      hs,
      NGAY23.map((d) => ngay(d, { K1: 480 })),
      [],
      bc(),
    )
    expect(p.thue).toBe(r(15_111_000 * 0.1))
    expect(p.bhNld).toBe(r(50_600_000 * 0.105))
  })
  it('thực lĩnh âm được báo', () => {
    const p = tinhPhieu(
      KIEU,
      [ngay('2026-10-01', { K1: 480 })],
      [{ loai: 'advance', tien: 5_000_000 }],
      bc(),
    )
    expect(p.canhBao).toContain('Thực lĩnh âm')
  })
})

describe('thuế luỹ tiến 5 bậc', () => {
  it('10 tr đầu 5 %, 10–30 tr 10 %', () => {
    expect(thueLuyTien(20_000_000)).toBe(500_000 + 1_000_000)
    expect(thueLuyTien(-1)).toBe(0)
    expect(thueLuyTien(120_000_000)).toBe(
      500_000 + 2_000_000 + 6_000_000 + 12_000_000 + 7_000_000,
    )
  })
})

describe('công chuẩn', () => {
  it('kỳ 10/2026 = 30 ngày − 5 chủ nhật = 25', () => {
    expect(congChuan('2026-09-26', '2026-10-25', [])).toBe(25)
    expect(congChuan('2026-09-26', '2026-10-25', ['2026-10-01'])).toBe(24)
  })
})

function r(n: number) {
  return Math.round(n)
}

// ── Khớp sổ lương Kế toán T9/2026 (kỳ 26/08 → 25/09). Số kỳ vọng là số TRONG SỔ; ERP làm tròn
// đến đồng từng dòng nên thực lĩnh lệch sổ dưới 1 đồng.
describe('khớp sổ lương T9 của Kế toán', () => {
  const TC = 400 / 3 // KT: công tăng ca = giờ × 0,5 ÷ 3 → 133,33 %
  const HS_T9: Record<string, number> = {
    'K1|thuong': 100,
    'K1|cn': 100,
    'K2|thuong': TC,
    'K3|thuong': TC,
    'K2|cn': TC,
    'K3|cn': TC,
    'K4|thuong': 210,
  }
  const t9 = bc({
    thang: '2026-09',
    congChuan: 26,
    heSoKhung: (ma, n) => HS_T9[`${ma}|${n}`] ?? null,
    ptTrua: 210,
    truThue: false,
  })
  /** `n` ngày liền từ 26/08, mỗi ngày 8 giờ hành chính (gồm cả chủ nhật — KT đếm vào công). */
  const ngayCong = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10),
    ).map((d) => ngay(d, { K1: 480 }))
  /** Công tăng ca trong sổ → phút thật của khung (công × 6 giờ ở 133 %). */
  const phutTc = (cong: number) => cong * 6 * 60
  const chia = (muc: number, so: number, ten = 'PC') => ({
    ten,
    muc,
    chiuThue: true,
    theoNgay: false,
    cach: 'chia' as const,
    chia: so,
    coTangCa: false,
  })
  const BH = { coBh: true, luongBh: 3_960_000, npt: 0, khauTru10: false, doanPhi: true }

  it('TTSX · Lương Đức Hậu (00441): 350.000/công, 25 công, TC 10,61 + 1,42 công', () => {
    const ds = ngayCong(25)
    ds[0] = ngay(ds[0].ngay, { K1: 480, K2: phutTc(10.61), K3: phutTc(1.42) })
    const p = tinhPhieu(
      {
        ...BH,
        cachTra: 'daily',
        donGia: 350_000,
        luongThang: null,
        tangCaGio: null,
        phuCap: [],
      },
      ds,
      [],
      t9,
    )
    expect(p.luongCong).toBe(8_750_000) // M = 25 × 350.000
    expect(p.tangCa).toBe(4_210_500) // N = 12,03 × 350.000
    expect(p.bhNld).toBe(415_800)
    expect(p.doanPhi).toBe(19_800)
    expect(p.thucLinh).toBe(12_524_900) // AF
  })

  it('GTSX · Lê Khắc Hào (00010): lương tháng 7,7 tr ÷ 26, 31 công, phụ cấp ÷ 32', () => {
    const ds = ngayCong(31)
    ds[0] = ngay(ds[0].ngay, { K1: 480, K2: phutTc(12.58), K3: phutTc(0.58) })
    const p = tinhPhieu(
      {
        ...BH,
        cachTra: 'monthly',
        donGia: null,
        luongThang: 7_700_000,
        tangCaGio: null,
        phuCap: [chia(1_000_000, 32, 'Trách nhiệm'), chia(300_000, 32, 'Điện thoại')],
      },
      ds,
      [],
      t9,
    )
    expect(p.luongCong).toBe(9_180_769) // J = 7,7 tr ÷ 26 × 31
    expect(p.tangCa).toBe(3_897_384) // K = 7,7 tr ÷ 26 × 13,16 (sổ 3.897.384,6)
    expect(p.phuCap).toBe(968_750 + 290_625) // O, R
    expect(p.thucLinh).toBe(13_901_928) // AA = 13.901.928,85
  })

  it('QC · Võ Văn Cương (00146): tăng ca khoán 20.000 đ/giờ, cơm 25.000 × công, khoản cố định', () => {
    const ds = ngayCong(31)
    ds[0] = ngay(ds[0].ngay, { K1: 480, K2: 35 * 60 })
    const p = tinhPhieu(
      {
        ...BH,
        luongBh: 4_328_000,
        cachTra: 'monthly',
        donGia: null,
        luongThang: 8_000_000,
        tangCaGio: 20_000,
        phuCap: [
          chia(2_000_000, 32, 'Trách nhiệm'),
          { ...chia(25_000, 0, 'Cơm'), cach: 'nhan' as const, chia: null },
          { ...chia(885_516, 0, 'Xăng'), cach: 'co_dinh' as const, chia: null },
          chia(300_000, 32, 'Điện thoại'),
          { ...chia(500_000, 0, 'Khác'), cach: 'co_dinh' as const, chia: null },
        ],
      },
      ds,
      [],
      t9,
    )
    expect(p.tangCa).toBe(700_000) // H = 35 giờ × 20.000
    expect(p.phuCap).toBe(1_937_500 + 775_000 + 885_516 + 290_625 + 500_000)
    expect(p.bhNld).toBe(454_440)
    expect(p.doanPhi).toBe(21_640)
    expect(p.thucLinh).toBe(14_151_023) // T = 14.151.022,54
  })

  it('VP · Trương Văn Hùng (6011): 27 công > 26 — lương và phụ cấp không có trần', () => {
    const p = tinhPhieu(
      {
        ...BH,
        luongBh: 1_127_518 / 0.105,
        cachTra: 'monthly',
        donGia: null,
        luongThang: 15_000_000,
        tangCaGio: null,
        phuCap: [chia(1_500_000, 26, 'Trách nhiệm'), chia(300_000, 26, 'Điện thoại')],
      },
      ngayCong(27),
      [],
      t9,
    )
    expect(p.luongCong).toBe(15_576_923) // J = 15 tr ÷ 26 × 27
    expect(p.phuCap).toBe(1_557_692 + 311_538)
    expect(p.bhNld).toBe(1_127_518)
    expect(p.doanPhi).toBe(53_691)
    expect(p.thucLinh).toBe(16_264_944) // W = 16.264.944,85
  })

  it('độc hại nhân theo (công + công tăng ca) — sổ TTSX "(F+L) × mức"', () => {
    const ds = ngayCong(20)
    ds[0] = ngay(ds[0].ngay, { K1: 480, K2: phutTc(4) })
    const p = tinhPhieu(
      {
        ...BH,
        cachTra: 'daily',
        donGia: 300_000,
        luongThang: null,
        tangCaGio: null,
        phuCap: [
          {
            ...chia(10_000, 0, 'Độc hại'),
            cach: 'nhan' as const,
            chia: null,
            coTangCa: true,
          },
        ],
      },
      ds,
      [],
      t9,
    )
    expect(p.phuCap).toBe(240_000) // (20 + 4) × 10.000
  })

  it('giờ giải lao trả 210 %; thuế chỉ tính, không trừ (Q5)', () => {
    const ds = ngayCong(1)
    // chốt công lưu phút trưa đã × 2 → 60 phút thật
    ds[0] = { ...ds[0], trua: 120 }
    const p = tinhPhieu(
      {
        ...BH,
        cachTra: 'daily',
        donGia: 400_000,
        luongThang: null,
        tangCaGio: null,
        phuCap: [],
      },
      ds,
      [{ loai: 'bonus', tien: 40_000_000 }],
      t9,
    )
    expect(p.dong.find((d) => d.ten === 'Giờ giải lao')?.tien).toBe(105_000) // 1 giờ × 50.000 × 210 %
    expect(p.luongCong).toBe(400_000)
    expect(p.thue).toBeGreaterThan(0)
    expect(p.truThue).toBe(false)
    expect(p.thucLinh).toBe(p.tong - p.bhNld - p.doanPhi)
  })
})
