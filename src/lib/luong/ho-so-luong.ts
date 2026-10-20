/**
 * HỒ SƠ LƯƠNG — hàm thuần (B4, bản vẽ duyệt 18/10/2026, Q1–Q7 theo đề xuất).
 *
 * Một người có nhiều BẢN, mỗi bản "từ kỳ X"; kỳ Y dùng bản có từ-kỳ lớn nhất ≤ Y (cùng
 * luật Cách tính công). Nạp từ file Kế toán: file không có mã NV, nên khớp theo HỌ TÊN
 * (bỏ dấu) và dùng tên tổ để gỡ trùng — không khớp chắc thì để người chọn, không đoán.
 */

export type CachTra = 'daily' | 'monthly'
export const TEN_CACH_TRA: Record<CachTra, string> = {
  daily: 'Theo công',
  monthly: 'Theo tháng',
}

/** Bản đang hiệu lực cho kỳ `thang`: từ-kỳ lớn nhất ≤ kỳ. */
export function banHieuLuc<T extends { tuKy: string }>(
  ban: T[],
  thang: string,
): T | null {
  let chon: T | null = null
  for (const b of ban) if (b.tuKy <= thang && (!chon || b.tuKy > chon.tuKy)) chon = b
  return chon
}

export type ThieuThongTin = { luong: boolean; stk: boolean; bh: boolean }

/** Còn thiếu gì để tính lương: đơn giá / lương tháng, số tài khoản, lương đóng BH (nếu tham gia). */
export function thieu(
  hs: {
    cachTra: CachTra
    donGia: number | null
    luongThang: number | null
    luongBh: number | null
    coBh: boolean
  } | null,
  stk: string | null | undefined,
): ThieuThongTin {
  return {
    luong: !hs || (hs.cachTra === 'daily' ? hs.donGia == null : hs.luongThang == null),
    stk: !stk,
    bh: !!hs && hs.coBh && hs.luongBh == null,
  }
}

/** Bỏ dấu, thường hoá, gộp khoảng trắng — khoá so tên. */
export function khongDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tên tổ trong file Kế toán ("Bộ phận Kho", "Phòng nhân sự") ~ danh mục tổ ("Kho", "Phòng Nhân Sự"). */
export function cungTo(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false
  const bo = (s: string) => khongDau(s).replace(/^(bo phan|phong|to|khoan)\s+/, '')
  const x = bo(a)
  const y = bo(b)
  return x === y || x.includes(y) || y.includes(x)
}

export type NguoiKhop = { id: string; ma: string; ten: string; to: string | null }
export type KetQuaKhop =
  | { kieu: 'khop'; nguoi: NguoiKhop }
  | { kieu: 'nhieu'; ungVien: NguoiKhop[] }
  | { kieu: 'khong' }

/** Khớp một dòng file với nhân viên: đúng họ tên (bỏ dấu); trùng tên thì dùng tổ để gỡ. */
export function khopTen(ten: string, to: string | null, ds: NguoiKhop[]): KetQuaKhop {
  const k = khongDau(ten)
  if (!k) return { kieu: 'khong' }
  const cung = ds.filter((n) => khongDau(n.ten) === k)
  if (cung.length === 1) return { kieu: 'khop', nguoi: cung[0] }
  if (cung.length > 1) {
    const theoTo = cung.filter((n) => cungTo(n.to, to))
    if (theoTo.length === 1) return { kieu: 'khop', nguoi: theoTo[0] }
    return { kieu: 'nhieu', ungVien: theoTo.length ? theoTo : cung }
  }
  return { kieu: 'khong' }
}

const NGAN_HANG: Record<string, string> = {
  agribank: 'Agribank',
  vietcombank: 'Vietcombank',
  vcb: 'Vietcombank',
  bidv: 'BIDV',
  mbbank: 'MB Bank',
  mb: 'MB Bank',
  vietinbank: 'VietinBank',
  techcombank: 'Techcombank',
  acb: 'ACB',
  tpbank: 'TPBank',
  lpbank: 'LPBank',
  sacombank: 'Sacombank',
  bvbank: 'BVBank',
  vpbank: 'VPBank',
  shb: 'SHB',
}

/** "AGRIBANK" / "Agribank" / "TP BANK" → một cách viết. Tên lạ giữ nguyên (đã gọn khoảng trắng). */
export function chuanNganHang(s: string | null | undefined): string | null {
  const t = (s ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return null
  return NGAN_HANG[khongDau(t).replace(/[\s.-]/g, '')] ?? t
}

/** Số kiểu VN trong ô Excel dán ra: "636.000" = 636000, "1.215.000,5" = 1215000.5. */
export function docSo(s: string | null | undefined): number | null {
  const t = (s ?? '').trim().replace(/[\sđ₫]/gi, '')
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export type CotNap =
  | 'ten'
  | 'to'
  | 'stk'
  | 'nganHang'
  | 'donGia'
  | 'luongThang'
  | 'luongBh'
  | 'cccd'
  | 'mst'
  | 'npt'

const NHAN_COT: [CotNap, RegExp][] = [
  ['stk', /so tai khoan|stk/],
  ['nganHang', /ngan hang/],
  ['ten', /ten nguoi thu huong|ho (va )?ten|^ten$/],
  ['to', /phong ban|bo phan|^to$/],
  ['donGia', /don gia/],
  ['luongBh', /luong (dong )?bh|luong bhxh|muc dong/],
  ['luongThang', /luong thang|luong co ban|luong chinh/],
  ['cccd', /cccd|can cuoc/],
  ['mst', /ma so thue|mst/],
  ['npt', /phu thuoc|npt/],
]

export type DongNap = Partial<Record<CotNap, string>> & { dong: number }

/**
 * Đọc vùng dán từ Excel (tab giữa cột). Tìm dòng tiêu đề trong 15 dòng đầu — dòng đầu tiên
 * nhận ra được cột Họ tên. Cột không nhận ra thì bỏ (vd "SỐ TIỀN" = thực lĩnh, không phải
 * đơn giá). Trả các cột đã nhận + các dòng có tên.
 */
export function docDan(text: string): { cot: CotNap[]; dong: DongNap[] } {
  const hang = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t'))
  let dau = -1
  let map: (CotNap | null)[] = []
  for (let i = 0; i < Math.min(15, hang.length); i++) {
    const m = hang[i].map((o) => {
      const k = khongDau(o)
      return k ? (NHAN_COT.find(([, re]) => re.test(k))?.[0] ?? null) : null
    })
    if (m.includes('ten')) {
      dau = i
      map = m
      break
    }
  }
  if (dau < 0) return { cot: [], dong: [] }
  const dong: DongNap[] = []
  for (let i = dau + 1; i < hang.length; i++) {
    const r: DongNap = { dong: i + 1 }
    hang[i].forEach((o, j) => {
      const c = map[j]
      if (c && o.trim() && r[c] === undefined) r[c] = o.trim()
    })
    // Dòng chỉ có tên (không ô dữ liệu nào khác) là dòng chân file: "Tổng cộng", chữ ký.
    const coDuLieu = Object.keys(r).some((k) => k !== 'dong' && k !== 'ten' && k !== 'to')
    if (r.ten && !/^\d+$/.test(r.ten) && coDuLieu) dong.push(r)
  }
  return { cot: [...new Set(map.filter((c): c is CotNap => !!c))], dong }
}

/** Che số định danh: chỉ chừa 4 số cuối. */
export const che = (s: string | null | undefined) =>
  s ? `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : null
