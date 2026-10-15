import type { BangCong, NguoiCong } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { KetQuaNgay } from '@/lib/cham-cong/tinh-cong'

export type { BangCong, NguoiCong, KetQuaNgay }

export const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Phút → giờ kiểu VN, 1 lẻ, bỏ ",0" (480 → "8", 450 → "7,5"). */
export function gio(phut: number): string {
  return (phut / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

export function so(n: number, le = 0): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: le })
}

export const thuCua = (b: BangCong, ngay: number) => (b.thuNgay1 + ngay - 1) % 7

/** 'YYYY-MM' → '09/2026'. */
export const thangVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`

export function doiThang(t: string, buoc: number): string {
  const [y, m] = t.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + buoc, 1))
  return d.toISOString().slice(0, 7)
}

export function ngayCuoiThang(t: string): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** Ô trong lưới: chữ ngắn + kiểu để tô. */
export function nhanO(k: KetQuaNgay): { chinh: string; tc: string } {
  if (k.kieu === 'thieu') return { chinh: '?', tc: '' }
  if (k.kieu === 'ngoai') return { chinh: '!', tc: '' }
  if (k.kieu === 'cn' || k.kieu === 'le')
    return { chinh: gio(k.gioCong + k.tangCa), tc: '' }
  return { chinh: gio(k.gioCong), tc: k.tangCa ? `+${gio(k.tangCa)}` : '' }
}

/** Ngày cần xử lý của một người (thiếu lượt + ngoài ca). */
export const canXuLy = (n: NguoiCong) => n.tong.thieu + n.tong.ngoai

/** 'YYYY-MM-DDTHH…Z' → 'dd/mm HH:mm' giờ VN, cho dòng "lấy lúc". */
export function luc(iso: string | null): string {
  if (!iso) return 'chưa lấy'
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}
