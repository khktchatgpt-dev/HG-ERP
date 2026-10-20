import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest } from '@/server/http'
import {
  congNgay,
  kyCuaThang,
  thangCuaNgay,
  tinhKyGioCong,
  type CachTinh,
  type NguoiGio,
} from '@/lib/cham-cong/ky-gio-cong'
import {
  chiTietNgay,
  nhanTc,
  type CongNgay,
  type NhomTc,
} from '@/lib/cham-cong/chi-tiet-cong'
import { chamCongRepo } from './cham-cong.repo'
import type { DieuChinh } from '@/lib/cham-cong/dieu-chinh'
import { chamCongService, type MotNguoi } from './cham-cong.service'
import { quyenDieuChinh, type QuyenDieuChinh } from './dieu-chinh.service'
import { gioCongRepo } from './gio-cong.repo'
import { cachTinhService } from './cach-tinh.service'
import { kyCongRepo, type KyDong } from './ky-cong.repo'
import { apBanChot } from '@/lib/cham-cong/ky-cong'
import { kiemKhoaKy } from './ky-khoa'

/**
 * BẢNG GIỜ CÔNG — giờ theo khung cả kỳ (26 → 25) cho từng người, theo luật thật của
 * Nhân sự (`lib/cham-cong/gio-khung.ts`, khớp 241/241 ngày file Tổ sơn sắt T9). Tham số
 * lấy từ BẢN cách tính áp dụng cho kỳ (B2, 0243) — đổi bản không đổi số kỳ trước.
 */

export type GioCong = {
  thang: string
  tu: string
  den: string
  homNay: string
  nguoi: NguoiGio[]
  /** Mọi bộ phận có người, kèm cách tính. */
  boPhan: { ten: string; so: number; cachTinh: CachTinh }[]
  khung: { ma: string; ten: string }[]
  /** Bản cách tính kỳ này dùng (null = chưa có bản, đang dùng số mặc định). */
  ban: number | null
  banId: string | null
  /** Ngày (giờ VN) lấy dữ liệu máy thành công gần nhất. */
  ngayLay: string | null
  /** Dòng kỳ công (B3) — null = kỳ chưa có chuyển tiếp nào, tức đang mở. */
  ky: KyDong | null
  heSoTrua: number
  /** Phút một công của bản cách tính kỳ này. */
  phutMotCong: number
  phutTruaMacDinh: number
  khongCham: number
  /** Điều chỉnh của kỳ (mọi tình trạng) — ngăn điều chỉnh tự lọc. */
  dieuChinh: DieuChinh[]
  /** 'ma|ngay' → lượt MÁY gốc (chưa áp điều chỉnh) — cho ngăn điều chỉnh. */
  luotMay: Record<string, { gio: string; may: string }[]>
  quyen: QuyenDieuChinh & { trua: boolean; cachTinh: boolean }
}

const CHUA_CO = '(chưa có bộ phận)'

/** Mỗi kỳ là một lượt tính cả công ty — trang một người tính tối đa ngần này kỳ. */
const KY_TOI_DA = 3

const sauThang = (t: string) => {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
}

/** Công từng ngày của một người — hoặc lý do không tính (chỉ bày lượt). */
export type ChiTietNguoi =
  | {
      cachTinh: CachTinh
      /** Khoảng giờ của TC1/TC2/TC3 theo bản cách tính, vd. '16–19h'. */
      nhanTc: Record<NhomTc, string>
      phutMotCong: number
      ban: number | null
      /** Có kỳ trong khoảng đã chốt (giờ lấy từ bản chốt). */
      daChot: boolean
      ngay: CongNgay[]
    }
  | { loi: string }

/** Dữ liệu trang Chấm công một người: lượt quẹt + công từng ngày (route `nguoi`). */
export type MotNguoiCong = MotNguoi & { tinh: ChiTietNguoi }

export const gioCongService = {
  async bang(user: User, thang: string, homNay: string): Promise<GioCong> {
    await assertAction(user, 'hr.attendance.view')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang))
      throw BadRequest('Tháng phải dạng YYYY-MM')
    const k = kyCuaThang(thang)
    // Lấy dư một ngày hai đầu: ca đêm ngày cuối kỳ cần lượt rạng sáng hôm sau; lượt rạng
    // sáng ngày đầu kỳ có thể thuộc ca đêm hôm trước (không được tính vào kỳ này).
    const [du, trua, cachTinh, quyen, quyenSua, ct, ky] = await Promise.all([
      chamCongService.duLieu(user, { tu: congNgay(k.tu, -1), den: congNgay(k.den, 1) }),
      gioCongRepo.trua(k.tu, k.den),
      gioCongRepo.cachTinh(),
      quyenDieuChinh(user),
      canAction(user, 'hr.attendance.employee_edit'),
      cachTinhService.thamSoChoKy(thang),
      kyCongRepo.ky(thang),
    ])
    const t = ct.thamSo
    // Ngày lấy dữ liệu lần cuối (giờ VN) trở đi là ngày đang dở: lấy giữa ngày thì chưa có
    // lượt ra — 1 lượt hôm đó không phải lỗi chấm công.
    const lanOk = du.lanCuoi
      .filter((x) => x.ok)
      .map((x) => x.batDau)
      .sort()
      .at(-1)
    const ngayLay = lanOk
      ? new Date(Date.parse(lanOk) + 7 * 3600_000).toISOString().slice(0, 10)
      : homNay
    const song = tinhKyGioCong({
      ngayDoDang: ngayLay < homNay ? ngayLay : homNay,
      tu: k.tu,
      den: k.den,
      nhanSu: du.nhanSu,
      dong: du.dong,
      dieuChinh: du.dieuChinh,
      trua,
      cachTinh,
      thamSo: t,
    })
    // Kỳ đã chốt (B3): giờ từng ngày lấy từ BẢN CHỐT; lượt máy vẫn bày để soi.
    const nguoi =
      ky && ky.trangThai !== 'open' && ky.lanChot > 0
        ? apBanChot(
            song,
            await kyCongRepo.banChot(ky.id, ky.lanChot),
            t.khung.map((x) => x.ma),
            t.phutMotCong,
          )
        : song
    const dem = new Map<string, number>()
    for (const n of du.nhanSu)
      dem.set(n.boPhan ?? CHUA_CO, (dem.get(n.boPhan ?? CHUA_CO) ?? 0) + 1)
    const boPhan = [...dem]
      .map(([ten, so]) => ({ ten, so, cachTinh: cachTinh[ten] ?? ('khung' as CachTinh) }))
      .sort(
        (a, b) =>
          (a.ten === CHUA_CO ? 1 : 0) - (b.ten === CHUA_CO ? 1 : 0) || b.so - a.so,
      )
    return {
      thang,
      tu: k.tu,
      den: k.den,
      homNay,
      nguoi: nguoi.map((n) => ({ ...n, boPhan: n.boPhan ?? CHUA_CO })),
      boPhan,
      khung: t.khung.map((x) => ({ ma: x.ma, ten: x.ten })),
      ban: ct.ban,
      banId: ct.banId,
      ngayLay: lanOk ? ngayLay : null,
      ky,
      heSoTrua: t.heSoTrua,
      phutMotCong: t.phutMotCong,
      phutTruaMacDinh: t.phutTruaMacDinh,
      khongCham: du.khongCham,
      dieuChinh: du.dieuChinh.filter((d) => d.ngay >= k.tu && d.ngay <= k.den),
      luotMay: Object.fromEntries(
        du.dong
          .filter((r) => r.daGhep && r.ngay >= k.tu && r.ngay <= k.den)
          .map((r) => [
            `${r.ma}|${r.ngay}`,
            r.luot.map((l) => ({ gio: l.gio, may: l.may })),
          ]),
      ),
      quyen: { ...quyen, trua: quyen.gui, cachTinh: quyenSua },
    }
  },

  /**
   * CÔNG TỪNG NGÀY CỦA MỘT NGƯỜI (trang Chấm công một người, bản vẽ 20/10/2026). Giờ lấy
   * từ CHÍNH `bang()` của từng kỳ mà khoảng chạm tới — kể cả bản chốt — nên số khớp
   * Bảng công; `chiTietNgay` chỉ chia ra công / TC1–3 / trễ / sớm.
   */
  async chiTietNguoi(
    user: User,
    ma: string,
    k: { tu: string; den: string },
    homNay: string,
  ): Promise<ChiTietNguoi> {
    const thangs: string[] = []
    for (let t = thangCuaNgay(k.tu); t <= thangCuaNgay(k.den); t = sauThang(t))
      thangs.push(t)
    if (thangs.length > KY_TOI_DA)
      return {
        loi: `Tính công tối đa ${KY_TOI_DA} kỳ một lần — khoảng này chạm ${thangs.length} kỳ. Thu hẹp khoảng ngày để xem công.`,
      }
    const [kys, ts, le] = await Promise.all([
      Promise.all(thangs.map((t) => this.bang(user, t, homNay))),
      Promise.all(thangs.map((t) => cachTinhService.thamSoChoKy(t))),
      chamCongRepo.holidays(k.tu, congNgay(k.den, 1)),
    ])
    const tenLe = Object.fromEntries(le.map((x) => [x.holiday_date, x.name]))
    const ngay: CongNgay[] = []
    let cachTinh: CachTinh | null = null
    let co = false
    kys.forEach((b, i) => {
      const n = b.nguoi.find((x) => x.ma === ma)
      if (!n) return
      co = true
      cachTinh = n.cachTinh
      const theoNgay = new Map(n.ngay.map((x) => [x.ngay, x]))
      const tu = b.tu > k.tu ? b.tu : k.tu
      const den = b.den < k.den ? b.den : k.den
      for (let d = tu; d <= den && d <= homNay; d = congNgay(d, 1))
        ngay.push(chiTietNgay(d, theoNgay.get(d), ts[i].thamSo, n.cachTinh, tenLe))
    })
    if (!co)
      return {
        loi: 'Người này không có trong Bảng công (không chấm công, đã nghỉ, hoặc chưa ghép mã máy) — chỉ bày lượt quẹt.',
      }
    const t = ts[ts.length - 1].thamSo
    return {
      cachTinh: cachTinh ?? 'khung',
      nhanTc: nhanTc(t),
      phutMotCong: t.phutMotCong,
      ban: ts[ts.length - 1].ban,
      daChot: kys.map((b) => b.ky?.trangThai ?? 'open').some((s) => s !== 'open'),
      ngay,
    }
  },

  /** Ghi / bỏ tick làm trưa (sổ tay tổ trưởng) cho một hoặc nhiều người-ngày. */
  async ghiTrua(
    user: User,
    muc: { ma: string; ngay: string; phut: number | null }[],
  ): Promise<number> {
    await assertAction(user, 'hr.attendance.adjust')
    await kiemKhoaKy([...new Set(muc.map((m) => m.ngay))])
    const id = await gioCongRepo.idTheoMa(muc.map((m) => m.ma))
    const thieu = muc.filter((m) => !id.has(m.ma))
    if (thieu.length) throw BadRequest(`Không có nhân viên mã ${thieu[0].ma}`)
    await gioCongRepo.ghiTrua(
      muc.map((m) => ({ employeeId: id.get(m.ma)!, ngay: m.ngay, phut: m.phut })),
      user.id,
    )
    return muc.length
  },

  /** Đổi cách tính của một bộ phận (khung / theo ngày). */
  async ghiCachTinh(user: User, boPhan: string, cachTinh: CachTinh): Promise<void> {
    await assertAction(user, 'hr.attendance.employee_edit')
    if (boPhan === CHUA_CO)
      throw BadRequest('Gán bộ phận cho người trước, rồi mới chọn cách tính')
    await gioCongRepo.ghiCachTinh(boPhan, cachTinh, user.id)
  },
}
