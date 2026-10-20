import { describe, expect, it } from 'vitest'
import { chiTietNgay, nhanTc, nhomKhung, tongCong } from './chi-tiet-cong'
import { THAM_SO_MAC_DINH as T } from './gio-khung'
import { tinhKyGioCong, type KyGioVao } from './ky-gio-cong'

const l = (...g: string[]) => g.map((gio) => ({ gio: `${gio}:00`, may: 'Máy 1' }))
const vao = (dong: KyGioVao['dong'], p: Partial<KyGioVao> = {}): KyGioVao => ({
  tu: '2026-08-26',
  den: '2026-09-25',
  nhanSu: [{ ma: 'A', ten: 'Người A', boPhan: 'Tổ Phôi' }],
  dong,
  dieuChinh: [],
  trua: {},
  cachTinh: {},
  ...p,
})
const ngay = (ngay: string, ...gio: string[]) => ({
  ngay,
  ma: 'A',
  daGhep: true,
  luot: l(...gio),
})
const motNgay = (iso: string, ...gio: string[]) => {
  const [a] = tinhKyGioCong(vao([ngay(iso, ...gio)]))
  return chiTietNgay(
    iso,
    a.ngay.find((x) => x.ngay === iso),
    T,
    'khung',
    {},
  )
}

describe('nhóm khung', () => {
  it('K1 hành chính; K2 = TC1, K3 = TC2, K4–K6 = TC3', () => {
    expect(nhomKhung(T)).toEqual({
      K1: 'hc',
      K2: 'tc1',
      K3: 'tc2',
      K4: 'tc3',
      K5: 'tc3',
      K6: 'tc3',
    })
    expect(nhanTc(T)).toEqual({ tc1: '16–19h', tc2: '19–22h', tc3: 'sau 22h' })
  })
})

// Số thật tổ Phôi kỳ 09/2026 (bản vẽ 20/10/2026) — đối chiếu tờ "Chi tiết" phần mềm cũ.
describe('chiTietNgay', () => {
  it('06:47 → 21:02: 1 công, TC1 3 giờ, TC2 2 giờ (luật Nhân sự không cộng 0,17)', () => {
    const d = motNgay('2026-09-04', '06:47', '21:02')
    expect(d).toMatchObject({
      loai: 'thuong',
      cap: [{ vao: '06:47', ra: '21:02', vaoTinh: '07:00', raTinh: '21:00' }],
      luotLe: [],
      hc: 480,
      tc1: 180,
      tc2: 120,
      tc3: 0,
      tre: 0,
      som: 0,
    })
  })
  it('chủ nhật 06:42 → 15:10: 7 giờ hành chính, về sớm 50 phút theo giờ máy', () => {
    const d = motNgay('2026-09-06', '06:42', '15:10')
    expect(d).toMatchObject({ loai: 'cn', hc: 420, som: 50, tre: 0 })
  })
  it('vào 07:20 trong ân hạn: không trễ; vào 07:45: trễ 45 phút', () => {
    expect(motNgay('2026-09-07', '07:20', '16:05').tre).toBe(0)
    expect(motNgay('2026-09-07', '07:45', '16:05').tre).toBe(45)
  })
  it('chỉ 1 lượt 21:02: thiếu lượt, KHÔNG ghi trễ 840 phút như phần mềm cũ', () => {
    const d = motNgay('2026-09-14', '21:02')
    expect(d).toMatchObject({ thieu: true, tinhDuoc: false, tre: 0, hc: 0 })
  })
  it('ca qua đêm 15:40 → 04:12 hôm sau: giờ sau 22h vào TC3', () => {
    const [a] = tinhKyGioCong(
      vao([ngay('2026-09-13', '15:40'), ngay('2026-09-14', '04:12')]),
    )
    const d = chiTietNgay(
      '2026-09-13',
      a.ngay.find((x) => x.ngay === '2026-09-13'),
      T,
      'khung',
      {},
    )
    expect(d).toMatchObject({ hc: 30, tc1: 180, tc2: 180, tc3: 360 })
    expect(d.cap).toEqual([
      { vao: '15:40', ra: '04:12(+1)', vaoTinh: '15:30', raTinh: '04:00(+1)' },
    ])
  })
  it('làm hai ca (4 lượt, ca sau qua đêm): hai cặp Vào/Ra riêng', () => {
    // Số thật tổ Phôi 08/09/2026 — phần mềm cũ ghép sai cặp và ghi trễ 825 phút.
    const [a] = tinhKyGioCong(
      vao([ngay('2026-09-08', '06:49', '11:29', '20:56'), ngay('2026-09-09', '04:58')]),
    )
    const d = chiTietNgay(
      '2026-09-08',
      a.ngay.find((x) => x.ngay === '2026-09-08'),
      T,
      'khung',
      {},
    )
    expect(d.cap.map((p) => [p.vao, p.ra])).toEqual([
      ['06:49', '11:29'],
      ['20:56', '04:58(+1)'],
    ])
    expect(d).toMatchObject({ luotLe: [], tre: 0, thieu: false })
  })
  it('3 lượt: tính đầu → cuối, lượt giữa ghi rõ là không tính', () => {
    const d = motNgay('2026-09-22', '06:40', '18:40', '21:14')
    expect(d.cap.map((p) => [p.vao, p.ra])).toEqual([['06:40', '21:14']])
    expect(d.luotLe).toEqual(['18:40'])
  })
  it('làm trưa đã tick cộng vào công hành chính', () => {
    const [a] = tinhKyGioCong(
      vao([ngay('2026-09-04', '06:47', '16:02')], { trua: { 'A|2026-09-04': 60 } }),
    )
    const d = chiTietNgay('2026-09-04', a.ngay[0], T, 'khung', {})
    expect(d.hc).toBe(480 + 120)
  })
  it('cách tính theo ngày (văn phòng): 1 công, không trễ/sớm', () => {
    const [a] = tinhKyGioCong(
      vao([ngay('2026-09-04', '08:40')], { cachTinh: { 'Tổ Phôi': 'ngay' } }),
    )
    const d = chiTietNgay('2026-09-04', a.ngay[0], T, 'ngay', {})
    expect(d).toMatchObject({ hc: 480, tre: 0, som: 0, tinhDuoc: true })
    expect(d.cap).toEqual([{ vao: '08:40', ra: null, vaoTinh: null, raTinh: null }])
  })
  it('ngày lễ lấy tên từ danh mục lễ', () => {
    expect(
      chiTietNgay('2026-09-02', undefined, T, 'khung', { '2026-09-02': 'Quốc khánh' }),
    ).toMatchObject({ loai: 'le', tenLe: 'Quốc khánh', coLuot: false })
  })
})

describe('tongCong', () => {
  it('tách công thường / CN / lễ, đếm vắng chỉ ngày thường đã lấy dữ liệu', () => {
    const le = { '2026-09-02': 'Quốc khánh' }
    const [a] = tinhKyGioCong(
      vao([
        ngay('2026-09-01', '06:44', '19:03'),
        ngay('2026-09-06', '06:42', '15:10'),
        ngay('2026-09-14', '21:02'),
      ]),
    )
    const ds = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-06',
      '2026-09-14',
      '2026-09-15',
    ].map((iso) =>
      chiTietNgay(
        iso,
        a.ngay.find((x) => x.ngay === iso),
        T,
        'khung',
        le,
      ),
    )
    const t = tongCong(ds, (iso) => iso !== '2026-09-15')
    expect(t).toMatchObject({
      hcThuong: 480,
      hcCn: 420,
      hcLe: 0,
      tc1: 180,
      thieu: 1,
      vang: 1, // 03/09; 02/09 là lễ, 14/09 thiếu lượt, 15/09 chưa lấy dữ liệu
      lanSom: 1,
      phutSom: 50,
      ngayThuong: 3,
      chuNhat: 1,
      cnCoLam: 1,
      ngayLe: 1,
    })
  })
})
