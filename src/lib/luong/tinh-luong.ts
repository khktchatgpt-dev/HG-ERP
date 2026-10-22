/**
 * TÍNH PHIẾU LƯƠNG MỘT NGƯỜI MỘT KỲ — hàm thuần (B5, bản vẽ duyệt 18/10/2026, Q1–Q8 theo
 * đề xuất). Ba nguồn đầu vào đều đã khoá: bản chốt kỳ công (giờ theo khung từng ngày), hồ
 * sơ lương (đơn giá / lương tháng, lương BH, NPT, phụ cấp), hệ số của bản cách tính.
 *
 *   giá giờ    = đơn giá ÷ giờ một công   (theo tháng: lương tháng ÷ công chuẩn ÷ giờ một công)
 *   lương công = giờ hành chính ngày thường VÀ chủ nhật × giá giờ × hệ số K1 của loại ngày
 *                (theo tháng: lương tháng × công thực ÷ công chuẩn — gồm CN, nghỉ có lương)
 *   tăng ca    = mọi giờ còn lại (khung ngoài hành chính, mọi khung ngày lễ) × giá giờ × hệ số;
 *                giờ giải lao trả % riêng (`ptTrua`, KT: 210 %); hồ sơ khoán đ/giờ (QC) thì
 *                tổng giờ tăng ca × đ/giờ
 *   nghỉ có lương (theo công) = số ngày × đơn giá × hệ số loại nghỉ
 *   ngày lễ KHÔNG đi làm: KHÔNG tự trả (chủ dự án 21/10/2026, theo sổ T9: công ngày 02/09 = 0;
 *                ai được thưởng lễ thì Kế toán ghi khoản thưởng riêng). Đi làm ngày lễ vẫn
 *                tính tăng ca theo hệ số khung ngày lễ
 *   phụ cấp    = theo TỪNG dòng: chia (mức ÷ 26 / 32 / công chuẩn × công thực, không trần) ·
 *                nhân (mức × công, có thể cộng công tăng ca) · cố định; khoản "theo ngày đi
 *                làm" (Ăn ca) kiểu cũ = mức ÷ công chuẩn × số ngày có đi làm (Q2)
 *   BH NLĐ     = min(lương đóng BH, trần) × 10,5 %; doanh nghiệp 21,5 %, KPCĐ 2 %
 *   đoàn phí   = lương đóng BH × 0,5 % (NLĐ, người có đóng BH và là đoàn viên)
 *   thuế       = khấu trừ 10 % (Q4) hoặc luỹ tiến 5 bậc trên: tổng thu nhập − tăng ca (miễn
 *                toàn bộ) − phụ cấp không chịu thuế − BH NLĐ − 15,5 tr − 6,2 tr × NPT.
 *                Bản cách tính chưa bật `truThue` thì chỉ TÍNH và bày, không trừ (Q5)
 *   thực lĩnh  = tổng thu nhập − BH NLĐ − đoàn phí − thuế (nếu trừ) − tạm ứng / truy thu / khấu trừ
 * Khớp sổ Kế toán T9/2026 (đối chiếu 20/10/2026): công chuẩn 26, K2–K3 133,33 %, K4–K6 và giờ
 * giải lao 210 %, CN 100 % vào lương công, phụ cấp chia 26 hoặc 32 theo từng người.
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
/** Đoàn phí NLĐ trừ lương: 0,5 % lương đóng BH (sổ T9: 3.960.000 → 19.800). */
export const TY_LE_DOAN_PHI = 0.005

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

/** Cách tính một dòng phụ cấp (0254). */
export type CachPhuCap = 'chia' | 'nhan' | 'co_dinh'

export type PhuCapTinh = {
  ten: string
  muc: number
  chiuThue: boolean
  /** Loại "theo ngày đi làm" (Ăn ca) — chỉ áp khi `cach` = 'chia' và không có `chia`. */
  theoNgay: boolean
  cach: CachPhuCap
  /** Số chia của 'chia' (26, 32…); null = công chuẩn. */
  chia: number | null
  /** 'nhan' tính cả công tăng ca: (công + công TC) × mức. */
  coTangCa: boolean
}

export type HoSoTinh = {
  cachTra: 'daily' | 'monthly'
  donGia: number | null
  luongThang: number | null
  luongBh: number | null
  coBh: boolean
  npt: number
  khauTru10: boolean
  /** Tăng ca khoán đ/giờ (QC 20.000); null = theo hệ số khung. */
  tangCaGio: number | null
  /** Có trừ đoàn phí NLĐ 0,5 % (chỉ khi có đóng BH). */
  doanPhi: boolean
  phuCap: PhuCapTinh[]
}

export type NgayTinh = {
  ngay: string
  /** Phút theo khung, CHƯA gồm làm trưa — phút làm trưa đã quy đổi đi riêng ở `trua`. */
  k: Record<string, number>
  trua: number
  nghi: MaNghi | null
  khong: boolean
}

/** Công người không chấm công do Nhân sự nhập (0262): số công + phút tăng ca. */
export type NhapTay = { cong: number; tcPhut: number }

export type BoiCanhTinh = {
  thang: string
  phutMotCong: number
  khung: { ma: string; ten: string; hanhChinh: boolean }[]
  congChuan: number
  loaiNgay: (ngay: string) => LoaiNgayLuong
  /** % hệ số; null = ô trống. */
  heSoKhung: (ma: string, ngay: LoaiNgayLuong) => number | null
  heSoNghi: (ma: MaNghi) => number | null
  /** Hệ số quy đổi phút làm trưa lúc chốt công (`trua` = phút thật × hệ số này). */
  heSoTrua: number
  /** % trả giờ giải lao như tăng ca; null = cộng vào hành chính như lúc chốt công. */
  ptTrua: number | null
  /** Trừ thuế TNCN trên bảng (Q5: mặc định không — chỉ tính và bày). */
  truThue: boolean
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
  doanPhi: number
  thue: number
  /** Thuế có trừ vào thực lĩnh không (bản cách tính). */
  truThue: boolean
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
  /**
   * Người không chấm công: `true` = đủ công chuẩn; một SỐ = số công được hưởng khi chỉ làm
   * một phần kỳ (vào / nghỉ giữa kỳ, 0248); `{ cong, tcPhut }` = Nhân sự NHẬP TAY (0262) —
   * không đặt trần công chuẩn (sổ T9 trả 32 công ÷ 26), tăng ca tính ở khung tăng ca đầu tiên.
   */
  mien: boolean | number | NhapTay = false,
): Phieu {
  const khongChamCong = mien !== false
  const nhap = typeof mien === 'object' ? mien : null
  const congMien = nhap
    ? nhap.cong
    : typeof mien === 'number'
      ? Math.min(mien, b.congChuan)
      : b.congChuan
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
  // Giờ giải lao trả riêng (KT: 210 %) — lấy lại phút THẬT từ phút đã quy đổi lúc chốt công.
  const truaRieng = b.ptTrua != null
  let truaPhut = 0
  for (const d of ngays) {
    if (d.khong) continue
    if (d.nghi) nghi.set(d.nghi, (nghi.get(d.nghi) ?? 0) + 1)
    const ln = b.loaiNgay(d.ngay)
    let co = false
    if (truaRieng && d.trua > 0) {
      truaPhut += d.trua / (b.heSoTrua || 1)
      co = true
    }
    for (const [ma, p] of Object.entries(d.k)) {
      const them = p + (ma === hc && !truaRieng ? d.trua : 0)
      if (them <= 0) continue
      co = true
      phut.set(`${ma}|${ln}`, (phut.get(`${ma}|${ln}`) ?? 0) + them)
    }
    if (co) ngayDiLam++
  }

  // ── Công thực (dùng cho theo tháng + phụ cấp). Chủ nhật làm giờ hành chính = ngày công
  // (sổ KT cộng CN vào "C.thời gian"), không phải tăng ca.
  const congHcThuong = (phut.get(`${hc}|thuong`) ?? 0) / b.phutMotCong
  const congHcCn = (phut.get(`${hc}|cn`) ?? 0) / b.phutMotCong
  const congHc = congHcThuong + congHcCn
  let congNghi = 0
  for (const [ma, so_] of nghi) congNghi += (so_ * (b.heSoNghi(ma) ?? 0)) / 100
  const congThuc = khongChamCong ? congMien : congHc + congNghi

  // ── Lương công + nghỉ có lương.
  let luongCong = 0
  let nghiCoLuong = 0
  if (nhap) {
    luongCong = r0(
      theoCong ? donGiaNgay * congMien : ((hs.luongThang ?? 0) * congMien) / b.congChuan,
    )
    why.push(
      theoCong
        ? `Lương       không chấm công — Nhân sự nhập ${so(congMien, 2)} công × ${so(donGiaNgay)} = ${so(luongCong)}`
        : `Lương       không chấm công — Nhân sự nhập ${so(congMien, 2)} công: ${so(hs.luongThang ?? 0)} × ${so(congMien, 2)} ÷ ${b.congChuan} = ${so(luongCong)}`,
    )
  } else if (khongChamCong) {
    const du = congMien >= b.congChuan
    luongCong = r0(
      theoCong
        ? donGiaNgay * congMien
        : du
          ? (hs.luongThang ?? 0)
          : ((hs.luongThang ?? 0) * congMien) / b.congChuan,
    )
    why.push(
      du
        ? `Lương       không chấm công — đủ ${b.congChuan} công chuẩn = ${so(luongCong)}`
        : `Lương       không chấm công — làm ${so(congMien, 2)}/${b.congChuan} công chuẩn (vào / nghỉ giữa kỳ) = ${so(luongCong)}`,
    )
  } else if (theoCong) {
    const hsHc = b.heSoKhung(hc, 'thuong')
    if (hsHc == null && congHcThuong > 0) thieuHeSo.add(`${hc} ngày thường`)
    const hsCn = b.heSoKhung(hc, 'cn')
    if (hsCn == null && congHcCn > 0) thieuHeSo.add(`${hc} CN`)
    const pt = (h: number | null) => (h != null && h !== 100 ? ` × ${h} %` : '')
    luongCong = r0(
      congHcThuong * donGiaNgay * ((hsHc ?? 0) / 100) +
        congHcCn * donGiaNgay * ((hsCn ?? 0) / 100),
    )
    why.push(
      `Lương công  ${so(congHcThuong, 2)} công × ${so(donGiaNgay)}${pt(hsHc)}${congHcCn ? ` + CN ${so(congHcCn, 2)} công × ${so(donGiaNgay)}${pt(hsCn)}` : ''} = ${so(luongCong)}`,
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
  } else {
    luongCong = r0(((hs.luongThang ?? 0) * congThuc) / b.congChuan)
    why.push(
      `Lương tháng ${so(hs.luongThang ?? 0)} × ${so(congThuc, 2)} công ÷ ${b.congChuan} = ${so(luongCong)}`,
    )
    for (const [ma] of nghi) if (b.heSoNghi(ma) == null) thieuHeSo.add(TEN_NGHI[ma])
  }
  dong.unshift({ nhom: 'cong', ten: 'Lương công', tien: luongCong })

  // ── Tăng ca: mọi giờ ngoài "hành chính ngày thường".
  // Công tăng ca đã quy đổi (sổ KT: "Tổng công tăng ca") — nền cho phụ cấp "(công + công TC)".
  let tangCa = 0
  let congTc = 0
  if (!khongChamCong) {
    // Hành chính ngày thường và CN là ngày công; hành chính ngày lễ vẫn là tăng ca.
    const laTc = (ma: string, ln: LoaiNgayLuong) => !(ma === hc && ln !== 'le')
    const dsTc = [...phut].filter(([key]) => {
      const [ma, ln] = key.split('|') as [string, LoaiNgayLuong]
      return laTc(ma, ln)
    })
    if (hs.tangCaGio != null) {
      const gio = (dsTc.reduce((t, [, p]) => t + p, 0) + truaPhut) / 60
      if (gio > 0) {
        tangCa = r0(gio * hs.tangCaGio)
        congTc = gio / gioMotCong
        dong.push({ nhom: 'tang_ca', ten: 'Tăng ca khoán', tien: tangCa })
        why.push(
          `Tăng ca     khoán ${so(gio, 2)} giờ × ${so(hs.tangCaGio)} = ${so(tangCa)}`,
        )
      }
    } else {
      if (dsTc.length || truaPhut > 0)
        why.push(
          `Tăng ca     giá giờ = ${so(donGiaNgay)} ÷ ${so(gioMotCong, 2)} = ${so(giaGio, 2)}`,
        )
      for (const k of b.khung)
        for (const ln of ['thuong', 'cn', 'le'] as const) {
          const p = phut.get(`${k.ma}|${ln}`)
          if (!p || !laTc(k.ma, ln)) continue
          const tl = b.heSoKhung(k.ma, ln)
          if (tl == null) thieuHeSo.add(`${k.ma}${TEN_NGAY[ln] || ' ngày thường'}`)
          const tien = r0((p / 60) * giaGio * ((tl ?? 0) / 100))
          tangCa += tien
          congTc += ((p / 60) * ((tl ?? 0) / 100)) / gioMotCong
          dong.push({ nhom: 'tang_ca', ten: `${k.ma} ${k.ten}${TEN_NGAY[ln]}`, tien })
          why.push(
            `  ${k.ma}${TEN_NGAY[ln]}  ${so(p / 60, 2)} giờ × ${so(giaGio, 2)} × ${tl ?? '—'} % = ${so(tien)}`,
          )
        }
      if (truaPhut > 0 && b.ptTrua != null) {
        const tien = r0((truaPhut / 60) * giaGio * (b.ptTrua / 100))
        tangCa += tien
        congTc += ((truaPhut / 60) * (b.ptTrua / 100)) / gioMotCong
        dong.push({ nhom: 'tang_ca', ten: 'Giờ giải lao', tien })
        why.push(
          `  Giải lao  ${so(truaPhut / 60, 2)} giờ × ${so(giaGio, 2)} × ${b.ptTrua} % = ${so(tien)}`,
        )
      }
    }
  }
  // Tăng ca nhập tay (Q4): giờ × giá giờ × hệ số khung tăng ca đầu tiên ngày thường.
  if (nhap && nhap.tcPhut > 0) {
    const gio = nhap.tcPhut / 60
    if (hs.tangCaGio != null) {
      tangCa = r0(gio * hs.tangCaGio)
      congTc = gio / gioMotCong
      dong.push({ nhom: 'tang_ca', ten: 'Tăng ca khoán (nhập tay)', tien: tangCa })
      why.push(
        `Tăng ca     khoán ${so(gio, 2)} giờ × ${so(hs.tangCaGio)} = ${so(tangCa)}`,
      )
    } else {
      const k = b.khung.find((x) => !x.hanhChinh)
      const tl = k ? b.heSoKhung(k.ma, 'thuong') : null
      if (tl == null) thieuHeSo.add(`${k?.ma ?? 'khung tăng ca'} ngày thường`)
      tangCa = r0(gio * giaGio * ((tl ?? 0) / 100))
      congTc = (gio * ((tl ?? 0) / 100)) / gioMotCong
      dong.push({
        nhom: 'tang_ca',
        ten: `${k?.ma ?? ''} ${k?.ten ?? ''} (nhập tay)`.trim(),
        tien: tangCa,
      })
      why.push(
        `Tăng ca     nhập tay ${so(gio, 2)} giờ × ${so(giaGio, 2)} × ${tl ?? '—'} % = ${so(tangCa)}`,
      )
    }
  }

  // ── Phụ cấp.
  // Sổ KT không đặt trần: làm 27 công chia 26 thì nhận hơn mức (VP T9).
  let phuCap = 0
  let phuCapKhongThue = 0
  for (const p of hs.phuCap) {
    let tien: number
    let cach: string
    if (p.cach === 'co_dinh') {
      tien = r0(p.muc)
      cach = 'cố định'
    } else if (p.cach === 'nhan') {
      const nen = congThuc + (p.coTangCa ? congTc : 0)
      tien = r0(p.muc * nen)
      cach = `${so(p.muc)} × ${so(nen, 2)} công${p.coTangCa ? ' (gồm công TC)' : ''}`
    } else if (p.theoNgay && p.chia == null && !khongChamCong) {
      tien = r0(Math.min(p.muc, (p.muc / b.congChuan) * ngayDiLam))
      cach = `${so(p.muc)} ÷ ${b.congChuan} × ${ngayDiLam} ngày đi làm`
    } else {
      const chia = p.chia ?? b.congChuan
      tien = chia ? r0((p.muc / chia) * congThuc) : 0
      cach = `${so(p.muc)} ÷ ${so(chia)} × ${so(congThuc, 2)} công`
    }
    if (!tien) continue
    phuCap += tien
    if (!p.chiuThue) phuCapKhongThue += tien
    dong.push({ nhom: 'phu_cap', ten: p.ten, tien })
    why.push(`  ${p.ten}  ${cach} = ${so(tien)}`)
  }
  if (phuCap) why.push(`Phụ cấp     = ${so(phuCap)}`)

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
  const doanPhi = hs.coBh && hs.doanPhi ? r0(coSoBh * TY_LE_DOAN_PHI) : 0
  if (hs.coBh) {
    if (hs.luongBh == null) canhBao.push('Tham gia BH nhưng chưa có lương đóng BH')
    why.push(`BH NLĐ      ${so(coSoBh)} × 10,5 % = ${so(bhNld)}`)
    if (doanPhi) why.push(`Đoàn phí    ${so(coSoBh)} × 0,5 % = ${so(doanPhi)}`)
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
  if (!b.truThue && thue)
    why.push(`            thuế ${so(thue)} KHÔNG trừ trên bảng (Q5 — Kế toán chưa trừ)`)
  if (khoanTru) why.push(`Khoản trừ   tạm ứng / truy thu / khấu trừ = ${so(khoanTru)}`)

  const thucLinh = tong - bhNld - doanPhi - (b.truThue ? thue : 0) - khoanTru
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
    doanPhi,
    thue,
    truThue: b.truThue,
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
