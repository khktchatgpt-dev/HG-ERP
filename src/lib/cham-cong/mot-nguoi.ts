/**
 * TÓM TẮT "CHẤM CÔNG MỘT NGƯỜI" — hàm thuần, dùng chung ngăn kéo và file Excel (một
 * nguồn số). Chỉ đếm lượt quẹt, KHÔNG tính công.
 */

export type NgayLuot = {
  ngay: string
  luot: { gio: string; may: string; lap: number }[]
  soLuotTho: number
  /** false = cả công ty chưa có lượt ngày này — chưa lấy về, không phải vắng. */
  daLay: boolean
}

export const laChuNhat = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0

export type TomTatMotNguoi = {
  /** Ngày thường (không phải CN) đã có dữ liệu — mẫu số của "ngày có quẹt". */
  ngayThuong: number
  coQuet: number
  khongQuet: number
  motLuot: number
  tuBaLuot: number
  quetChuNhat: number
  chuaLay: number
  tongLuot: number
}

export function tomTatMotNguoi(ds: NgayLuot[]): TomTatMotNguoi {
  const t: TomTatMotNguoi = {
    ngayThuong: 0,
    coQuet: 0,
    khongQuet: 0,
    motLuot: 0,
    tuBaLuot: 0,
    quetChuNhat: 0,
    chuaLay: 0,
    tongLuot: 0,
  }
  for (const d of ds) {
    const n = d.luot.length
    t.tongLuot += n
    if (!d.daLay) {
      t.chuaLay++
      continue
    }
    if (n === 1) t.motLuot++
    if (n >= 3) t.tuBaLuot++
    if (laChuNhat(d.ngay)) {
      if (n) t.quetChuNhat++
      continue
    }
    t.ngayThuong++
    if (n) t.coQuet++
    else t.khongQuet++
  }
  return t
}

/** Chữ cột "Để ý" của một ngày — chung cho ngăn kéo và Excel. */
export function deYNgay(d: NgayLuot): { text: string; tone?: 'stop' | 'warn' }[] {
  const n = d.luot.length
  if (!d.daLay) return [{ text: 'chưa lấy dữ liệu' }]
  if (!n)
    return laChuNhat(d.ngay)
      ? [{ text: 'nghỉ chủ nhật' }]
      : [{ text: 'không quẹt', tone: 'stop' }]
  const out: { text: string; tone?: 'stop' | 'warn' }[] = []
  if (laChuNhat(d.ngay)) out.push({ text: 'làm chủ nhật' })
  if (n === 1) out.push({ text: 'chỉ 1 lượt', tone: 'warn' })
  if (n >= 3) out.push({ text: 'nhiều đoạn' })
  if (d.soLuotTho > n) out.push({ text: `bấm lặp ${d.soLuotTho - n}` })
  if (new Set(d.luot.map((l) => l.may)).size > 1)
    out.push({ text: '2 máy', tone: 'warn' })
  return out
}

/**
 * Bày lượt của một ngày cho người đọc hiểu ngay (chủ dự án 17/10/2026: "nhìn vào
 * biết là thông tin gì"): lượt ĐẦU = giờ vào, lượt CUỐI = giờ ra, các lượt còn lại
 * là lượt giữa; "có mặt" = từ lượt đầu tới lượt cuối. Chỉ để XEM — chưa phải công.
 */
export type LuotNgay = {
  vao: string | null
  ra: string | null
  giua: string[]
  /** Phút từ lượt đầu tới lượt cuối; null khi < 2 lượt. */
  coMatPhut: number | null
  /** Máy đã quẹt, dạng 'Máy 203'. */
  may: string[]
}

const phutCua = (gio: string) => Number(gio.slice(0, 2)) * 60 + Number(gio.slice(3, 5))

/** '.203' → 'Máy 203' — '.203' không ai đọc ra là máy. */
export const tenMay = (nhan: string) => `Máy ${nhan.replace(/^\./, '')}`

/** 684 → '11:24' (giờ:phút). */
export function gioPhut(phut: number): string {
  return `${Math.floor(phut / 60)}:${String(phut % 60).padStart(2, '0')}`
}

export function tachLuot(luot: { gio: string; may: string }[]): LuotNgay {
  const n = luot.length
  const hm = (g: string) => g.slice(0, 5)
  return {
    vao: n ? hm(luot[0].gio) : null,
    ra: n > 1 ? hm(luot[n - 1].gio) : null,
    giua: n > 2 ? luot.slice(1, -1).map((l) => hm(l.gio)) : [],
    coMatPhut: n > 1 ? phutCua(luot[n - 1].gio) - phutCua(luot[0].gio) : null,
    may: [...new Set(luot.map((l) => tenMay(l.may)))],
  }
}
