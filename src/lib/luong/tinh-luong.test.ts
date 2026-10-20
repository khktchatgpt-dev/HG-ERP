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

const KIEU: HoSoTinh = {
  cachTra: 'daily',
  donGia: 657_000,
  luongThang: null,
  luongBh: 5_310_000,
  coBh: true,
  npt: 1,
  khauTru10: false,
  phuCap: [
    { ten: 'Ăn ca', muc: 400_000, chiuThue: false, theoNgay: true },
    { ten: 'Chuyên cần', muc: 300_000, chiuThue: true, theoNgay: false },
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
    expect(p.dong.find((d) => d.ten.startsWith('K1'))?.tien).toBe(r(8 * 82_125 * 2))
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
      phuCap: [{ ten: 'Chuyên cần', muc: 500_000, chiuThue: true, theoNgay: false }],
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
