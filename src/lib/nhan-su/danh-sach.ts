/**
 * Danh sách hồ sơ nhân viên (bản vẽ 02/11/2026 https://claude.ai/artifact/FUBArSLUXK9mVu2FSbsS93,
 * Q1–Q7 duyệt theo đề xuất) — logic THUẦN: tab, ô việc tồn, "Ô trống" theo cột, tìm theo SĐT /
 * 4 số cuối CCCD, nhóm theo bộ phận. Ô đếm, chân đếm trống và lưới cùng gọi các hàm ở đây —
 * số trên ô là số dòng bấm vào sẽ thấy.
 */
import type { GioiTinh } from './ca-nhan'
import { khopTimNv, soSanhMa, thuocLoc, type NvTom } from './ho-so'

/**
 * Giá trị cá nhân cho lưới — chỉ người có quyền hr.employee.private nhận. Số CCCD / MST
 * chỉ gửi 4 số cuối (đủ để bày "•••• 1234" và tìm), số đầy đủ vẫn chỉ ra khi bấm Hiện.
 */
export type RiengDs = {
  gioiTinh: GioiTinh | null
  ngaySinh: string | null
  cccd4: string | null
  ngayCap: string | null
  noiCap: string | null
  mst4: string | null
  dienThoai: string | null
  choO: string | null
  thuongTru: string | null
  /** "Tên (quan hệ)" — số khẩn cấp đi riêng. */
  khanCap: string | null
  khanCapSdt: string | null
}

export type NvDsTom = NvTom & { id: string; ghiChu: string | null; rieng: RiengDs | null }

export const TAB_DS = [
  { id: 'dang_lam', ten: 'Đang làm' },
  { id: 'da_nghi', ten: 'Đã nghỉ' },
  { id: 'tat_ca', ten: 'Tất cả' },
] as const
export type TabDs = (typeof TAB_DS)[number]['id']

export function thuocTab(n: NvTom, t: TabDs): boolean {
  return t === 'tat_ca' ? true : t === 'dang_lam' ? n.active : !n.active
}

/** Ô đếm việc tồn của Nhân sự. `w` = ô có số > 0 là việc phải làm (chữ cam). */
export const VIEC_DS = [
  { id: 'ten_may', ten: 'Tên máy (hồ sơ tạm)', w: true },
  { id: 'chua_to', ten: 'Chưa có bộ phận', w: true },
  { id: 'chua_chuc_vu', ten: 'Chưa có chức vụ', w: true },
  { id: 'chua_ngay_vao', ten: 'Chưa có ngày vào', w: true },
  { id: 'vang', ten: 'Vắng ≥ 7 ngày', w: true },
  { id: 'moi_vao', ten: 'Mới vào 30 ngày', w: false },
  { id: 'sap_nghi', ten: 'Sắp nghỉ', w: false },
] as const
export type ViecDs = (typeof VIEC_DS)[number]['id']

export function thuocViec(n: NvTom, v: ViecDs, homNay: string): boolean {
  switch (v) {
    case 'chua_chuc_vu':
      return n.active && !n.chucDanh
    case 'chua_ngay_vao':
      return n.active && !n.ngayVao
    default:
      return thuocLoc(n, v, homNay)
  }
}

/** Cột có thể lọc "Ô trống". `rieng` = cột cá nhân, chỉ có khi người xem có quyền. */
export const COT_TRONG = {
  bo_phan: { ten: 'Bộ phận', rieng: false },
  chuc_vu: { ten: 'Chức vụ', rieng: false },
  ngay_vao: { ten: 'Ngày vào', rieng: false },
  gioi_tinh: { ten: 'Giới tính', rieng: true },
  ngay_sinh: { ten: 'Ngày sinh', rieng: true },
  cccd: { ten: 'Số CCCD', rieng: true },
  ngay_cap: { ten: 'Ngày cấp CCCD', rieng: true },
  noi_cap: { ten: 'Nơi cấp CCCD', rieng: true },
  mst: { ten: 'Mã số thuế', rieng: true },
  dien_thoai: { ten: 'Điện thoại', rieng: true },
  cho_o: { ten: 'Nơi ở hiện tại', rieng: true },
  thuong_tru: { ten: 'Thường trú', rieng: true },
  khan_cap: { ten: 'Liên hệ khẩn cấp', rieng: true },
} as const
export type CotTrong = keyof typeof COT_TRONG

/** Ô của người này đang trống? Cột cá nhân khi không có quyền xem → không tính là trống. */
export function laTrong(n: NvDsTom, c: CotTrong): boolean {
  switch (c) {
    case 'bo_phan':
      return !n.boPhan
    case 'chuc_vu':
      return !n.chucDanh
    case 'ngay_vao':
      return !n.ngayVao
  }
  const r = n.rieng
  if (!r) return false
  switch (c) {
    case 'gioi_tinh':
      return !r.gioiTinh
    case 'ngay_sinh':
      return !r.ngaySinh
    case 'cccd':
      return !r.cccd4
    case 'ngay_cap':
      return !r.ngayCap
    case 'noi_cap':
      return !r.noiCap
    case 'mst':
      return !r.mst4
    case 'dien_thoai':
      return !r.dienThoai
    case 'cho_o':
      return !r.choO
    case 'thuong_tru':
      return !r.thuongTru
    case 'khan_cap':
      return !r.khanCap
  }
}

export const demTrong = (ds: NvDsTom[], c: CotTrong) =>
  ds.filter((n) => laTrong(n, c)).length

/**
 * Tìm: mã, họ tên, bộ phận, chức vụ (không dấu) — cộng SĐT (gõ từ 3 số) và đúng 4 số cuối
 * CCCD. Ô tìm chỉ toàn số mới xét SĐT / CCCD, để "Hoa" không khớp nhầm vào số nào.
 */
export function khopTimDs(n: NvDsTom, q: string): boolean {
  if (khopTimNv(n, q)) return true
  const t = q.replace(/[\s.()-]/g, '')
  if (!/^\d{3,}$/.test(t) || !n.rieng) return false
  if (n.rieng.dienThoai?.includes(t)) return true
  return t.length === 4 && n.rieng.cccd4 === t
}

export type BoLocDs = {
  tab: TabDs
  viec: ViecDs | null
  tim: string
  /** '' = mọi bộ phận; '__trong' = chưa có bộ phận. */
  to: string
  trong: CotTrong | null
}

/**
 * Tập mà ô đếm việc tồn đếm trên: tab + bộ phận + ô tìm (không tính chính ô việc và Ô trống).
 * Bấm ô → `locDs` thêm điều kiện ô đó → đúng số đã hiện.
 */
export function phamViDs<T extends NvDsTom>(
  ds: T[],
  l: Omit<BoLocDs, 'viec' | 'trong'>,
): T[] {
  return ds.filter(
    (n) =>
      thuocTab(n, l.tab) &&
      khopTimDs(n, l.tim) &&
      (!l.to || (l.to === '__trong' ? !n.boPhan : n.boPhan === l.to)),
  )
}

export function demViec(pham: NvDsTom[], homNay: string): Record<ViecDs, number> {
  return Object.fromEntries(
    VIEC_DS.map((v) => [v.id, pham.filter((n) => thuocViec(n, v.id, homNay)).length]),
  ) as Record<ViecDs, number>
}

export function locDs<T extends NvDsTom>(ds: T[], l: BoLocDs, homNay: string): T[] {
  return phamViDs(ds, l).filter(
    (n) => (!l.viec || thuocViec(n, l.viec, homNay)) && (!l.trong || laTrong(n, l.trong)),
  )
}

export type NhomDs<T extends NvDsTom = NvDsTom> = { boPhan: string | null; ds: T[] }

/**
 * Nhóm theo bộ phận (Q1, như file DS CNV): nhóm "chưa có bộ phận" đứng đầu vì đó là việc
 * phải làm, các nhóm khác theo tên; trong nhóm theo mã (5 < 31 < 105, KCC-… sau).
 */
export function nhomBoPhan<T extends NvDsTom>(ds: T[]): NhomDs<T>[] {
  const m = new Map<string | null, T[]>()
  for (const n of ds) m.set(n.boPhan, [...(m.get(n.boPhan) ?? []), n])
  return [...m.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b, 'vi')))
    .map(([boPhan, xs]) => ({ boPhan, ds: xs.sort((a, b) => soSanhMa(a.code, b.code)) }))
}

/** Thứ tự dòng đúng như lưới đang bày — để ‹ › ở trang hồ sơ đi cùng thứ tự. */
export function thuTuDs<T extends NvDsTom>(ds: T[], nhom: boolean): T[] {
  return nhom
    ? nhomBoPhan(ds).flatMap((g) => g.ds)
    : [...ds].sort((a, b) => soSanhMa(a.code, b.code))
}
