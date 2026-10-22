import { describe, expect, it } from 'vitest'
import {
  apBanChot,
  banChotTu,
  CHUA_CO_TO,
  dieuKienChot,
  dieuKienXacNhanTo,
  tongTheoTo,
} from './ky-cong'
import type { NgayGio, NguoiGio } from './ky-gio-cong'

const KM = ['K1', 'K2']
const ngay = (p: Partial<NgayGio> & { ngay: string }): NgayGio => ({
  luot: [420, 1140],
  quaDem: false,
  doan: null,
  k: { K1: 480, K2: 180 },
  trua: 0,
  truaCong: 0,
  xuyenTrua: false,
  tong: 660,
  thieu: false,
  doDang: false,
  nghi: null,
  daSua: false,
  choDuyet: 0,
  ...p,
})
const nguoi = (ma: string, boPhan: string | null, ds: NgayGio[]): NguoiGio => {
  const tong = ds.reduce((s, x) => s + x.tong, 0)
  return {
    ma,
    ten: `Người ${ma}`,
    boPhan,
    cachTinh: 'khung',
    ngay: ds,
    tong: {
      k: { K1: 0, K2: 0 },
      truaCong: 0,
      tong,
      cong: tong / 480,
      ngayCo: ds.filter((x) => x.k).length,
      thieu: ds.filter((x) => x.thieu).length,
      truaCho: 0,
      nghi: 0,
      choDuyet: ds.reduce((s, x) => s + x.choDuyet, 0),
    },
  }
}

const A = nguoi('1', 'Tổ Phôi', [
  ngay({ ngay: '2026-10-01' }),
  ngay({ ngay: '2026-10-02', luot: [420], k: null, tong: 0, thieu: true }),
])
const B = nguoi('2', null, [ngay({ ngay: '2026-10-01', choDuyet: 1 })])

describe('tongTheoTo', () => {
  it('gom theo tổ, "chưa có tổ" đứng cuối, công = cộng công từng người (như Bảng công)', () => {
    expect(tongTheoTo([B, A])).toEqual([
      { ten: 'Tổ Phôi', so: 1, phut: 660, cong: 1.38, thieu: 1, choDuyet: 0, truaCho: 0 },
      {
        ten: CHUA_CO_TO,
        so: 1,
        phut: 660,
        cong: 1.38,
        thieu: 0,
        choDuyet: 1,
        truaCho: 0,
      },
    ])
  })
})

describe('điều kiện', () => {
  const b = { homNay: '2026-10-26', den: '2026-10-25', ngayLay: '2026-10-26' }
  it('trong kỳ: chưa hết kỳ, máy chưa lấy sau ngày cuối', () => {
    const d = dieuKienXacNhanTo(
      { homNay: '2026-10-18', den: '2026-10-25', ngayLay: '2026-10-16' },
      tongTheoTo([A])[0],
    )
    expect(d.map((x) => [x.ma, x.ok])).toEqual([
      ['het_ky', false],
      ['may', false],
      ['cho_duyet', true],
    ])
    expect(d[0].chiTiet).toBe('còn 8 ngày — xác nhận tổ và chốt từ 26/10')
  })
  it('chốt cần: hết kỳ · máy · 0 phiếu chờ · ai cũng có tổ · mọi tổ xác nhận', () => {
    const d = dieuKienChot(b, {
      choDuyet: 0,
      chuaCoTo: 3,
      to: [
        { ten: 'Tổ Phôi', daXacNhan: true },
        { ten: 'Kho', daXacNhan: false },
      ],
    })
    expect(d.filter((x) => !x.ok).map((x) => [x.ma, x.chiTiet])).toEqual([
      ['chua_co_to', '3 người chưa có tổ'],
      ['xac_nhan', '1 / 2 tổ'],
    ])
  })
  it('người không chấm công chưa nhập công chặn chốt (0262); kỳ không có ai thì không thêm ô', () => {
    const v = { choDuyet: 0, chuaCoTo: 0, to: [{ ten: 'Tổ Phôi', daXacNhan: true }] }
    const co = dieuKienChot(b, { ...v, khongCham: { tong: 19, chuaNhap: 3 } })
    expect(co.at(-1)).toEqual({
      ma: 'nhap_tay',
      ten: 'Không chấm công đã nhập công',
      ok: false,
      chiTiet: '16 / 19 người',
    })
    expect(
      dieuKienChot(b, { ...v, khongCham: { tong: 19, chuaNhap: 0 } }).at(-1)?.ok,
    ).toBe(true)
    expect(
      dieuKienChot(b, { ...v, khongCham: { tong: 0, chuaNhap: 0 } }).some(
        (x) => x.ma === 'nhap_tay',
      ),
    ).toBe(false)
  })
})

describe('bản chốt', () => {
  it('ngày thiếu lượt vào bản chốt là 0 giờ (khong), ngày đang dở bị bỏ', () => {
    const r = banChotTu([A])
    expect(r.map((x) => [x.ngay, x.tong, x.khong])).toEqual([
      ['2026-10-01', 660, false],
      ['2026-10-02', 0, true],
    ])
  })
  it('kỳ đã chốt: giờ lấy từ bản chốt, không từ lượt đang có', () => {
    const chot = banChotTu([A])
    // sau khi chốt, có phiếu bổ sung làm ngày 02 tính ra 8 giờ — bản chốt vẫn 0
    const sau = nguoi('1', 'Tổ Phôi', [
      ngay({ ngay: '2026-10-01' }),
      ngay({ ngay: '2026-10-02', tong: 480, k: { K1: 480, K2: 0 } }),
    ])
    const [x] = apBanChot([sau], chot, KM, 480)
    expect(x.ngay.map((d) => [d.ngay, d.tong, d.thieu])).toEqual([
      ['2026-10-01', 660, false],
      ['2026-10-02', 0, false],
    ])
    expect(x.tong.tong).toBe(660)
  })
  it('người có trong bản chốt mà đã nghỉ việc vẫn hiện', () => {
    const r = apBanChot([], banChotTu([A]), KM, 480)
    expect(r.map((x) => [x.ma, x.boPhan, x.tong.tong])).toEqual([['1', 'Tổ Phôi', 660]])
  })
})
