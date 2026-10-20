/**
 * Hợp đồng lao động (0250 · Hồ sơ nhân viên B3) — logic THUẦN. Tình trạng suy từ ngày, không
 * lưu cột; danh sách và hồ sơ cùng gọi các hàm này nên chip "HĐ hết hạn 30 ngày" đếm đúng
 * bằng hàm trang hồ sơ dùng để tô vàng.
 */

export const LOAI_HD = ['probation', 'fixed', 'indefinite'] as const
export type LoaiHd = (typeof LOAI_HD)[number]
export const TEN_LOAI_HD: Record<LoaiHd, string> = {
  probation: 'Thử việc',
  fixed: 'Xác định thời hạn',
  indefinite: 'Không xác định thời hạn',
}

/** Báo trước bao nhiêu ngày (chip danh sách + tô vàng trên hồ sơ). */
export const SAP_HET_NGAY = 30

export type HdNgay = { tuNgay: string; denNgay: string | null; huy: boolean }

export type TinhTrangHd = 'huy' | 'chua_hieu_luc' | 'hieu_luc' | 'sap_het' | 'het_han'
export const TEN_TINH_TRANG_HD: Record<TinhTrangHd, string> = {
  huy: 'đã huỷ',
  chua_hieu_luc: 'chưa hiệu lực',
  hieu_luc: 'đang hiệu lực',
  sap_het: 'sắp hết hạn',
  het_han: 'hết hạn',
}

const congNgay = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** Số ngày từ `a` tới `b` (b − a). */
export function soNgay(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400_000)
}

export function tinhTrangHd(hd: HdNgay, homNay: string): TinhTrangHd {
  if (hd.huy) return 'huy'
  if (hd.tuNgay > homNay) return 'chua_hieu_luc'
  if (hd.denNgay && hd.denNgay < homNay) return 'het_han'
  if (hd.denNgay && hd.denNgay <= congNgay(homNay, SAP_HET_NGAY)) return 'sap_het'
  return 'hieu_luc'
}

/**
 * HĐ đang áp: còn hiệu lực hôm nay (bắt đầu muộn nhất); không có thì HĐ gần nhất chưa huỷ —
 * để nói "hết hạn từ …" thay vì "chưa có".
 */
export function hdHienHanh<T extends HdNgay>(ds: T[], homNay: string): T | null {
  const song = ds.filter((h) => !h.huy)
  const dangAp = song
    .filter((h) => {
      const t = tinhTrangHd(h, homNay)
      return t === 'hieu_luc' || t === 'sap_het'
    })
    .sort((a, b) => (a.tuNgay < b.tuNgay ? 1 : -1))
  if (dangAp[0]) return dangAp[0]
  return [...song].sort((a, b) => (a.tuNgay < b.tuNgay ? 1 : -1))[0] ?? null
}

/** Hai HĐ chưa huỷ chồng thời gian — HĐ không xác định thời hạn kéo tới vô cùng. */
export function chongNhau(a: HdNgay, b: HdNgay): boolean {
  const aDen = a.denNgay ?? '9999-12-31'
  const bDen = b.denNgay ?? '9999-12-31'
  return a.tuNgay <= bDen && b.tuNgay <= aDen
}

/**
 * Cảnh báo theo Bộ luật Lao động 2019 — chỉ NHẮC, không chặn (vị trí quản lý được thử việc
 * tới 180 ngày; Nhân sự biết người nào).
 */
export function canhBaoHd(v: {
  loai: LoaiHd
  tuNgay: string
  denNgay: string | null
}): string[] {
  const out: string[] = []
  if (!v.denNgay) return out
  const ngay = soNgay(v.tuNgay, v.denNgay) + 1
  if (v.loai === 'probation' && ngay > 60)
    out.push(
      `Thử việc ${ngay} ngày — luật cho tối đa 60 ngày (180 ngày với quản lý doanh nghiệp)`,
    )
  if (v.loai === 'fixed' && ngay > 36 * 31)
    out.push('HĐ xác định thời hạn quá 36 tháng — luật cho tối đa 36 tháng')
  return out
}
