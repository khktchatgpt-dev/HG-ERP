/**
 * HỒ SƠ LƯƠNG — hàm thuần (B4, bản vẽ duyệt 18/10/2026, Q1–Q7 theo đề xuất).
 *
 * Một người có nhiều BẢN, mỗi bản "từ kỳ X"; kỳ Y dùng bản có từ-kỳ lớn nhất ≤ Y (cùng
 * luật Cách tính công). Nạp từ file Kế toán: sổ lương có cột "Mã số NV" thì khớp theo MÃ
 * (20/10/2026, Q7); file chuyển khoản không có mã thì khớp theo HỌ TÊN (bỏ dấu) và dùng tên
 * tổ để gỡ trùng — không khớp chắc thì để người chọn, không đoán.
 */

import type { CachPhuCap } from './tinh-luong'

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
  | {
      kieu: 'nhieu'
      ungVien: NguoiKhop[]
      /** Vì sao không tự khớp — vd mã trong sổ là của người khác tên. */
      lyDo?: string
    }
  | { kieu: 'khong' }

/** "00441" = "441": mã trong sổ Excel hay đệm số 0 đầu, danh mục thì không. */
const maGon = (s: string) =>
  s
    .trim()
    .replace(/[.,\s]/g, '')
    .replace(/^0+(?=\d)/, '')

/**
 * Tên ERP có phải tên trong sổ không — kể cả khi ERP chỉ giữ ĐUÔI tên bị máy chấm công cắt
 * ("THI HOA" ~ "Trịnh Thị Hòa", "BA THONG" ~ "Diệp Bảo Thông", "DUYSANH" ~ "Đào Thị Duy Sanh").
 */
export function cungTen(erp: string, so: string): boolean {
  const a = khongDau(erp).split(' ').filter(Boolean)
  const b = khongDau(so).split(' ').filter(Boolean)
  if (!a.length || !b.length) return false
  if (b.join('').endsWith(a.join(''))) return true
  if (a.length > b.length) return false
  const duoi = b.slice(b.length - a.length)
  return a.every((t, i) => duoi[i].startsWith(t))
}

/**
 * Khớp một dòng file: có MÃ NV và tên ERP của mã đó hợp với tên trong sổ thì lấy theo mã.
 * Mã trùng mà tên LỆCH (sổ "Thanh Kiều" ghi mã của "Mỹ Liên", 20/10/2026) thì KHÔNG tự khớp
 * — đưa người theo mã + người trùng tên ra cho người nạp chọn, vì ghi nhầm là trả lương nhầm
 * người. Không có mã / mã lạ thì rơi về khớp họ tên + tổ.
 */
export function khopNguoi(
  ma: string | null | undefined,
  ten: string,
  to: string | null,
  ds: NguoiKhop[],
): KetQuaKhop {
  const theoTen = khopTen(ten, to, ds)
  if (!ma || !maGon(ma)) return theoTen
  const theoMa = ds.filter((n) => maGon(n.ma) === maGon(ma))
  if (theoMa.length !== 1) return theoTen
  if (cungTen(theoMa[0].ten, ten)) return { kieu: 'khop', nguoi: theoMa[0] }
  const ungVien = [
    theoMa[0],
    ...(theoTen.kieu === 'khop'
      ? [theoTen.nguoi]
      : theoTen.kieu === 'nhieu'
        ? theoTen.ungVien
        : []),
  ].filter((n, i, xs) => xs.findIndex((x) => x.id === n.id) === i)
  return {
    kieu: 'nhieu',
    ungVien,
    lyDo: `mã ${theoMa[0].ma} trên ERP là ${theoMa[0].ten}`,
  }
}

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
  // Máy đặt định dạng Mỹ thì Excel chép ra "15,000,000" — phẩy NHÓM nghìn, không phải thập phân.
  if (/^-?\d{1,3}(,\d{3})+$/.test(t)) return Number(t.replace(/,/g, ''))
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export type CotNap =
  | 'ma'
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
  /** "Trừ tiền BHXH + BHYT + BHTN" của sổ lương: > 0 → lương đóng BH = số này ÷ 10,5 %. */
  | 'truBh'
  /** Ô "Công đoàn" của sổ lương: 0 ở người có đóng BH = không trừ đoàn phí. */
  | 'doanPhi'

/** Cột "M/ Lương Ngày" của sổ lương: một ô cho cả hai cách trả — tách theo độ lớn. */
const MUC_LUONG = /^m\/ ?luong|^muc luong/
/** Dưới 1 triệu là đơn giá một công (TTSX 350.000); từ 1 triệu là lương tháng (VP 15.000.000). */
export const NGUONG_LUONG_THANG = 1_000_000

const NHAN_COT: [CotNap, RegExp][] = [
  ['ma', /^ma so nv|^ma nv|^msnv|^ma nhan vien/],
  ['stk', /so tai khoan|stk/],
  ['nganHang', /ngan hang/],
  ['ten', /ten nguoi thu huong|ho (va )?ten|^ten$/],
  // Khớp NGUYÊN Ô: "Thưởng hỗ trợ phòng ban khác" là cột tiền, không phải cột tổ.
  ['to', /^(phong ban|bo phan|to)$/],
  ['truBh', /^tru (tien )?bh/],
  ['doanPhi', /^cong doan/],
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
  const hang = tachTsv(text)
  const nhan = (o: string | undefined): CotNap | 'muc' | null => {
    const k = khongDau(o ?? '')
    if (!k) return null
    if (MUC_LUONG.test(k)) return 'muc'
    return NHAN_COT.find(([, re]) => re.test(k))?.[0] ?? null
  }
  let dau = -1
  let map: (CotNap | 'muc' | null)[] = []
  for (let i = 0; i < Math.min(15, hang.length); i++) {
    const m = hang[i].map(nhan)
    if (m.includes('ten')) {
      dau = i
      map = m
      break
    }
  }
  if (dau < 0) return { cot: [], dong: [] }
  // Sổ lương có tiêu đề HAI tầng ("LƯƠNG LÀM VIỆC" trên, "C.thời gian" dưới; "Trừ tiền BH"
  // nằm ở tầng dưới). Dòng ngay dưới mà ô Họ tên trống là tầng dưới: ô nào tầng trên chưa
  // nhận ra thì lấy nhãn tầng dưới.
  const duoi = hang[dau + 1]
  let batDau = dau + 1
  if (duoi && !(duoi[map.indexOf('ten')] ?? '').trim()) {
    duoi.forEach((o, j) => {
      if (!map[j]) map[j] = nhan(o)
    })
    batDau = dau + 2
  }
  const dong: DongNap[] = []
  for (let i = batDau; i < hang.length; i++) {
    const r: DongNap = { dong: i + 1 }
    hang[i].forEach((o, j) => {
      let c = map[j]
      if (c === 'muc') {
        const n = docSo(o)
        if (n == null || n <= 0) return
        c = n >= NGUONG_LUONG_THANG ? 'luongThang' : 'donGia'
      }
      if (c && o.trim() && r[c] === undefined) r[c] = o.trim()
    })
    // Dòng chỉ có tên (không ô dữ liệu nào có CHỮ SỐ) là dòng chân file: "Tổng cộng", chữ
    // ký "NGƯỜI LẬP · KẾ TOÁN TRƯỞNG" nằm lọt vào cột số.
    const coDuLieu = (Object.keys(r) as (keyof DongNap)[]).some(
      (k) =>
        k !== 'dong' &&
        k !== 'ten' &&
        k !== 'to' &&
        k !== 'ma' &&
        /\d/.test(String(r[k])),
    )
    if (r.ten && !/^\d+$/.test(r.ten) && coDuLieu) dong.push(r)
  }
  const cot = new Set(map.filter((c): c is CotNap => !!c && c !== 'muc'))
  for (const r of dong)
    for (const k of ['donGia', 'luongThang'] as const) if (r[k]) cot.add(k)
  return { cot: [...cot], dong }
}

/**
 * Tách vùng dán từ Excel thành bảng (tab giữa cột). Excel bọc ô có xuống dòng trong ngoặc
 * kép ("M/ Lương ⏎ Ngày") — tách thẳng theo xuống dòng là gãy dòng tiêu đề làm đôi.
 */
export function tachTsv(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n')
  const hang: string[][] = []
  let dong: string[] = []
  let o = ''
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"' && o === '') {
      // Ô trong ngoặc kép: đọc tới dấu " đóng ("" = một dấu "). Không đóng ngay trước
      // tab / xuống dòng / hết chữ thì coi dấu " là chữ thường.
      let j = i + 1
      let v = ''
      for (; j < t.length; j++) {
        if (t[j] !== '"') v += t[j]
        else if (t[j + 1] === '"') {
          v += '"'
          j++
        } else break
      }
      const sau = t[j + 1]
      if (j < t.length && (sau === undefined || sau === '\t' || sau === '\n')) {
        o = v.replace(/\n/g, ' ')
        i = j
        continue
      }
      o += c
    } else if (c === '\t') {
      dong.push(o)
      o = ''
    } else if (c === '\n') {
      dong.push(o)
      hang.push(dong)
      dong = []
      o = ''
    } else o += c
  }
  if (o !== '' || dong.length) {
    dong.push(o)
    hang.push(dong)
  }
  return hang
}

/** Che số định danh: chỉ chừa 4 số cuối. */
export const che = (s: string | null | undefined) =>
  s ? `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : null

/** Cách tính một dòng phụ cấp trên hồ sơ (0254) — sổ KT T9 mỗi người một kiểu. */
export type CachPhuCapDong = { cach: CachPhuCap; chia: number | null; coTangCa: boolean }

export const CACH_PC_MAC_DINH: CachPhuCapDong = {
  cach: 'chia',
  chia: null,
  coTangCa: false,
}

/** Lựa chọn trên form, theo đúng các kiểu đo được trong 4 sổ T9. */
export const LUA_CHON_CACH_PC: { ma: string; ten: string; v: CachPhuCapDong }[] = [
  { ma: 'chia26', ten: '÷ 26 × công', v: { cach: 'chia', chia: 26, coTangCa: false } },
  { ma: 'chia32', ten: '÷ 32 × công', v: { cach: 'chia', chia: 32, coTangCa: false } },
  { ma: 'chia', ten: '÷ công chuẩn × công', v: CACH_PC_MAC_DINH },
  { ma: 'nhan', ten: 'mức × công', v: { cach: 'nhan', chia: null, coTangCa: false } },
  {
    ma: 'nhanTc',
    ten: 'mức × (công + công TC)',
    v: { cach: 'nhan', chia: null, coTangCa: true },
  },
  {
    ma: 'co_dinh',
    ten: 'cố định cả tháng',
    v: { cach: 'co_dinh', chia: null, coTangCa: false },
  },
]

/** Cách tính → mã lựa chọn ("chia26"…); số chia lạ (vd 30) thì "chia:30". */
export function maCachPc(v: CachPhuCapDong | undefined): string {
  const c = v ?? CACH_PC_MAC_DINH
  const thay = LUA_CHON_CACH_PC.find(
    (o) => o.v.cach === c.cach && o.v.chia === c.chia && o.v.coTangCa === c.coTangCa,
  )
  return thay?.ma ?? `chia:${c.chia}`
}

export function cachPcTuMa(ma: string): CachPhuCapDong {
  const thay = LUA_CHON_CACH_PC.find((o) => o.ma === ma)
  if (thay) return thay.v
  const n = Number(ma.replace(/^chia:/, ''))
  return Number.isFinite(n) && n > 0
    ? { cach: 'chia', chia: n, coTangCa: false }
    : CACH_PC_MAC_DINH
}
