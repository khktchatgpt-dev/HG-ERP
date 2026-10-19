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

export const LOC_NV = [
  { id: 'dang_lam', ten: 'Đang làm' },
  { id: 'thieu', ten: 'Hồ sơ thiếu', bao: true },
  { id: 'chua_to', ten: 'Chưa có tổ', bao: true },
  { id: 'hd_sap_het', ten: 'HĐ hết hạn 30 ngày', bao: true },
  { id: 'hd_qua_han', ten: 'HĐ đã hết hạn', bao: true },
  { id: 'moi_vao', ten: 'Mới vào 30 ngày' },
  { id: 'co_ngay_nghi', ten: 'Có ngày nghỉ' },
  { id: 'khong_cham', ten: 'Không chấm công' },
  { id: 'da_nghi', ten: 'Đã nghỉ' },
] as const
export type LocNv = (typeof LOC_NV)[number]['id']

export function thuocLoc(n: NvTom, loc: LocNv, homNay: string): boolean {
  switch (loc) {
    case 'dang_lam':
      return n.active
    case 'thieu':
      return n.active && conThieu(n).length > 0
    case 'chua_to':
      return n.active && !n.boPhan
    case 'hd_sap_het':
      return n.active && !!n.hd && tinhTrangHd(n.hd, homNay) === 'sap_het'
    case 'hd_qua_han':
      return n.active && !!n.hd && tinhTrangHd(n.hd, homNay) === 'het_han'
    case 'moi_vao':
      return n.active && !!n.ngayVao && n.ngayVao > congNgay(homNay, -30)
    case 'co_ngay_nghi':
      return n.active && !!n.ngayCuoi
    case 'khong_cham':
      return n.active && n.khongChamCong
    case 'da_nghi':
      return !n.active
  }
}

export function demLocNv(ds: NvTom[], homNay: string): Record<LocNv, number> {
  return Object.fromEntries(
    LOC_NV.map((l) => [l.id, ds.filter((n) => thuocLoc(n, l.id, homNay)).length]),
  ) as Record<LocNv, number>
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
