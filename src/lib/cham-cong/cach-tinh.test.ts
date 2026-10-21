import { describe, expect, it } from 'vitest'
import {
  banChoKy,
  duoiLuat,
  kiemKhung,
  kiemQuyTac,
  mucLuat,
  thamSoTuBan,
  tinhTrangBan,
  type KhungBan,
  type QuyTac,
} from './cach-tinh'
import { THAM_SO_MAC_DINH, catDoan, tinhGioNgay } from './gio-khung'

const h = (g: number, p = 0) => g * 60 + p

/** Bản 1 của 0243 — đúng các số đang trong code. */
const KHUNG: KhungBan[] = THAM_SO_MAC_DINH.khung.map((k) => ({
  ma: k.ma,
  ten: k.ten,
  tu: k.tu,
  den: k.den,
  boPhanLo: !!k.boPhanLo,
  hanhChinh: k.ma === 'K1',
}))
const QUY_TAC: QuyTac = {
  truaTu: h(11),
  truaDen: h(12),
  anHanPhut: 30,
  lamTronRaKieu: 'bac_thang',
  nguongNuaGio: 20,
  nguongDuGio: 50,
  lamTronVaoChieu: true,
  lamTronVaoToi: false,
  tinhDenSom: false,
  denSomTu: h(5),
  caDemDen: h(5),
  phutMotCong: 480,
  heSoTrua: 2,
  phutTruaMacDinh: 60,
}

describe('thamSoTuBan', () => {
  it('Bản 1 dựng lại đúng THAM_SO_MAC_DINH — Bảng giờ công không đổi số khi chuyển', () => {
    expect(thamSoTuBan(KHUNG, QUY_TAC)).toEqual(THAM_SO_MAC_DINH)
  })
})

describe('làm tròn kiểu xuống 30 phút theo khung', () => {
  it('giờ ra giữ thực tế; khung bỏ phần lố mất phần dưới 30 phút, hành chính giữ nguyên', () => {
    const t = thamSoTuBan(KHUNG, { ...QUY_TAC, lamTronRaKieu: 'xuong_30' })
    // vào 07:00, ra 18:52 → K1 8 giờ, K2 2:52 → 2:30
    const g = tinhGioNgay(catDoan([h(7), h(18, 52)], t)!, 0, t)
    expect(g.theoKhung.K1).toBe(480)
    expect(g.theoKhung.K2).toBe(150)
    // cùng lượt, bậc thang: ra 18:52 → 19:00 → K2 3 giờ
    const b = tinhGioNgay(catDoan([h(7), h(18, 52)])!, 0)
    expect(b.theoKhung.K2).toBe(180)
  })
})

describe('banChoKy / tinhTrangBan', () => {
  const ban = [
    { id: 'a', so: 1, tuKy: '2026-09' },
    { id: 'b', so: 2, tuKy: '2026-11' },
    { id: 'c', so: 3, tuKy: null },
  ]
  it('kỳ dùng bản có "từ kỳ" lớn nhất không vượt kỳ; bỏ qua nháp', () => {
    expect(banChoKy(ban, '2026-10')?.id).toBe('a')
    expect(banChoKy(ban, '2026-11')?.id).toBe('b')
    expect(banChoKy(ban, '2026-08')).toBeNull()
  })
  it('nhãn: nháp · đang áp dụng (cả bản tương lai) · đã dùng', () => {
    expect(ban.map((b) => tinhTrangBan(b, ban, '2026-10'))).toEqual([
      'ap_dung',
      'ap_dung',
      'nhap',
    ])
    expect(tinhTrangBan(ban[0], ban, '2026-12')).toBe('da_dung')
  })
})

describe('kiemKhung', () => {
  it('Bản 1 hợp lệ', () => {
    expect(kiemKhung(KHUNG)).toEqual([])
  })
  it('chồng giờ gắn lỗi vào khung sau, kèm cách sửa', () => {
    const k = KHUNG.map((x) => (x.ma === 'K4' ? { ...x, tu: h(21) } : x))
    expect(kiemKhung(k)).toEqual([
      { ma: 'K4', loi: 'Chồng K3 21:00–22:00 · sửa "Từ" thành 22:00' },
    ])
  })
  it('hở giờ và không phủ đủ 24 giờ', () => {
    const k = KHUNG.map((x) => (x.ma === 'K3' ? { ...x, den: h(21) } : x))
    expect(kiemKhung(k)[0]).toEqual({
      ma: 'K4',
      loi: 'Hở 21:00–22:00 sau K3 · sửa "Từ" thành 21:00',
    })
    const thieu = KHUNG.filter((x) => x.ma !== 'K6')
    expect(kiemKhung(thieu).at(-1)?.loi).toMatch(/phủ đúng 24 giờ/)
  })
  it('phải có đúng một khung hành chính', () => {
    expect(kiemKhung(KHUNG.map((x) => ({ ...x, hanhChinh: false })))[0].loi).toMatch(
      /đúng một khung hành chính/,
    )
  })
})

describe('kiemQuyTac', () => {
  it('nghỉ trưa ngoài khung hành chính, bậc thang ngược', () => {
    expect(kiemQuyTac(QUY_TAC, KHUNG)).toBeNull()
    expect(kiemQuyTac({ ...QUY_TAC, truaTu: h(16), truaDen: h(17) }, KHUNG)).toMatch(
      /trong khung hành chính/,
    )
    expect(kiemQuyTac({ ...QUY_TAC, nguongNuaGio: 50, nguongDuGio: 20 }, KHUNG)).toMatch(
      /Bậc thang/,
    )
  })
})

describe('mucLuat', () => {
  const k = (ma: string) => KHUNG.find((x) => x.ma === ma)!
  it('hành chính 100 · 200 · 300; làm thêm ban ngày 150 · 200 · 300', () => {
    expect(['thuong', 'cn', 'le'].map((n) => mucLuat(k('K1'), n as never).min)).toEqual([
      100, 200, 300,
    ])
    expect(['thuong', 'cn', 'le'].map((n) => mucLuat(k('K2'), n as never).min)).toEqual([
      150, 200, 300,
    ])
  })
  it('khung trọn ban đêm 200 · 270 · 390; 5h–7h một phần đêm', () => {
    expect(['thuong', 'cn', 'le'].map((n) => mucLuat(k('K4'), n as never).min)).toEqual([
      200, 270, 390,
    ])
    expect(mucLuat(k('K5'), 'thuong')).toMatchObject({ min: 200, ghiChu: 'ban đêm' })
    expect(mucLuat(k('K6'), 'thuong')).toEqual({
      min: 150,
      max: 200,
      ghiChu: 'một phần ban đêm',
    })
  })
  it('ô trống không tính là dưới luật', () => {
    expect(duoiLuat(null, 200)).toBe(false)
    expect(duoiLuat(150, 200)).toBe(true)
    expect(duoiLuat(200, 200)).toBe(false)
  })
})
