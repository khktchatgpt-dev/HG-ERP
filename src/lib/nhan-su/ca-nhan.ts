/**
 * Thông tin cá nhân nhân viên (0249 · Hồ sơ nhân viên B2b) — logic THUẦN: kiểm số CCCD / điện
 * thoại, nhãn, và cờ "có / chưa có" (không mang giá trị) để danh sách đếm hồ sơ thiếu mà không
 * phải gửi CCCD, địa chỉ xuống trình duyệt người không có quyền.
 */

export type GioiTinh = 'male' | 'female'
export const TEN_GIOI_TINH: Record<GioiTinh, string> = { male: 'Nam', female: 'Nữ' }

/** Gợi ý trình độ theo cột "trình độ chuyên môn kỹ thuật" của sổ quản lý lao động. */
export const TRINH_DO = [
  'Lao động phổ thông',
  'Sơ cấp nghề',
  'Trung cấp',
  'Cao đẳng',
  'Đại học',
  'Sau đại học',
] as const
export const QUAN_HE = [
  'Vợ',
  'Chồng',
  'Bố',
  'Mẹ',
  'Con',
  'Anh',
  'Chị',
  'Em',
  'Khác',
] as const

/** Giá trị đầy đủ — chỉ người có quyền hr.employee.private mới nhận. */
export type CaNhan = {
  ngaySinh: string | null
  gioiTinh: GioiTinh | null
  quocTich: string | null
  queQuan: string | null
  trinhDo: string | null
  /** Số CCCD đã che ("•••• 8123"); số thật chỉ trả khi bấm Hiện (ghi nhật ký). */
  cccdChe: string | null
  ngayCap: string | null
  noiCap: string | null
  thuongTru: string | null
  choO: string | null
  dienThoai: string | null
  khanCapTen: string | null
  khanCapQuanHe: string | null
  khanCapSdt: string | null
}

/** Cờ có / chưa có, đủ để đếm hồ sơ thiếu. */
export type CoRieng = {
  ngaySinh: boolean
  cccd: boolean
  diaChi: boolean
  dienThoai: boolean
  trinhDo: boolean
  khanCap: boolean
}
export const KHONG_CO_RIENG: CoRieng = {
  ngaySinh: false,
  cccd: false,
  diaChi: false,
  dienThoai: false,
  trinhDo: false,
  khanCap: false,
}

/** Chỉ giữ chữ số. CCCD 12 số, CMND cũ 9 số. Rỗng → null; sai → undefined. */
export function chuanCccd(s: string): string | null | undefined {
  const t = s.replace(/\D/g, '')
  if (!t) return null
  return t.length === 12 || t.length === 9 ? t : undefined
}

/** Số di động / bàn VN: 10–11 chữ số bắt đầu bằng 0; "+84 905…" → "0905…". */
export function chuanSdt(s: string): string | null | undefined {
  let t = s.replace(/[\s.()-]/g, '')
  if (!t) return null
  if (t.startsWith('+84')) t = '0' + t.slice(3)
  else if (t.startsWith('84') && t.length === 11) t = '0' + t.slice(2)
  return /^0\d{9,10}$/.test(t) ? t : undefined
}

/** "0905123456" → "0905 123 456". */
export function hienSdt(s: string | null): string {
  if (!s) return ''
  return s.length === 10 ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s
}

/** Che số định danh: chỉ chừa 4 số cuối. */
export function cheCccd(s: string | null): string | null {
  return s ? `•••• ${s.slice(-4)}` : null
}

/** Tuổi tròn năm tới hôm nay. */
export function tuoi(ngaySinh: string | null, homNay: string): number | null {
  if (!ngaySinh) return null
  const [y1, m1, d1] = ngaySinh.split('-').map(Number)
  const [y2, m2, d2] = homNay.split('-').map(Number)
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}
