/**
 * TÍNH PHIẾU LƯƠNG MỘT NGƯỜI MỘT KỲ — hàm thuần (B5, bản vẽ duyệt 18/10/2026, Q1–Q8 theo
 * đề xuất). Ba nguồn đầu vào đều đã khoá: bản chốt kỳ công (giờ theo khung từng ngày), hồ
 * sơ lương (đơn giá / lương tháng, lương BH, NPT, phụ cấp), hệ số của bản cách tính.
 *
 *   giá giờ    = đơn giá ÷ giờ một công   (theo tháng: lương tháng ÷ công chuẩn ÷ giờ một công)
 *   lương công = giờ hành chính ngày thường × giá giờ × hệ số K1-thường
 *                (theo tháng: lương tháng × công thực ÷ công chuẩn — gồm ngày nghỉ có lương, lễ)
 *   tăng ca    = mọi giờ còn lại (khung ngoài hành chính, mọi khung ngày CN / lễ) × giá giờ × hệ số
 *   nghỉ có lương (theo công) = số ngày × đơn giá × hệ số loại nghỉ; lễ không đi làm cũng vậy
 *   phụ cấp    = mức × min(1, công thực ÷ công chuẩn); khoản "theo ngày đi làm" (Ăn ca)
 *                = mức ÷ công chuẩn × số ngày có đi làm (Q2)
 *   BH NLĐ     = min(lương đóng BH, trần) × 10,5 %; doanh nghiệp 21,5 %, KPCĐ 2 %
 *   thuế       = khấu trừ 10 % (Q4) hoặc luỹ tiến 5 bậc trên: tổng thu nhập − tăng ca (miễn
 *                toàn bộ) − phụ cấp không chịu thuế − BH NLĐ − 15,5 tr − 6,2 tr × NPT
 *   thực lĩnh  = tổng thu nhập − BH NLĐ − thuế − tạm ứng / truy thu / khấu trừ
 * Tiền làm tròn đến đồng ở từng dòng (Q8). Ô hệ số trống mà khung có giờ → ghi vào `thieuHeSo`
 * (bảng lương chặn gửi duyệt — Q1), tiền dòng đó tính 0.
 *
 * Số luật (trần BH, giảm trừ, biểu thuế) lấy theo văn bản hiệu lực 2026 — Kế toán rà lại.
 */

export type LoaiNgayLuong = 'thuong' | 'cn' | 'le'
export type MaNghi =
  'annual' | 'holiday' | 'personal' | 'business_trip' | 'sick' | 'unpaid'
export type LoaiKhoan = 'advance' | 'bonus' | 'back_pay' | 'claw_back' | 'deduction'

export const TEN_KHOAN: Record<LoaiKhoan, string> = {
  advance: 'Tạm ứng',
  bonus: 'Thưởng',
  back_pay: 'Truy lĩnh',
  claw_back: 'Truy thu',
  deduction: 'Khấu trừ khác',
}
export const KHOAN_CONG: LoaiKhoan[] = ['bonus', 'back_pay']

export const GIAM_TRU_BAN_THAN = 15_500_000
export const GIAM_TRU_NPT = 6_200_000
export const BAC_THUE: [number, number][] = [
  [10_000_000, 0.05],
  [30_000_000, 0.1],
  [60_000_000, 0.2],
  [100_000_000, 0.3],
  [Infinity, 0.35],
]
export const TY_LE_BH_NLD = 0.105
export const TY_LE_BH_DN = 0.215
export const TY_LE_KPCD = 0.02

/** Trần lương đóng BHXH = 20 × mức tham chiếu: 46,8 tr trước kỳ 07/2026, 50,6 tr từ đó. */
export const tranBh = (thang: string) => (thang >= '2026-07' ? 50_600_000 : 46_800_000)

export function thueLuyTien(tinhThue: number): number {
  let con = Math.max(0, tinhThue)
  let duoi = 0
  let thue = 0
  for (const [tren, tl] of BAC_THUE) {
    if (con <= 0) break
    const phan = Math.min(con, tren - duoi)
    thue += phan * tl
    con -= phan
    duoi = tren
  }
  return Math.round(thue)
}

export type HoSoTinh = {
  cachTra: 'daily' | 'monthly'
  donGia: number | null
  luongThang: number | null
  luongBh: number | null
  coBh: boolean
  npt: number
  khauTru10: boolean
  phuCap: { ten: string; muc: number; chiuThue: boolean; theoNgay: boolean }[]
}

export type NgayTinh = {
  ngay: string
  /** Phút theo khung, CHƯA gồm làm trưa — phút làm trưa đã quy đổi đi riêng ở `trua`. */
  k: Record<string, number>
  trua: number
  nghi: MaNghi | null
  khong: boolean
}

export type BoiCanhTinh = {
  thang: string
  phutMotCong: number
  khung: { ma: string; ten: string; hanhChinh: boolean }[]
  congChuan: number
  /** Ngày lễ trong kỳ (không phải chủ nhật) — mọi người được trả lương ngày lễ. */
  ngayLe: string[]
  loaiNgay: (ngay: string) => LoaiNgayLuong
  /** % hệ số; null = ô trống. */
  heSoKhung: (ma: string, ngay: LoaiNgayLuong) => number | null
  heSoNghi: (ma: MaNghi) => number | null
}

export type DongTien = {
  nhom: 'cong' | 'tang_ca' | 'nghi' | 'phu_cap' | 'khoan'
  ten: string
  tien: number
}

export type Phieu = {
  congThuc: number
  luongCong: number
  tangCa: number
  nghiCoLuong: number
  phuCap: number
  khoanCong: number
  tong: number
  bhNld: number
  bhDn: number
  kpcd: number
  thue: number
  khoanTru: number
  thucLinh: number
  dong: DongTien[]
  why: string[]
  thieuHeSo: string[]
  canhBao: string[]
}

const r0 = Math.round
const so = (n: number, le = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: le })
const TEN_NGAY: Record<LoaiNgayLuong, string> = { thuong: '', cn: ' CN', le: ' lễ' }
const TEN_NGHI: Record<MaNghi, string> = {
  annual: 'Phép năm',
  holiday: 'Nghỉ lễ',
  personal: 'Việc riêng có lương',
  business_trip: 'Công tác',
  sick: 'Ốm',
  unpaid: 'Không lương',
}

export function tinhPhieu(
  hs: HoSoTinh,
  ngays: NgayTinh[],
  khoan: { loai: LoaiKhoan; tien: number }[],
  b: BoiCanhTinh,
  khongChamCong = false,
): Phieu {
  const why: string[] = []
  const dong: DongTien[] = []
  const thieuHeSo = new Set<string>()
  const canhBao: string[] = []
  const gioMotCong = b.phutMotCong / 60
  const hc = b.khung.find((k) => k.hanhChinh)?.ma ?? 'K1'
  const theoCong = hs.cachTra === 'daily'
  const donGiaNgay = theoCong ? (hs.donGia ?? 0) : (hs.luongThang ?? 0) / b.congChuan
  const giaGio = donGiaNgay / gioMotCong

  // ── Gom phút theo khung × loại ngày; ngày nghỉ; ngày có đi làm.
  const phut = new Map<string, number>()
  const nghi = new Map<MaNghi, number>()
  let ngayDiLam = 0
  for (const d of ngays) {
    if (d.khong) continue
    if (d.nghi) nghi.set(d.nghi, (nghi.get(d.nghi) ?? 0) + 1)
    const ln = b.loaiNgay(d.ngay)
    let co = false
    for (const [ma, p] of Object.entries(d.k)) {
      const them = p + (ma === hc ? d.trua : 0)
      if (them <= 0) continue
      co = true
      phut.set(`${ma}|${ln}`, (phut.get(`${ma}|${ln}`) ?? 0) + them)
    }
    if (co) ngayDiLam++
  }
  const le = b.ngayLe.length

  // ── Công thực (dùng cho theo tháng + phụ cấp).
  const congHc = (phut.get(`${hc}|thuong`) ?? 0) / b.phutMotCong
  let congNghi = 0
  for (const [ma, so_] of nghi) congNghi += (so_ * (b.heSoNghi(ma) ?? 0)) / 100
  const congLe = (le * (b.heSoNghi('holiday') ?? 0)) / 100
  const congThuc = khongChamCong ? b.congChuan : congHc + congNghi + congLe

  // ── Lương công + nghỉ có lương.
  let luongCong = 0
  let nghiCoLuong = 0
  if (khongChamCong) {
    luongCong = r0(theoCong ? donGiaNgay * b.congChuan : (hs.luongThang ?? 0))
    why.push(
      `Lương       không chấm công — đủ ${b.congChuan} công chuẩn = ${so(luongCong)}`,
    )
  } else if (theoCong) {
    const hsHc = b.heSoKhung(hc, 'thuong')
    if (hsHc == null && congHc > 0) thieuHeSo.add(`${hc} ngày thường`)
    luongCong = r0(congHc * donGiaNgay * ((hsHc ?? 0) / 100))
    why.push(
      `Lương công  ${so(congHc, 2)} công × ${so(donGiaNgay)}${hsHc != null && hsHc !== 100 ? ` × ${hsHc} %` : ''} = ${so(luongCong)}`,
    )
    for (const [ma, n] of nghi) {
      const tl = b.heSoNghi(ma)
      if (tl == null) thieuHeSo.add(TEN_NGHI[ma])
      const tien = r0(n * donGiaNgay * ((tl ?? 0) / 100))
      if (tien) {
        nghiCoLuong += tien
        dong.push({ nhom: 'nghi', ten: `${TEN_NGHI[ma]} ${n} ngày`, tien })
        why.push(`${TEN_NGHI[ma]}  ${n} ngày × ${so(donGiaNgay)} × ${tl} % = ${so(tien)}`)
      }
    }
    if (le) {
      const tl = b.heSoNghi('holiday')
      if (tl == null) thieuHeSo.add('Nghỉ lễ')
      const tien = r0(le * donGiaNgay * ((tl ?? 0) / 100))
      if (tien) {
        nghiCoLuong += tien
        dong.push({ nhom: 'nghi', ten: `Lương ngày lễ ${le} ngày`, tien })
        why.push(`Ngày lễ     ${le} ngày × ${so(donGiaNgay)} × ${tl} % = ${so(tien)}`)
      }
    }
  } else {
    luongCong = r0(((hs.luongThang ?? 0) * congThuc) / b.congChuan)
    why.push(
      `Lương tháng ${so(hs.luongThang ?? 0)} × ${so(congThuc, 2)} công ÷ ${b.congChuan} = ${so(luongCong)}`,
    )
    for (const [ma] of nghi) if (b.heSoNghi(ma) == null) thieuHeSo.add(TEN_NGHI[ma])
    if (le && b.heSoNghi('holiday') == null) thieuHeSo.add('Nghỉ lễ')
  }
  dong.unshift({ nhom: 'cong', ten: 'Lương công', tien: luongCong })

  // ── Tăng ca: mọi giờ ngoài "hành chính ngày thường".
  let tangCa = 0
  if (!khongChamCong) {
    const dsTc = [...phut].filter(([key]) => key !== `${hc}|thuong`)
    if (dsTc.length)
      why.push(
        `Tăng ca     giá giờ = ${so(donGiaNgay)} ÷ ${so(gioMotCong, 2)} = ${so(giaGio, 2)}`,
      )
    for (const k of b.khung)
      for (const ln of ['thuong', 'cn', 'le'] as const) {
        const p = phut.get(`${k.ma}|${ln}`)
        if (!p || (k.ma === hc && ln === 'thuong')) continue
        const tl = b.heSoKhung(k.ma, ln)
        if (tl == null) thieuHeSo.add(`${k.ma}${TEN_NGAY[ln] || ' ngày thường'}`)
        const tien = r0((p / 60) * giaGio * ((tl ?? 0) / 100))
        tangCa += tien
        dong.push({ nhom: 'tang_ca', ten: `${k.ma} ${k.ten}${TEN_NGAY[ln]}`, tien })
        why.push(
          `  ${k.ma}${TEN_NGAY[ln]}  ${so(p / 60, 2)} giờ × ${so(giaGio, 2)} × ${tl ?? '—'} % = ${so(tien)}`,
        )
      }
  }

  // ── Phụ cấp.
  let phuCap = 0
  let phuCapKhongThue = 0
  const tyLeCong = Math.min(1, b.congChuan ? congThuc / b.congChuan : 0)
  for (const p of hs.phuCap) {
    const tien = r0(
      p.theoNgay && !khongChamCong
        ? Math.min(p.muc, (p.muc / b.congChuan) * ngayDiLam)
        : p.muc * tyLeCong,
    )
    if (!tien) continue
    phuCap += tien
    if (!p.chiuThue) phuCapKhongThue += tien
    dong.push({ nhom: 'phu_cap', ten: p.ten, tien })
  }
  if (phuCap)
    why.push(
      `Phụ cấp     ${hs.phuCap
        .map((p) => p.ten.toLowerCase())
        .join(' + ')} (theo công thực ${so(congThuc, 2)}/${b.congChuan}) = ${so(phuCap)}`,
    )

  // ── Khoản theo kỳ.
  let khoanCong = 0
  let khoanTru = 0
  for (const k of khoan) {
    if (KHOAN_CONG.includes(k.loai)) khoanCong += k.tien
    else khoanTru += k.tien
    dong.push({
      nhom: 'khoan',
      ten: TEN_KHOAN[k.loai],
      tien: KHOAN_CONG.includes(k.loai) ? k.tien : -k.tien,
    })
  }
  if (khoanCong) why.push(`Khoản cộng  thưởng / truy lĩnh = ${so(khoanCong)}`)

  const tong = luongCong + nghiCoLuong + tangCa + phuCap + khoanCong
  why.push(`Tổng thu nhập = ${so(tong)}`)

  // ── Bảo hiểm.
  const coSoBh = hs.coBh ? Math.min(hs.luongBh ?? 0, tranBh(b.thang)) : 0
  const bhNld = r0(coSoBh * TY_LE_BH_NLD)
  const bhDn = r0(coSoBh * TY_LE_BH_DN)
  const kpcd = r0(coSoBh * TY_LE_KPCD)
  if (hs.coBh) {
    if (hs.luongBh == null) canhBao.push('Tham gia BH nhưng chưa có lương đóng BH')
    why.push(`BH NLĐ      ${so(coSoBh)} × 10,5 % = ${so(bhNld)}`)
  }

  // ── Thuế.
  let thue = 0
  if (hs.khauTru10) {
    thue = tong >= 2_000_000 ? r0(tong * 0.1) : 0
    why.push(`Thuế        khấu trừ 10 % × ${so(tong)} = ${so(thue)}`)
  } else {
    const chiuThue = tong - tangCa - phuCapKhongThue
    const tinhThue = chiuThue - bhNld - GIAM_TRU_BAN_THAN - GIAM_TRU_NPT * hs.npt
    thue = thueLuyTien(tinhThue)
    why.push(
      `Thuế        chịu thuế ${so(tong)} − tăng ca ${so(tangCa)} − phụ cấp miễn ${so(phuCapKhongThue)} = ${so(chiuThue)}`,
    )
    why.push(
      `            − BH ${so(bhNld)} − bản thân ${so(GIAM_TRU_BAN_THAN)}${hs.npt ? ` − ${hs.npt} NPT ${so(GIAM_TRU_NPT * hs.npt)}` : ''} = ${so(tinhThue)} → ${so(thue)}`,
    )
  }
  if (khoanTru) why.push(`Khoản trừ   tạm ứng / truy thu / khấu trừ = ${so(khoanTru)}`)

  const thucLinh = tong - bhNld - thue - khoanTru
  why.push(`Thực lĩnh = ${so(thucLinh)}`)
  if (thucLinh < 0) canhBao.push('Thực lĩnh âm')

  return {
    congThuc: Math.round(congThuc * 100) / 100,
    luongCong,
    tangCa,
    nghiCoLuong,
    phuCap,
    khoanCong,
    tong,
    bhNld,
    bhDn,
    kpcd,
    thue,
    khoanTru,
    thucLinh,
    dong,
    why,
    thieuHeSo: [...thieuHeSo],
    canhBao,
  }
}

/** Công chuẩn của kỳ = số ngày trong kỳ trừ chủ nhật và ngày lễ (Q6 của B4). */
export function congChuan(tu: string, den: string, ngayLe: string[]): number {
  const le = new Set(ngayLe)
  let n = 0
  for (
    let t = Date.parse(`${tu}T00:00:00Z`);
    t <= Date.parse(`${den}T00:00:00Z`);
    t += 86400_000
  ) {
    const d = new Date(t)
    const iso = d.toISOString().slice(0, 10)
    if (d.getUTCDay() !== 0 && !le.has(iso)) n++
  }
  return n
}
