/**
 * TÍNH CÔNG MỘT NGÀY từ lượt quẹt thô — hàm thuần, không chạm DB.
 *
 * Luật chủ dự án chốt 12/10/2026 (8 câu ở artboard Chấm công):
 *   1. Giờ công trong ca = từ max(vào, giờ vào ca) tới min(ra, giờ tan ca), trừ giờ
 *      nghỉ khi làm quá nửa ca, trần = giờ chuẩn (ca − nghỉ). 1 công = giờ chuẩn.
 *   2. Tăng ca tính từ `otFrom` tới lượt ra, LÀM TRÒN XUỐNG `otRound` phút, không
 *      trừ ăn tối (ra 19:00 ca Xưởng = +3 giờ).
 *   3. Chủ nhật: mọi giờ (trong ca + tăng ca) dồn vào cột chủ nhật riêng.
 *   4. Ca 1 lượt (Văn phòng): có lượt là đủ công; trễ khi vào sau giờ vào + ân hạn.
 *   5. Đi trễ: ân hạn `graceMin` phút, chỉ ĐẾM, không trừ công.
 *   8. Ngày lễ có người làm: mọi giờ dồn vào cột lễ riêng.
 *
 * Lượt lặp trong 2 phút (bấm 2–4 lần cho chắc) gộp làm một. Vào/ra lấy theo GIỜ —
 * lượt đầu và lượt cuối ngày; cờ vào/ra của máy không ai bấm (đo tháng 9/2026).
 */

export type Ca = {
  code: string
  name: string
  /** 'HH:MM' */
  start: string
  end: string
  breakMin: number
  requiredPunches: 1 | 2
  otFrom: string
  otRound: number
  graceMin: number
}

export type LuotQuet = {
  /** Nhãn ngắn của máy ('.201'). */
  may: string
  /** 'HH:MM:SS' giờ Việt Nam. */
  gio: string
}

export type LoaiNgay = 'thuong' | 'cn' | 'le'

/**
 * ok = ngày thường đã tính · cn / le = có làm ngày chủ nhật / lễ ·
 * thieu = thiếu lượt (ca 2 lượt mà chỉ có 1, hoặc vào–ra cách nhau dưới 1 giờ) ·
 * ngoai = lượt vào nằm ngoài khung vào của ca (ca đêm? làm thay ca?).
 */
export type KieuNgay = 'ok' | 'cn' | 'le' | 'thieu' | 'ngoai'

export type KetQuaNgay = {
  kieu: KieuNgay
  /** Lượt sau khi gộp lặp; `lap` = số lượt lặp đã gộp vào lượt này. */
  luot: (LuotQuet & { lap: number })[]
  /** Phút công trong ca (0 khi thiếu / ngoài ca). */
  gioCong: number
  /** Phút tăng ca đã làm tròn. */
  tangCa: number
  /** Phút vào trễ so với giờ vào ca (0 nếu trong ân hạn). */
  tre: number
}

export const GOP_LAP_PHUT = 2
const KHOANG_TOI_THIEU = 60

export function phut(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/** Giờ chuẩn một công của ca, phút (Xưởng 07–16 nghỉ 60' = 480). */
export function gioChuan(ca: Ca): number {
  return phut(ca.end) - phut(ca.start) - ca.breakMin
}

/** Sắp theo giờ, gộp lượt cách lượt trước dưới 2 phút. */
export function gopLap(luot: LuotQuet[]): (LuotQuet & { lap: number })[] {
  const sorted = [...luot].sort((a, b) => (a.gio < b.gio ? -1 : a.gio > b.gio ? 1 : 0))
  const out: (LuotQuet & { lap: number })[] = []
  for (const l of sorted) {
    const truoc = out.at(-1)
    if (truoc && phut(l.gio) - phut(truoc.gio) < GOP_LAP_PHUT) {
      truoc.lap += 1
      continue
    }
    out.push({ ...l, lap: 0 })
  }
  return out
}

function tangCaPhut(ra: number, ca: Ca): number {
  const tu = phut(ca.otFrom)
  if (ra <= tu) return 0
  return Math.floor((ra - tu) / ca.otRound) * ca.otRound
}

export function tinhNgay(luotTho: LuotQuet[], ca: Ca, loai: LoaiNgay): KetQuaNgay | null {
  if (luotTho.length === 0) return null
  const luot = gopLap(luotTho)
  const vao = phut(luot[0].gio)
  const ra = phut(luot[luot.length - 1].gio)
  const coRa = luot.length >= 2 && ra - vao >= KHOANG_TOI_THIEU
  const batDau = phut(ca.start)
  const ketThuc = phut(ca.end)
  const chuan = gioChuan(ca)
  const tre = vao > batDau + ca.graceMin ? vao - batDau : 0
  const kieuCoLam: KieuNgay = loai === 'cn' ? 'cn' : loai === 'le' ? 'le' : 'ok'

  if (ca.requiredPunches === 1) {
    return {
      kieu: kieuCoLam,
      luot,
      gioCong: chuan,
      tangCa: coRa ? tangCaPhut(ra, ca) : 0,
      tre,
    }
  }

  if (!coRa) return { kieu: 'thieu', luot, gioCong: 0, tangCa: 0, tre: 0 }
  // Khung vào hợp lệ: 2 giờ trước giờ vào tới 5 giờ sau (Xưởng 05:00–12:00).
  if (vao < batDau - 120 || vao > batDau + 300) {
    return { kieu: 'ngoai', luot, gioCong: 0, tangCa: 0, tre: 0 }
  }
  const s = Math.max(vao, batDau)
  const e = Math.min(ra, ketThuc)
  const lam = Math.max(0, e - s)
  const truNghi = lam > (ketThuc - batDau) / 2 ? ca.breakMin : 0
  return {
    kieu: kieuCoLam,
    luot,
    gioCong: Math.min(chuan, Math.max(0, lam - truNghi)),
    tangCa: tangCaPhut(ra, ca),
    tre,
  }
}

export type TongThang = {
  /** Số công ngày thường (giờ công / giờ chuẩn), 2 lẻ. */
  cong: number
  /** Phút tăng ca ngày thường. */
  tangCa: number
  /** Phút làm chủ nhật (trong ca + tăng ca). */
  chuNhat: number
  /** Phút làm ngày lễ. */
  le: number
  thieu: number
  ngoai: number
  tre: number
}

export function tongThang(ngay: Iterable<KetQuaNgay>, ca: Ca): TongThang {
  const t: TongThang = {
    cong: 0,
    tangCa: 0,
    chuNhat: 0,
    le: 0,
    thieu: 0,
    ngoai: 0,
    tre: 0,
  }
  const chuan = gioChuan(ca)
  let phutCong = 0
  for (const n of ngay) {
    if (n.kieu === 'thieu') t.thieu++
    else if (n.kieu === 'ngoai') t.ngoai++
    else if (n.kieu === 'cn') t.chuNhat += n.gioCong + n.tangCa
    else if (n.kieu === 'le') t.le += n.gioCong + n.tangCa
    else {
      phutCong += n.gioCong
      t.tangCa += n.tangCa
      if (n.tre) t.tre++
    }
  }
  t.cong = Math.round((phutCong / chuan) * 100) / 100
  return t
}

/**
 * ĐOÁN CA cho nhân viên mới nạp từ máy, theo thói quen quẹt (lượt đầu mỗi ngày +
 * số lượt). Chỉ dùng lúc TẠO hồ sơ; Nhân sự sửa tay được, lần kéo sau không đè.
 *   - giữa lượt đầu trước 05:00            → Bếp
 *   - ≥ 80% ngày chỉ 1 lượt, vào 07:15–08:30 → Văn phòng
 *   - còn lại                                → Xưởng
 */
export function doanCa(ngay: { dau: string; soLuot: number }[]): 'XUONG' | 'VP' | 'BEP' {
  if (ngay.length === 0) return 'XUONG'
  const dau = ngay.map((n) => phut(n.dau)).sort((a, b) => a - b)
  const giua = dau[dau.length >> 1]
  if (giua < 300) return 'BEP'
  const motLuot = ngay.filter((n) => n.soLuot < 2).length / ngay.length
  if (motLuot >= 0.8 && giua >= 435 && giua <= 510) return 'VP'
  return 'XUONG'
}
