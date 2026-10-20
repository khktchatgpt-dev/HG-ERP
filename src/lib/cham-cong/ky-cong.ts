/**
 * KỲ CÔNG — điều kiện chốt, điều kiện tổ xác nhận, bản chốt. Hàm thuần (B3, bản vẽ duyệt
 * 18/10/2026, Q1–Q7 theo đề xuất). Màn và server gọi CÙNG các hàm này, nên điều màn báo
 * "chưa chốt được vì…" và điều server chặn là một.
 */

import type { LoaiNghi } from './dieu-chinh'
import type { NgayGio, NguoiGio, TongNguoi } from './ky-gio-cong'

/** Q5: kỳ trước kỳ này đã trả lương ngoài ERP — không chốt trong ERP. */
export const KY_DAU_ERP = '2026-10'

export type TrangThaiKy = 'open' | 'closed' | 'reopen_requested'
export const TEN_TRANG_THAI: Record<TrangThaiKy, string> = {
  open: 'Đang mở',
  closed: 'Đã chốt',
  reopen_requested: 'Chờ mở lại',
}

/** Tên tạm cho người chưa có tổ (giống Bảng công). */
export const CHUA_CO_TO = '(chưa có bộ phận)'

export type TongTo = {
  ten: string
  so: number
  /** Phút mọi khung + làm trưa. */
  phut: number
  cong: number
  thieu: number
  choDuyet: number
  /** Ngày xuyên trưa chưa tick — chỉ để nhắc, không chặn. */
  truaCho: number
}

/** Gom người theo tổ, giữ thứ tự: nhiều người trước, "chưa có tổ" cuối. */
export function tongTheoTo(nguoi: NguoiGio[]): TongTo[] {
  const m = new Map<string, TongTo>()
  for (const n of nguoi) {
    const ten = n.boPhan ?? CHUA_CO_TO
    const t = m.get(ten) ?? {
      ten,
      so: 0,
      phut: 0,
      cong: 0,
      thieu: 0,
      choDuyet: 0,
      truaCho: 0,
    }
    t.so += 1
    t.phut += n.tong.tong
    // Cộng CÔNG TỪNG NGƯỜI (đã làm tròn 2 lẻ) — đúng cách Bảng công cộng chân tổ, để hai màn
    // ra cùng một số (con số là một lời hứa).
    t.cong += n.tong.cong
    t.thieu += n.tong.thieu
    t.choDuyet += n.tong.choDuyet
    t.truaCho += n.tong.truaCho
    m.set(ten, t)
  }
  return [...m.values()]
    .map((t) => ({ ...t, cong: Math.round(t.cong * 100) / 100 }))
    .sort(
      (a, b) =>
        (a.ten === CHUA_CO_TO ? 1 : 0) - (b.ten === CHUA_CO_TO ? 1 : 0) ||
        b.so - a.so ||
        a.ten.localeCompare(b.ten, 'vi'),
    )
}

export type DieuKien = { ma: string; ten: string; ok: boolean; chiTiet: string }

export type BoiCanhKy = {
  /** 'YYYY-MM-DD' giờ VN. */
  homNay: string
  den: string
  /** Ngày (giờ VN) của lần lấy dữ liệu máy thành công gần nhất; null = chưa lấy lần nào. */
  ngayLay: string | null
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function soNgay(tu: string, den: string): number {
  return Math.round(
    (Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86400_000,
  )
}

const sauNgay = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

/** Q3: kỳ hết từ ngày sau ngày cuối kỳ. */
function kyDaHet(b: BoiCanhKy): DieuKien {
  const con = soNgay(b.homNay, b.den) + 1
  return {
    ma: 'het_ky',
    ten: 'Kỳ đã hết',
    ok: b.homNay > b.den,
    chiTiet:
      b.homNay > b.den
        ? `hết ngày ${dmy(b.den)}`
        : `còn ${con} ngày — xác nhận tổ và chốt từ ${dmy(sauNgay(b.den))}`,
  }
}

/** Dữ liệu máy phải lấy SAU khi kỳ hết, không thì ngày cuối kỳ còn dở. */
function mayDaLay(b: BoiCanhKy): DieuKien {
  return {
    ma: 'may',
    ten: `Máy đã lấy tới ${dmy(b.den)}`,
    ok: !!b.ngayLay && b.ngayLay > b.den,
    chiTiet: b.ngayLay ? `lấy lần cuối ngày ${dmy(b.ngayLay)}` : 'chưa lấy lần nào',
  }
}

/** Điều kiện xác nhận một tổ (Q1–Q3). `thieu` được phép > 0 nếu đồng ý tính 0 giờ. */
export function dieuKienXacNhanTo(b: BoiCanhKy, to: TongTo): DieuKien[] {
  return [
    kyDaHet(b),
    mayDaLay(b),
    {
      ma: 'cho_duyet',
      ten: 'Không còn phiếu chờ duyệt của tổ',
      ok: to.choDuyet === 0,
      chiTiet: to.choDuyet ? `${to.choDuyet} phiếu chờ duyệt` : 'không vướng',
    },
  ]
}

export function dieuKienChot(
  b: BoiCanhKy,
  v: { choDuyet: number; chuaCoTo: number; to: { ten: string; daXacNhan: boolean }[] },
): DieuKien[] {
  const chua = v.to.filter((t) => !t.daXacNhan)
  return [
    kyDaHet(b),
    mayDaLay(b),
    {
      ma: 'cho_duyet',
      ten: 'Không còn phiếu chờ duyệt',
      ok: v.choDuyet === 0,
      chiTiet: v.choDuyet ? `${v.choDuyet} phiếu chờ duyệt` : 'không vướng',
    },
    {
      ma: 'chua_co_to',
      ten: 'Mọi người đã có tổ',
      ok: v.chuaCoTo === 0,
      chiTiet: v.chuaCoTo ? `${v.chuaCoTo} người chưa có tổ` : 'đủ',
    },
    {
      ma: 'xac_nhan',
      ten: 'Mọi tổ đã xác nhận',
      ok: chua.length === 0,
      chiTiet: `${v.to.length - chua.length} / ${v.to.length} tổ`,
    },
  ]
}

/** Một dòng bản chốt (hr_time_results). */
export type DongChot = {
  ma: string
  ten: string
  to: string | null
  /** null = người không chấm công (Q6). */
  ngay: string | null
  k: Record<string, number>
  truaCong: number
  tong: number
  nghi: LoaiNghi | null
  /** Ngày thiếu lượt tổ đã đồng ý tính 0 giờ. */
  khong: boolean
  miem: boolean
}

/** Bảng giờ đang tính → các dòng bản chốt. Ngày chỉ có lượt mà không tính được = 0 giờ. */
export function banChotTu(nguoi: NguoiGio[]): DongChot[] {
  const out: DongChot[] = []
  for (const n of nguoi)
    for (const x of n.ngay) {
      if (!x.k && !x.nghi && !x.thieu) continue
      out.push({
        ma: n.ma,
        ten: n.ten,
        to: n.boPhan,
        ngay: x.ngay,
        k: x.k ?? {},
        truaCong: x.truaCong,
        tong: x.k ? x.tong : 0,
        nghi: x.nghi,
        khong: x.thieu,
        miem: false,
      })
    }
  return out
}

/**
 * Kỳ đã chốt: thay giờ từng ngày của bảng đang tính bằng bản chốt (lượt máy vẫn bày để soi),
 * rồi cộng lại tổng. Người có trong bản chốt mà nay không còn trong bảng (đã nghỉ) vẫn hiện.
 */
export function apBanChot(
  nguoi: NguoiGio[],
  chot: DongChot[],
  khungMa: string[],
  phutMotCong: number,
): NguoiGio[] {
  const theoNguoi = new Map<string, DongChot[]>()
  for (const d of chot)
    if (d.ngay) theoNguoi.set(d.ma, [...(theoNguoi.get(d.ma) ?? []), d])
  const rong = () => Object.fromEntries(khungMa.map((k) => [k, 0]))
  const ra: NguoiGio[] = nguoi.map((n) => {
    const cua = theoNguoi.get(n.ma) ?? []
    const ds = new Map(cua.map((d) => [d.ngay!, d]))
    theoNguoi.delete(n.ma)
    const ngay: NgayGio[] = n.ngay.map((x) => {
      const d = ds.get(x.ngay)
      ds.delete(x.ngay)
      // Kỳ đã chốt: không còn việc phải làm trên ô (trưa chưa tick, thiếu lượt, chờ duyệt).
      const xong = { thieu: false, xuyenTrua: false, choDuyet: 0 }
      if (!d) return { ...x, ...xong, k: null, tong: 0, truaCong: 0, nghi: null }
      return {
        ...x,
        k: d.khong ? null : { ...rong(), ...d.k },
        tong: d.tong,
        truaCong: d.truaCong,
        ...xong,
        nghi: d.nghi,
      }
    })
    for (const d of ds.values()) ngay.push(ngayTuChot(d, rong()))
    ngay.sort((a, b) => (a.ngay < b.ngay ? -1 : 1))
    return {
      ...n,
      // Tổ lúc chốt — đổi tổ sau khi chốt không kéo người sang tổ mới trong kỳ đã chốt.
      boPhan: cua.length ? cua[0].to : n.boPhan,
      ngay,
      tong: cong(ngay, khungMa, phutMotCong, n.tong),
    }
  })
  for (const [ma, ds] of theoNguoi) {
    const ngay = ds
      .map((d) => ngayTuChot(d, rong()))
      .sort((a, b) => (a.ngay < b.ngay ? -1 : 1))
    ra.push({
      ma,
      ten: ds[0].ten,
      boPhan: ds[0].to,
      cachTinh: 'khung',
      ngay,
      tong: cong(ngay, khungMa, phutMotCong),
    })
  }
  return ra
}

function ngayTuChot(d: DongChot, rong: Record<string, number>): NgayGio {
  return {
    ngay: d.ngay!,
    luot: [],
    quaDem: false,
    doan: null,
    k: d.khong ? null : { ...rong, ...d.k },
    trua: 0,
    truaCong: d.truaCong,
    xuyenTrua: false,
    tong: d.tong,
    thieu: false,
    doDang: false,
    nghi: d.nghi,
    daSua: false,
    choDuyet: 0,
  }
}

function cong(
  ngay: NgayGio[],
  khungMa: string[],
  phutMotCong: number,
  cu?: TongNguoi,
): TongNguoi {
  const k = Object.fromEntries(khungMa.map((m) => [m, 0]))
  for (const x of ngay) if (x.k) for (const m of khungMa) k[m] += x.k[m] ?? 0
  const truaCong = ngay.reduce((s, x) => s + x.truaCong, 0)
  const tong = ngay.reduce((s, x) => s + x.tong, 0)
  return {
    k,
    truaCong,
    tong,
    cong: Math.round((tong / phutMotCong) * 100) / 100,
    ngayCo: ngay.filter((x) => x.k).length,
    thieu: 0,
    truaCho: 0,
    nghi: ngay.filter((x) => x.nghi).length,
    choDuyet: cu?.choDuyet ?? 0,
  }
}
