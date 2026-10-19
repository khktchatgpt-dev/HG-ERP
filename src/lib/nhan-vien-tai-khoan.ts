/**
 * Nhân viên là gốc, tài khoản ERP gắn vào (0247 · bản vẽ duyệt 19/10/2026).
 *
 * Logic THUẦN cho màn Admin › Nhân viên & tài khoản: ghép hai danh sách thành một
 * bảng, đếm chip lọc, gợi ý gắn theo họ tên. Không chạm DB — client dùng được.
 */
import { khongDau, khopTen } from '@/lib/luong/ho-so-luong'

export type NvGoc = {
  id: string
  ma: string
  ten: string
  to: string | null
  toId: string | null
  dangLam: boolean
  khongCham: boolean
}

export type TkGoc = {
  id: string
  email: string
  ten: string | null
  role: string
  phongId: string | null
  title: string | null
  dangMo: boolean
  xoaLuc: string | null
  nvId: string | null
  dungChung: boolean
  nguoiCam: string | null
  dangNhap: string | null
  doiMk: boolean
}

export type DongNvTk =
  | { kieu: 'nv'; nv: NvGoc; tk: TkGoc | null }
  | { kieu: 'chua_gan'; tk: TkGoc }
  | { kieu: 'dung_chung'; tk: TkGoc }

/** Tài khoản đang dùng được: chưa xoá, chưa khoá. */
export const tkSong = (tk: TkGoc) => tk.dangMo && !tk.xoaLuc

/**
 * Một dòng mỗi nhân viên (kèm tài khoản nếu có), rồi các tài khoản cá nhân chưa gắn
 * người, rồi tài khoản dùng chung. Tài khoản trỏ tới nhân viên không còn trong danh
 * sách được coi là chưa gắn — không để rơi mất.
 */
export function ghepDong(nvs: NvGoc[], tks: TkGoc[]): DongNvTk[] {
  const theoNv = new Map<string, TkGoc>()
  for (const tk of tks) if (tk.nvId && !tk.dungChung) theoNv.set(tk.nvId, tk)
  const coNv = new Set(nvs.map((n) => n.id))
  const dongNv: DongNvTk[] = [...nvs]
    .sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }))
    .map((nv) => ({ kieu: 'nv', nv, tk: theoNv.get(nv.id) ?? null }))
  const theoTen = (a: TkGoc, b: TkGoc) =>
    (a.ten ?? a.email).localeCompare(b.ten ?? b.email, 'vi')
  const chuaGan: DongNvTk[] = tks
    .filter((t) => !t.dungChung && !(t.nvId && coNv.has(t.nvId)))
    .sort(theoTen)
    .map((tk) => ({ kieu: 'chua_gan', tk }))
  const dungChung: DongNvTk[] = tks
    .filter((t) => t.dungChung)
    .sort(theoTen)
    .map((tk) => ({ kieu: 'dung_chung', tk }))
  return [...dongNv, ...chuaGan, ...dungChung]
}

export const LOC = [
  'tat_ca',
  'co_tk',
  'chua_co',
  'chua_gan',
  'dung_chung',
  'nghi_con_tk',
] as const
export type Loc = (typeof LOC)[number]

export const TEN_LOC: Record<Loc, string> = {
  tat_ca: 'Tất cả',
  co_tk: 'Có tài khoản',
  chua_co: 'Chưa có tài khoản',
  chua_gan: 'Tài khoản chưa gắn người',
  dung_chung: 'Dùng chung',
  nghi_con_tk: 'Đã nghỉ việc còn tài khoản',
}

/** Người đã nghỉ việc mà tài khoản vẫn mở — trigger 0247 lẽ ra đã khoá; còn thì là lỗi. */
const nghiConTk = (d: DongNvTk) =>
  d.kieu === 'nv' && !d.nv.dangLam && !!d.tk && tkSong(d.tk)

/**
 * Dòng có hiện khi KHÔNG bật "Hiện đã nghỉ & đã xoá" hay không: ẩn nhân viên đã nghỉ
 * và tài khoản không gắn người mà đã khoá/xoá. Riêng "đã nghỉ còn tài khoản" luôn hiện
 * — đó là thứ cần xử lý.
 */
export function hienMacDinh(d: DongNvTk): boolean {
  if (d.kieu === 'nv') return d.nv.dangLam || nghiConTk(d)
  return tkSong(d.tk)
}

export function thuocLoc(d: DongNvTk, loc: Loc): boolean {
  switch (loc) {
    case 'tat_ca':
      return true
    case 'co_tk':
      return d.kieu === 'nv' && !!d.tk && !d.tk.xoaLuc
    case 'chua_co':
      return d.kieu === 'nv' && (!d.tk || !!d.tk.xoaLuc)
    case 'chua_gan':
      return d.kieu === 'chua_gan'
    case 'dung_chung':
      return d.kieu === 'dung_chung'
    case 'nghi_con_tk':
      return nghiConTk(d)
  }
}

/** Đếm chip bằng ĐÚNG hàm lọc bảng dùng — con số là một lời hứa. */
export function demLoc(dong: DongNvTk[], hienHet: boolean): Record<Loc, number> {
  const thay = hienHet ? dong : dong.filter(hienMacDinh)
  return Object.fromEntries(
    LOC.map((l) => [l, thay.filter((d) => thuocLoc(d, l)).length]),
  ) as Record<Loc, number>
}

export function khopTim(d: DongNvTk, q: string): boolean {
  const k = khongDau(q)
  if (!k) return true
  const tk = d.tk
  const chu = [
    d.kieu === 'nv' ? `${d.nv.ma} ${d.nv.ten} ${d.nv.to ?? ''}` : '',
    tk ? `${tk.ten ?? ''} ${tk.email} ${tk.nguoiCam ?? ''}` : '',
  ].join(' ')
  return khongDau(chu).includes(k)
}

/** Tên tài khoản kiểu "Thống kê Tổ …", "Quản trị viên" — gợi ý đánh dấu dùng chung. */
export function tenDungChung(ten: string | null): boolean {
  const k = khongDau(ten ?? '')
  return /^(thong ke|quan tri)\b/.test(k)
}

export type GoiYGan = { tk: TkGoc; nv: NvGoc }

/**
 * Tài khoản cá nhân đang mở, chưa gắn, mà họ tên khớp ĐÚNG MỘT nhân viên đang làm chưa
 * có tài khoản. Nhiều người trùng tên thì không gợi ý — để người chọn tay.
 */
export function goiYGan(nvs: NvGoc[], tks: TkGoc[]): GoiYGan[] {
  const daCo = new Set(tks.filter((t) => t.nvId && !t.xoaLuc).map((t) => t.nvId))
  const ungVien = nvs.filter((n) => n.dangLam && !daCo.has(n.id))
  const ds = ungVien.map((n) => ({ id: n.id, ma: n.ma, ten: n.ten, to: n.to }))
  const out: GoiYGan[] = []
  const dung = new Set<string>()
  for (const tk of tks) {
    if (tk.nvId || tk.dungChung || !tkSong(tk) || !tk.ten || tenDungChung(tk.ten))
      continue
    const kq = khopTen(tk.ten, null, ds)
    if (kq.kieu !== 'khop' || dung.has(kq.nguoi.id)) continue
    dung.add(kq.nguoi.id)
    out.push({ tk, nv: ungVien.find((n) => n.id === kq.nguoi.id)! })
  }
  return out
}
