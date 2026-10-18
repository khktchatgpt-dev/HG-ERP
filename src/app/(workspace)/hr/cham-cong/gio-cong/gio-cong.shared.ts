import type { GioCong } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import type { NgayGio, NguoiGio } from '@/lib/cham-cong/ky-gio-cong'

export type { GioCong, NgayGio, NguoiGio }

export const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const
export const thu = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Mọi ngày của kỳ, 'YYYY-MM-DD'. */
export function ngayKy(tu: string, den: string): string[] {
  const out: string[] = []
  for (
    let t = Date.parse(`${tu}T00:00:00Z`);
    t <= Date.parse(`${den}T00:00:00Z`);
    t += 864e5
  )
    out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/** Phút → giờ đủ (2 lẻ, kiểu VN) — dùng ở cột tổng, ngăn chi tiết. */
export const gio = (phut: number) =>
  (phut / 60).toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/**
 * Phút → giờ GỌN cho ô 24px: 480 → "8", 630 → "10½", 470 → "7,8".
 * Số đủ nằm ở gợi ý của ô + ngăn chi tiết (nguyên tắc 6: số in gọn phải tra được số đủ).
 */
export function gioGon(phut: number): string {
  const h = phut / 60
  if (Number.isInteger(h)) return String(h)
  if (Number.isInteger(h * 2)) return `${Math.floor(h)}½`
  return h.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

/** Phút từ 0h ngày bắt đầu ca → 'HH:mm', qua 0h ghi '(+1)'. */
export function hm(phut: number): string {
  const n = Math.floor(phut / 1440)
  const r = phut - n * 1440
  const s = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
  return n ? `${s}(+1)` : s
}

export const so = (n: number, le = 0) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: le })

/** Giờ hành chính của người (khung hành chính + làm trưa) và giờ sau giờ tan ca. */
export function tachGio(n: NguoiGio, khungHc = 'K1'): { hc: number; sau: number } {
  const hc = n.tong.k[khungHc] + n.tong.truaCong
  return { hc, sau: n.tong.tong - hc }
}

export type Nhom = { kieu: 'bp'; ten: string } | { kieu: 'vp' } | { kieu: 'all' }
