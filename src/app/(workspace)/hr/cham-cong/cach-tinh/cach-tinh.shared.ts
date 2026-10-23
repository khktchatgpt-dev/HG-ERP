import type { CachTinhTrang } from '@/modules/dept/hr/cham-cong/cach-tinh.service'
import type { HeSoDong } from '@/modules/dept/hr/cham-cong/cach-tinh.repo'

export type { CachTinhTrang, HeSoDong }

export const MUC = ['he-so', 'quy-tac', 'theo-to', 'lich-su'] as const
export type Muc = (typeof MUC)[number]

/** 'YYYY-MM' → '10/2026'. */
export const kyVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`

export function congKy(t: string, n: number): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** Phút từ 0h ngày bắt đầu → 'HH:MM' (qua 0h vẫn ghi giờ trong ngày; nhãn (+1) do màn ghi). */
export function hhmm(phut: number): string {
  const m = ((phut % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 'H:MM' / 'HH:MM' → phút trong ngày; sai dạng → null. */
export function docGio(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})[:h.](\d{2})$/)
  if (!m) return null
  const g = Number(m[1])
  const p = Number(m[2])
  if (g > 24 || p > 59 || (g === 24 && p > 0)) return null
  return g * 60 + p
}

/** Số % kiểu VN ("150", "150,5") → số; rỗng → null; sai → undefined. */
export function docPt(s: string): number | null | undefined {
  const t = s.trim().replace('%', '').trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : undefined
}

/** 4 số lẻ: hệ số KT 133,3333 % — làm tròn 2 số lẻ rồi lưu lại là lệch ~90 đ/người/kỳ (0254). */
export const ptVn = (n: number | null) =>
  n == null ? '' : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/** 'ISO' → 'dd/mm HH:mm' giờ VN. */
export function lucVn(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`
}

export const khoaHeSo = (h: Pick<HeSoDong, 'loai' | 'ma' | 'ngay'>) =>
  `${h.loai}|${h.ma}|${h.ngay}`
