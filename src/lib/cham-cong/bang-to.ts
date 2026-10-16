import { CHUA_BO_PHAN } from './co-mat'
import { laChuNhat, tachLuot } from './mot-nguoi'
import { gioChuan, tinhNgay, type Ca } from './tinh-cong'

/**
 * BẢNG CHẤM CÔNG THEO TỔ v2 — người × ngày, ô ghi CÔNG + giờ tăng ca (bản vẽ
 * TheoTo.dc.html v2, chủ dự án duyệt 17/10/2026, câu 26–29). Hàm thuần, dùng chung
 * màn hình và file Excel.
 *
 * Giờ công + tăng ca tính bằng `tinhNgay` (luật chốt 12/10/2026: trong ca trừ nghỉ
 * trưa, tăng ca từ `otFrom` làm tròn xuống). Ngưỡng (câu 26):
 *   giờ công ≥ giờ chuẩn − 30 phút → X (1 công)
 *   giờ công ≥ 3 giờ 30           → ½
 *   ít hơn / thiếu lượt / vào ngoài khung → ? (cần xử lý)
 * Chủ nhật (câu 28): CN = công chủ nhật, giờ sau giờ tan ca vẫn là tăng ca.
 * Ngày lễ chưa tách riêng (tháng 10 không có lễ) — xem như ngày thường.
 */

/** Ký hiệu ô. '' = trống (CN nghỉ, ngày chưa lấy dữ liệu, hôm nay chưa quẹt). */
export type KyHieu = 'X' | '½' | 'CN' | 'CN½' | 'V' | '?' | '•' | ''

export type OTo = {
  ngay: string
  ky: KyHieu
  /** Công ngày thường của ô (0 · 0,5 · 1). */
  cong: number
  /** Công chủ nhật của ô. */
  congCN: number
  /** Phút tăng ca (đã làm tròn). */
  tc: number
  /** Phút làm trong ca (sau trừ nghỉ trưa) — cộng với tc ra giờ làm. */
  gioCong: number
  vao: string | null
  ra: string | null
  /** Phút vào → ra (tổng thời gian); null khi < 2 lượt. */
  phut: number | null
  /** Vì sao ô là '?' — cho tooltip / ngăn điều chỉnh. */
  lyDo?: string
}

export type NguoiTo = {
  ma: string
  ten: string
  ca: string
  o: OTo[]
  /** Số ngày có quẹt (không tính hôm nay). */
  diLam: number
  /** Phút làm = trong ca + tăng ca. */
  gioLam: number
  cong: number
  congCN: number
  tc: number
  /** Nghỉ có lý do — có khi làm bước Điều chỉnh. */
  nghi: number
  vang: number
  /** Ô '?' — cần Nhân sự xử lý. */
  canXuLy: number
  /** Cả kỳ (tới hôm qua) không một lượt nào, trên ngày đã có dữ liệu. */
  khongQuet: boolean
}

export type NgayTo = {
  ngay: string
  cn: boolean
  homNay: boolean
  daLay: boolean
  /** Người của tổ có ít nhất 1 lượt. */
  diLam: number
  /** Tổng công của tổ ngày này (thường + CN). */
  cong: number
  /** Số người thiếu lượt / cần xử lý ngày này. */
  canXuLy: number
}

/** Lỗi chung cả ngày: hơn nửa người đi làm cùng thiếu lượt (máy hỏng, tổ làm nửa buổi…). */
export type LoiNgay = { ngay: string; so: number; diLam: number }

export type BangTo = {
  to: string
  ngays: NgayTo[]
  nguoi: NguoiTo[]
  loiNgay: LoiNgay[]
  tong: {
    diLam: number
    gioLam: number
    cong: number
    congCN: number
    tc: number
    nghi: number
    vang: number
    canXuLy: number
  }
}

export type NhanSuTo = { ma: string; ten: string; boPhan: string | null; ca: Ca }

export type BangToVao = {
  to: string
  theoNgay: { ngay: string; theoMay: Record<string, number> }[]
  dong: {
    ngay: string
    ma: string
    daGhep: boolean
    luot: { gio: string; may: string }[]
  }[]
  nhanSu: NhanSuTo[]
  homNay: string
}

/** Danh sách tổ có người (để chọn), lớn trước, "(chưa có bộ phận)" cuối. */
export function dsTo(nhanSu: { boPhan: string | null }[]): { to: string; so: number }[] {
  const m = new Map<string, number>()
  for (const n of nhanSu)
    m.set(n.boPhan ?? CHUA_BO_PHAN, (m.get(n.boPhan ?? CHUA_BO_PHAN) ?? 0) + 1)
  return [...m]
    .map(([to, so]) => ({ to, so }))
    .sort((a, b) =>
      a.to === CHUA_BO_PHAN
        ? 1
        : b.to === CHUA_BO_PHAN
          ? -1
          : b.so - a.so || a.to.localeCompare(b.to, 'vi'),
    )
}

/** Một ô: lượt của một người một ngày → ký hiệu công + tăng ca. */
export function tinhO(
  ngay: string,
  luot: { gio: string; may: string }[],
  ca: Ca,
  ctx: { homNay: boolean; daLay: boolean },
): OTo {
  const cn = laChuNhat(ngay)
  const x = tachLuot(luot)
  const goc = {
    ngay,
    cong: 0,
    congCN: 0,
    tc: 0,
    gioCong: 0,
    vao: x.vao,
    ra: x.ra,
    phut: x.coMatPhut,
  }
  if (!luot.length) {
    const vang = !ctx.homNay && ctx.daLay && !cn
    return { ...goc, ky: vang ? 'V' : '' }
  }
  if (ctx.homNay) return { ...goc, ky: '•' }
  const k = tinhNgay(
    luot.map((l) => ({ may: l.may, gio: l.gio })),
    ca,
    cn ? 'cn' : 'thuong',
  )!
  if (k.kieu === 'thieu')
    return { ...goc, ky: '?', lyDo: 'Chỉ 1 lượt (hoặc vào–ra cách nhau dưới 1 giờ)' }
  if (k.kieu === 'ngoai')
    return { ...goc, ky: '?', lyDo: `Vào ${x.vao} — ngoài khung vào của ca ${ca.name}` }
  const chuan = gioChuan(ca)
  const cong = k.gioCong >= chuan - 30 ? 1 : k.gioCong >= 210 ? 0.5 : 0
  if (cong === 0)
    return {
      ...goc,
      ky: '?',
      tc: k.tangCa,
      lyDo: `Chỉ ${Math.floor(k.gioCong / 60)} giờ ${k.gioCong % 60} phút trong ca`,
    }
  if (cn)
    return {
      ...goc,
      ky: cong === 1 ? 'CN' : 'CN½',
      congCN: cong,
      tc: k.tangCa,
      gioCong: k.gioCong,
    }
  return { ...goc, ky: cong === 1 ? 'X' : '½', cong, tc: k.tangCa, gioCong: k.gioCong }
}

export function tinhBangTo(d: BangToVao): BangTo {
  const daLay = new Set(
    d.theoNgay.filter((n) => Object.keys(n.theoMay).length > 0).map((n) => n.ngay),
  )
  const ngaysIso = d.theoNgay.map((n) => n.ngay).filter((x) => x <= d.homNay)
  const ds = d.nhanSu
    .filter((n) => (n.boPhan ?? CHUA_BO_PHAN) === d.to)
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
  const theo = new Map(
    d.dong.filter((r) => r.daGhep).map((r) => [`${r.ngay}|${r.ma}`, r] as const),
  )
  const ngayDaQua = ngaysIso.filter((x) => x < d.homNay && daLay.has(x))

  const nguoi: NguoiTo[] = ds.map((p) => {
    const o = ngaysIso.map((ngay) =>
      tinhO(ngay, theo.get(`${ngay}|${p.ma}`)?.luot ?? [], p.ca, {
        homNay: ngay === d.homNay,
        daLay: daLay.has(ngay),
      }),
    )
    const sum = (f: (x: OTo) => number) => o.reduce((s, x) => s + f(x), 0)
    return {
      ma: p.ma,
      ten: p.ten,
      ca: p.ca.name,
      diLam: o.filter((x) => x.vao != null && x.ky !== '•').length,
      gioLam: o.reduce((t, x) => t + x.gioCong + x.tc, 0),
      o,
      cong: sum((x) => x.cong),
      congCN: sum((x) => x.congCN),
      tc: sum((x) => x.tc),
      nghi: 0,
      vang: o.filter((x) => x.ky === 'V').length,
      canXuLy: o.filter((x) => x.ky === '?').length,
      khongQuet:
        ngayDaQua.length > 0 &&
        o.every((x) => x.ngay >= d.homNay || !daLay.has(x.ngay) || x.vao == null),
    }
  })

  const ngays: NgayTo[] = ngaysIso.map((ngay, i) => ({
    ngay,
    cn: laChuNhat(ngay),
    homNay: ngay === d.homNay,
    daLay: daLay.has(ngay),
    diLam: nguoi.filter((p) => p.o[i].vao != null).length,
    cong: nguoi.reduce((s, p) => s + p.o[i].cong + p.o[i].congCN, 0),
    canXuLy: nguoi.filter((p) => p.o[i].ky === '?').length,
  }))

  const loiNgay: LoiNgay[] = ngays
    .filter((n) => !n.homNay && n.diLam >= 3 && n.canXuLy * 2 > n.diLam)
    .map((n) => ({ ngay: n.ngay, so: n.canXuLy, diLam: n.diLam }))

  const tong = nguoi.reduce(
    (s, p) => ({
      diLam: s.diLam + p.diLam,
      gioLam: s.gioLam + p.gioLam,
      cong: s.cong + p.cong,
      congCN: s.congCN + p.congCN,
      tc: s.tc + p.tc,
      nghi: s.nghi + p.nghi,
      vang: s.vang + p.vang,
      canXuLy: s.canXuLy + p.canXuLy,
    }),
    { diLam: 0, gioLam: 0, cong: 0, congCN: 0, tc: 0, nghi: 0, vang: 0, canXuLy: 0 },
  )
  return { to: d.to, ngays, nguoi, loiNgay, tong }
}

/** Giờ tăng ca gọn: 330 → '5½', 300 → '5', 30 → '½', 0 → ''. */
export function tcGon(phut: number): string {
  if (!phut) return ''
  const gio = Math.floor(phut / 60)
  const nua = phut % 60 >= 30
  return gio ? `${gio}${nua ? '½' : ''}` : nua ? '½' : ''
}

/** Số công kiểu Việt: 12.5 → '12,5'. */
export const soCong = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
