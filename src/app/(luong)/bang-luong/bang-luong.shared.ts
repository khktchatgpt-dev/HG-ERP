import type { BangLuongTrang } from '@/modules/dept/hr/luong/bang-luong.service'
import type { PhieuDong, TrangThaiLuong } from '@/modules/dept/hr/luong/bang-luong.repo'

export type { BangLuongTrang, PhieuDong, TrangThaiLuong }

export const MUC_BL = [
  'bang',
  'khoan',
  'khong-cham',
  'bh-thue',
  'chuyen-khoan',
  'dong-thoi-gian',
] as const
export type MucBl = (typeof MUC_BL)[number]

export const TEN_TT: Record<TrangThaiLuong, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  paid: 'Đã chi',
}

export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'
export const TF =
  'sticky bottom-0 bg-[var(--surface-raised)] border-t border-[var(--line)] px-2.5 py-1.5 whitespace-nowrap font-semibold'
export const R = { textAlign: 'right' as const }

export const kyVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`
export const so = (n: number, le = 0) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: le })
export const lucVn = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}
export function congKy(t: string, n: number): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
export const tong = (ds: PhieuDong[], f: (p: PhieuDong) => number) =>
  ds.reduce((s, p) => s + f(p), 0)
