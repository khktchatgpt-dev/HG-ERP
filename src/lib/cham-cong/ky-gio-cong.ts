/**
 * GIỜ CÔNG CẢ KỲ — ghép lượt máy + điều chỉnh đã duyệt + sổ làm trưa + cách tính theo
 * bộ phận, rồi tính giờ theo khung (`gio-khung.ts`) cho từng người từng ngày. Hàm thuần.
 *
 * Chủ dự án duyệt 5 câu 17/10/2026:
 *   1. Bộ phận có "cách tính": KHUNG (sản xuất, mặc định) hoặc NGÀY (văn phòng — chỉ quẹt
 *      1 lần/ngày): có lượt = đủ giờ một công ở khung hành chính; có thêm lượt ra sau giờ
 *      tan ca thì tính tiếp các khung sau.
 *   2. Kỳ công 26 tháng trước → 25 tháng này.
 *   3. Ô bảng ghi GIỜ trong ngày; cột tổng có giờ + công (giờ ÷ 8).
 *   4. Làm trưa tick trên ô: phút × hệ số cộng vào khung hành chính.
 *   5. Hệ số tiền theo khung không ở đây — Kế toán nhập ở bước tổng hợp.
 */

import {
  THAM_SO_MAC_DINH,
  ghepNgayLam,
  tinhGioNgay,
  xuyenTrua,
  type DoanLam,
  type ThamSoKhung,
} from './gio-khung'
import { apDieuChinh, theoNguoiNgay, type DieuChinh, type LoaiNghi } from './dieu-chinh'

export type CachTinh = 'khung' | 'ngay'

/** Ngày bắt đầu kỳ: kỳ tháng M chạy từ ngày này của tháng M−1 tới ngày (này − 1) của tháng M. */
export const NGAY_DAU_KY = 26

const isoUtc = (y: number, m0: number, d: number) =>
  new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10)

/** Kỳ công của tháng 'YYYY-MM' → { tu, den } ('YYYY-MM-DD', tính cả hai đầu). */
export function kyCuaThang(thang: string): { tu: string; den: string } {
  const [y, m] = thang.split('-').map(Number)
  return { tu: isoUtc(y, m - 2, NGAY_DAU_KY), den: isoUtc(y, m - 1, NGAY_DAU_KY - 1) }
}

/** Ngày 'YYYY-MM-DD' thuộc kỳ của tháng nào ('YYYY-MM'): từ ngày 26 là kỳ tháng sau. */
export function thangCuaNgay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoUtc(y, d >= NGAY_DAU_KY ? m : m - 1, 1).slice(0, 7)
}

/** Ngày liền trước / liền sau. */
export function congNgay(iso: string, n: number): string {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

export type NgayGio = {
  ngay: string
  /** Lượt dùng để tính (đã áp bổ sung / bỏ qua đã duyệt), phút từ 0h ngày bắt đầu ca. */
  luot: number[]
  quaDem: boolean
  doan: DoanLam[] | null
  /** Phút theo khung; null = không tính được (1 lượt, chưa bổ sung). */
  k: Record<string, number> | null
  /** Phút làm trưa đã tick (sổ tay) — 0 nếu chưa. */
  trua: number
  /** Phút cộng vào hành chính từ làm trưa (trua × hệ số). */
  truaCong: number
  /** Có mặt xuyên trưa → ứng viên tick làm trưa (chỉ cách tính khung). */
  xuyenTrua: boolean
  /** Tổng phút ngày (mọi khung + làm trưa). */
  tong: number
  /** Cần bổ sung: có lượt mà không tính được, không có nghỉ có lý do, ngày đã trọn. */
  thieu: boolean
  /** Ngày ĐANG DỞ (từ ngày lấy dữ liệu lần cuối): 1 lượt là vì chưa tới giờ ra, không phải lỗi. */
  doDang: boolean
  nghi: LoaiNghi | null
  /** Có điều chỉnh đã duyệt / đang chờ duyệt. */
  daSua: boolean
  choDuyet: number
}

export type TongNguoi = {
  /** Phút theo khung (chưa gồm làm trưa). */
  k: Record<string, number>
  truaCong: number
  tong: number
  /** Công = tổng giờ ÷ giờ một công, 2 lẻ. */
  cong: number
  ngayCo: number
  thieu: number
  /** Ngày xuyên trưa chưa tick. */
  truaCho: number
  nghi: number
  choDuyet: number
}

export type NguoiGio = {
  ma: string
  ten: string
  boPhan: string | null
  cachTinh: CachTinh
  ngay: NgayGio[]
  tong: TongNguoi
}

export type KyGioVao = {
  tu: string
  den: string
  nhanSu: { ma: string; ten: string; boPhan: string | null }[]
  /** Lượt máy theo người-ngày (giờ VN 'HH:mm:ss') — nên gồm cả ngày trước kỳ và sau kỳ để ghép ca đêm. */
  dong: {
    ngay: string
    ma: string
    daGhep: boolean
    luot: { gio: string; may: string }[]
  }[]
  dieuChinh: DieuChinh[]
  /** 'ma|ngay' → số phút làm trưa đã tick. */
  trua: Record<string, number>
  /** Tên bộ phận → cách tính; không có = khung. */
  cachTinh: Record<string, CachTinh>
  /**
   * Từ ngày này trở đi là ngày đang dở — dữ liệu lấy về giữa ngày nên chưa có lượt ra
   * (đo 17/10/2026: lấy lúc trưa 16/10 → cả công ty "thiếu lượt" ngày 16/10). Bỏ trống = mọi ngày trọn.
   */
  ngayDoDang?: string
  thamSo?: ThamSoKhung
}

const khongKhung = (t: ThamSoKhung) => Object.fromEntries(t.khung.map((k) => [k.ma, 0]))

export function tinhKyGioCong(v: KyGioVao): NguoiGio[] {
  const t = v.thamSo ?? THAM_SO_MAC_DINH
  const dcMap = theoNguoiNgay(v.dieuChinh)

  // Lượt máy theo người → theo ngày
  const luotCua = new Map<string, Map<string, { gio: string; may: string }[]>>()
  for (const r of v.dong) {
    if (!r.daGhep) continue
    const m = luotCua.get(r.ma) ?? new Map()
    m.set(r.ngay, [...(m.get(r.ngay) ?? []), ...r.luot])
    luotCua.set(r.ma, m)
  }

  return v.nhanSu.map((n) => {
    const cachTinh: CachTinh = (n.boPhan && v.cachTinh[n.boPhan]) || 'khung'
    const theoNgay =
      luotCua.get(n.ma) ?? new Map<string, { gio: string; may: string }[]>()
    // Ngày có điều chỉnh mà không có lượt máy (bổ sung cho ngày quên quẹt cả hai lượt).
    const ngays = new Set(theoNgay.keys())
    for (const k of dcMap.keys())
      if (k.startsWith(`${n.ma}|`)) ngays.add(k.slice(n.ma.length + 1))

    const tho: string[] = []
    const nghiCua = new Map<string, LoaiNghi>()
    const suaCua = new Map<string, { daSua: boolean; choDuyet: number }>()
    for (const ngay of ngays) {
      const sau = apDieuChinh(
        theoNgay.get(ngay) ?? [],
        dcMap.get(`${n.ma}|${ngay}`) ?? [],
      )
      for (const l of sau.luot) tho.push(`${ngay} ${l.gio}`)
      if (sau.nghi) nghiCua.set(ngay, sau.nghi)
      if (sau.daSua || sau.choDuyet)
        suaCua.set(ngay, { daSua: sau.daSua, choDuyet: sau.choDuyet })
    }

    const ngay: NgayGio[] = []
    const lam = new Map(ghepNgayLam(tho, t).map((x) => [x.ngay, x]))
    const tatCa = new Set([...lam.keys(), ...nghiCua.keys(), ...suaCua.keys()])
    for (const d of [...tatCa].sort()) {
      if (d < v.tu || d > v.den) continue
      const x = lam.get(d)
      const nghi = nghiCua.get(d) ?? null
      const sua = suaCua.get(d) ?? { daSua: false, choDuyet: 0 }
      const luot = x?.luot ?? []
      let k: Record<string, number> | null = null
      let doan = x?.doan ?? null
      let xt = false
      let trua = 0
      if (cachTinh === 'ngay') {
        // Không tính theo khung giờ (chủ dự án 18/10/2026: văn phòng và các vị trí ngoài
        // xưởng): có quẹt trong ngày = đúng một công, không cộng giờ ra muộn.
        if (luot.length) {
          k = khongKhung(t)
          k[t.khungHanhChinh] = t.phutMotCong
          doan = null
        }
      } else if (doan) {
        xt = xuyenTrua(doan, t)
        trua = xt ? (v.trua[`${n.ma}|${d}`] ?? 0) : 0
        k = tinhGioNgay(doan, 0, t).theoKhung
      }
      const truaCong = trua * t.heSoTrua
      const tong = k ? Object.values(k).reduce((a, b) => a + b, 0) + truaCong : 0
      const doDang = !!v.ngayDoDang && d >= v.ngayDoDang
      ngay.push({
        ngay: d,
        luot,
        quaDem: x?.quaDem ?? false,
        doan,
        k,
        trua,
        truaCong,
        xuyenTrua: xt,
        tong,
        thieu: luot.length > 0 && !k && !nghi && !doDang,
        doDang,
        nghi,
        daSua: sua.daSua,
        choDuyet: sua.choDuyet,
      })
    }

    const tongK = khongKhung(t)
    for (const x of ngay) if (x.k) for (const kk of t.khung) tongK[kk.ma] += x.k[kk.ma]
    const truaCong = ngay.reduce((s, x) => s + x.truaCong, 0)
    const tongPhut = Object.values(tongK).reduce((a, b) => a + b, 0) + truaCong
    return {
      ma: n.ma,
      ten: n.ten,
      boPhan: n.boPhan,
      cachTinh,
      ngay,
      tong: {
        k: tongK,
        truaCong,
        tong: tongPhut,
        cong: Math.round((tongPhut / t.phutMotCong) * 100) / 100,
        ngayCo: ngay.filter((x) => x.luot.length > 0).length,
        thieu: ngay.filter((x) => x.thieu).length,
        truaCho: ngay.filter((x) => x.xuyenTrua && !x.trua).length,
        nghi: ngay.filter((x) => x.nghi).length,
        choDuyet: ngay.reduce((s, x) => s + x.choDuyet, 0),
      },
    }
  })
}
