import { CHUA_BO_PHAN } from './co-mat'
import { laChuNhat, tachLuot } from './mot-nguoi'

/**
 * BẢNG CHẤM CÔNG THEO TỔ — người × ngày (bản vẽ TheoTo.dc.html, duyệt 17/10/2026).
 * Hàm thuần, dùng chung màn hình và file Excel. Chỉ bày lượt quẹt — CHƯA tính công:
 * ô là tổng thời gian vào → ra.
 *
 * Kiểu ô:
 *   gio      có lượt đầu + lượt cuối  → tổng giờ (làm tròn xuống)
 *   mot      chỉ 1 lượt               → '!'
 *   vang     ngày thường, cả công ty đã có dữ liệu, người này không quẹt → 'V'
 *   dangLam  hôm nay, đã vào, chưa ra → '•'
 *   trong    chủ nhật không quẹt, ngày chưa lấy dữ liệu, hôm nay chưa quẹt
 */

export type KieuO = 'gio' | 'mot' | 'vang' | 'dangLam' | 'trong'

export type OTo = {
  ngay: string
  kieu: KieuO
  vao: string | null
  ra: string | null
  /** Phút vào → ra; null khi < 2 lượt. */
  phut: number | null
}

export type NguoiTo = {
  ma: string
  ten: string
  o: OTo[]
  /** Số ngày có quẹt (không tính hôm nay). */
  diLam: number
  thieu: number
  vang: number
  phut: number
}

export type NgayTo = {
  ngay: string
  cn: boolean
  homNay: boolean
  /** Cả công ty có lượt ngày này (đã lấy về). */
  daLay: boolean
  /** Số người của tổ có ít nhất 1 lượt. */
  diLam: number
}

export type BangTo = {
  to: string
  ngays: NgayTo[]
  nguoi: NguoiTo[]
  tong: { diLam: number; thieu: number; vang: number; phut: number }
}

export type BangToVao = {
  to: string
  theoNgay: { ngay: string; theoMay: Record<string, number> }[]
  dong: {
    ngay: string
    ma: string
    daGhep: boolean
    luot: { gio: string; may: string }[]
  }[]
  nhanSu: { ma: string; ten: string; boPhan: string | null }[]
  homNay: string
}

/** Danh sách tổ có người (để chọn), lớn trước, "(chưa có bộ phận)" cuối. */
export function dsTo(nhanSu: BangToVao['nhanSu']): { to: string; so: number }[] {
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

  const nguoi: NguoiTo[] = ds.map((p) => {
    const t: NguoiTo = {
      ma: p.ma,
      ten: p.ten,
      o: [],
      diLam: 0,
      thieu: 0,
      vang: 0,
      phut: 0,
    }
    for (const ngay of ngaysIso) {
      const r = theo.get(`${ngay}|${p.ma}`)
      const homNay = ngay === d.homNay
      if (!r || r.luot.length === 0) {
        const vang = !homNay && daLay.has(ngay) && !laChuNhat(ngay)
        if (vang) t.vang++
        t.o.push({ ngay, kieu: vang ? 'vang' : 'trong', vao: null, ra: null, phut: null })
        continue
      }
      const x = tachLuot(r.luot)
      if (x.coMatPhut == null || x.coMatPhut === 0) {
        if (!homNay) {
          t.thieu++
          t.diLam++
        }
        t.o.push({
          ngay,
          kieu: homNay ? 'dangLam' : 'mot',
          vao: x.vao,
          ra: null,
          phut: null,
        })
        continue
      }
      if (!homNay) t.diLam++
      t.phut += x.coMatPhut
      t.o.push({ ngay, kieu: 'gio', vao: x.vao, ra: x.ra, phut: x.coMatPhut })
    }
    return t
  })

  const ngays: NgayTo[] = ngaysIso.map((ngay, i) => ({
    ngay,
    cn: laChuNhat(ngay),
    homNay: ngay === d.homNay,
    daLay: daLay.has(ngay),
    diLam: nguoi.filter((p) => p.o[i].kieu !== 'vang' && p.o[i].kieu !== 'trong').length,
  }))

  return {
    to: d.to,
    ngays,
    nguoi,
    tong: nguoi.reduce(
      (s, p) => ({
        diLam: s.diLam + p.diLam,
        thieu: s.thieu + p.thieu,
        vang: s.vang + p.vang,
        phut: s.phut + p.phut,
      }),
      { diLam: 0, thieu: 0, vang: 0, phut: 0 },
    ),
  }
}

/** Chữ trong ô (chế độ Tổng giờ). */
export function chuO(o: OTo): string {
  if (o.kieu === 'gio') return String(Math.floor(o.phut! / 60))
  if (o.kieu === 'mot') return '!'
  if (o.kieu === 'vang') return 'V'
  if (o.kieu === 'dangLam') return '•'
  return ''
}
