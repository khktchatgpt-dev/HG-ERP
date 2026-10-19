/**
 * Hồ sơ nhân viên — logic THUẦN cho danh sách + trang hồ sơ (B2a, bản vẽ lượt 2 duyệt
 * 19/10/2026). Chip danh sách, "Còn thiếu" trên hồ sơ và thứ tự ‹ › đều đếm ở đây — một
 * nguồn, để con số ở hai màn không bao giờ lệch nhau.
 */
import { khongDau } from '@/lib/cham-cong/ghep-ten'
import type { CoRieng } from './ca-nhan'
import { tinhTrangHd, type HdNgay } from './hop-dong'

/** Phần của một dòng nhân viên mà các hàm dưới cần (khớp `NvDong` của Chấm công). */
export type NvTom = {
  code: string
  hoTen: string
  boPhan: string | null
  chucDanh: string | null
  ngayVao: string | null
  ngayCuoi: string | null
  active: boolean
  khongChamCong: boolean
  tenTuMay: boolean
  ma: unknown[]
  /** Cờ có / chưa có thông tin cá nhân (0249) — không mang giá trị. */
  coRieng: CoRieng
  /** HĐ đang áp (hoặc gần nhất chưa huỷ) — `hdHienHanh` ở service; null = chưa có HĐ nào. */
  hd: HdNgay | null
  /** Vắng ≥ 7 ngày có dữ liệu liên tiếp (`tinhVang`); null = không vắng / không áp. */
  vang: VangNv | null
}

/** Mã xếp theo số khi là số (5 < 31 < 105), mã chữ (KCC-…) sau. */
export function soSanhMa(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { numeric: true })
}

/** 'YYYY-MM-DD' → số tháng đủ tới hôm nay. */
function soThang(tu: string, homNay: string): number {
  const [y1, m1, d1] = tu.split('-').map(Number)
  const [y2, m2, d2] = homNay.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
}

/** Thâm niên đoạn làm hiện tại: "5 năm 7 th", "3 th", "12 ngày". */
export function thamNien(ngayVao: string | null, homNay: string): string | null {
  if (!ngayVao || ngayVao > homNay) return null
  const th = soThang(ngayVao, homNay)
  if (th < 1) {
    const ngay = Math.round((Date.parse(homNay) - Date.parse(ngayVao)) / 86400_000)
    return `${ngay} ngày`
  }
  const nam = Math.floor(th / 12)
  const du = th % 12
  return nam ? (du ? `${nam} năm ${du} th` : `${nam} năm`) : `${du} th`
}

export type MucThieu =
  | 'ho_ten'
  | 'to'
  | 'chuc_danh'
  | 'ngay_vao'
  | 'ma_may'
  | 'ngay_sinh'
  | 'cccd'
  | 'dia_chi'
  | 'dien_thoai'
  | 'trinh_do'
  | 'khan_cap'
  | 'hop_dong'
export const TEN_THIEU: Record<MucThieu, string> = {
  ho_ten: 'Họ tên đầy đủ (đang là tên máy)',
  to: 'Tổ',
  chuc_danh: 'Chức danh',
  ngay_vao: 'Ngày vào làm',
  ma_may: 'Mã trên máy chấm công',
  ngay_sinh: 'Ngày sinh · giới tính',
  cccd: 'CCCD · ngày cấp · nơi cấp',
  dia_chi: 'Địa chỉ thường trú',
  dien_thoai: 'Điện thoại',
  trinh_do: 'Trình độ',
  khan_cap: 'Liên hệ khẩn cấp',
  hop_dong: 'Hợp đồng lao động',
}

/** Mục nằm ở tab Cá nhân (còn lại ở khối Công việc / Chấm công). */
export const MUC_CA_NHAN: MucThieu[] = [
  'ngay_sinh',
  'cccd',
  'dia_chi',
  'dien_thoai',
  'trinh_do',
  'khan_cap',
]

/** Mục còn thiếu theo sổ quản lý lao động (12 mục, gồm hợp đồng — 0250). */
export function conThieu(n: NvTom): MucThieu[] {
  const out: MucThieu[] = []
  if (n.tenTuMay) out.push('ho_ten')
  if (!n.boPhan) out.push('to')
  if (!n.chucDanh) out.push('chuc_danh')
  if (!n.ngayVao) out.push('ngay_vao')
  if (!n.khongChamCong && n.ma.length === 0) out.push('ma_may')
  const r = n.coRieng
  if (!r.ngaySinh) out.push('ngay_sinh')
  if (!r.cccd) out.push('cccd')
  if (!r.diaChi) out.push('dia_chi')
  if (!r.dienThoai) out.push('dien_thoai')
  if (!r.trinhDo) out.push('trinh_do')
  if (!r.khanCap) out.push('khan_cap')
  if (!n.hd) out.push('hop_dong')
  return out
}
export const SO_MUC_HO_SO = Object.keys(TEN_THIEU).length

const congNgay = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** Vắng (bản vẽ màu sắc 19/10/2026, Q5): bao nhiêu ngày CÓ DỮ LIỆU liên tiếp không quẹt. */
export type VangNv = { ngay: number; quetCuoi: string | null }
/** Ngưỡng "vắng" — đếm ngày cả công ty có lượt, không đếm ngày lịch (ngày chưa lấy về ≠ vắng). */
export const VANG_TU = 7

/**
 * `ngayCoDuLieu`: các ngày (giờ VN, tăng dần, ≤ hôm nay) cả công ty có ít nhất một lượt.
 * Đếm những ngày đó SAU lần quẹt cuối và từ ngày vào làm — đủ `VANG_TU` thì là vắng.
 * `quetCuoi` null = không quẹt trong cả khung đã đọc.
 */
export function tinhVang(
  ngayCoDuLieu: string[],
  quetCuoi: string | null,
  ngayVao: string | null,
): VangNv | null {
  const n = ngayCoDuLieu.filter(
    (d) => (!quetCuoi || d > quetCuoi) && (!ngayVao || d >= ngayVao),
  ).length
  return n >= VANG_TU ? { ngay: n, quetCuoi } : null
}

/** Khối — chỉ để tô ô chữ cái (Q2), KHÔNG mang nghĩa vòng đời. */
export type KhoiNv = 'van_phong' | 'xuong' | 'phuc_vu'
export const TEN_KHOI: Record<KhoiNv, string> = {
  van_phong: 'Văn phòng',
  xuong: 'Xưởng',
  phuc_vu: 'Phục vụ & khoán',
}
export function khoiCua(boPhan: string | null): KhoiNv | null {
  if (!boPhan) return null
  const t = khongDau(boPhan)
  if (/^PHONG\b/.test(t) || t === 'THONG KE') return 'van_phong'
  if (/^(KHOAN|BAO VE|TAI XE|TAP VU)\b/.test(t)) return 'phuc_vu'
  return 'xuong'
}

/** Chip lọc, hai nhóm (Q3): "Xem" là tập người, "Cần xử lý" là việc của Nhân sự. */
export const LOC_NV = [
  { id: 'dang_lam', ten: 'Đang làm', nhom: 'xem' },
  { id: 'moi_vao', ten: 'Mới vào 30 ngày', nhom: 'xem' },
  { id: 'khong_cham', ten: 'Không chấm công', nhom: 'xem' },
  { id: 'da_nghi', ten: 'Đã nghỉ', nhom: 'xem' },
  { id: 'ten_may', ten: 'Tên máy', nhom: 'xu_ly' },
  { id: 'chua_to', ten: 'Chưa có tổ', nhom: 'xu_ly' },
  { id: 'vang', ten: `Vắng ≥ ${VANG_TU} ngày`, nhom: 'xu_ly' },
  { id: 'hd', ten: 'HĐ sắp / đã hết hạn', nhom: 'xu_ly' },
  { id: 'sap_nghi', ten: 'Sắp nghỉ', nhom: 'xu_ly' },
] as const
export type LocNv = (typeof LOC_NV)[number]['id']

export function thuocLoc(n: NvTom, loc: LocNv, homNay: string): boolean {
  switch (loc) {
    case 'dang_lam':
      return n.active
    case 'moi_vao':
      return n.active && !!n.ngayVao && n.ngayVao > congNgay(homNay, -30)
    case 'khong_cham':
      return n.active && n.khongChamCong
    case 'da_nghi':
      return !n.active
    case 'ten_may':
      return n.active && n.tenTuMay
    case 'chua_to':
      return n.active && !n.boPhan
    case 'vang':
      return n.active && !!n.vang
    case 'hd':
      return (
        n.active && !!n.hd && ['sap_het', 'het_han'].includes(tinhTrangHd(n.hd, homNay))
      )
    case 'sap_nghi':
      return n.active && !!n.ngayCuoi && n.ngayCuoi >= homNay
  }
}

export function demLocNv(ds: NvTom[], homNay: string): Record<LocNv, number> {
  return Object.fromEntries(
    LOC_NV.map((l) => [l.id, ds.filter((n) => thuocLoc(n, l.id, homNay)).length]),
  ) as Record<LocNv, number>
}

/** Một nhãn tình trạng cho ô bảng — thứ tự ưu tiên: nghỉ › sắp nghỉ › chưa vào › vắng › mới. */
export type NhanTinhTrang =
  | { kieu: 'da_nghi'; ngay: string | null }
  | { kieu: 'sap_nghi'; ngay: string }
  | { kieu: 'chua_vao'; ngay: string }
  | { kieu: 'vang'; ngay: number; quetCuoi: string | null }
  | { kieu: 'moi'; ngay: number }
  | { kieu: 'dang_lam' }
export function nhanTinhTrang(n: NvTom, homNay: string): NhanTinhTrang {
  if (!n.active || (n.ngayCuoi && n.ngayCuoi < homNay))
    return { kieu: 'da_nghi', ngay: n.ngayCuoi }
  if (n.ngayCuoi) return { kieu: 'sap_nghi', ngay: n.ngayCuoi }
  if (n.ngayVao && n.ngayVao > homNay) return { kieu: 'chua_vao', ngay: n.ngayVao }
  if (n.vang) return { kieu: 'vang', ...n.vang }
  if (n.ngayVao && n.ngayVao > congNgay(homNay, -30))
    return {
      kieu: 'moi',
      ngay: Math.round((Date.parse(homNay) - Date.parse(n.ngayVao)) / 86400_000),
    }
  return { kieu: 'dang_lam' }
}

/** Tìm không dấu theo mã, họ tên, tổ, chức danh. */
export function khopTimNv(n: NvTom, q: string): boolean {
  const k = khongDau(q)
  if (!k) return true
  return khongDau(`${n.code} ${n.hoTen} ${n.boPhan ?? ''} ${n.chucDanh ?? ''}`).includes(
    k,
  )
}

/** Chữ cái đầu cho ô ảnh: hai chữ đầu của tên cuối + họ ("Phan Đình Hậu" → "PH"). */
export function chuDau(hoTen: string): string {
  const w = hoTen.trim().split(/\s+/).filter(Boolean)
  if (!w.length) return '?'
  const a = w[0][0]
  const b = w.length > 1 ? w[w.length - 1][0] : (w[0][1] ?? '')
  return (a + b).toUpperCase()
}
