/**
 * Biến động nhân sự (0248 · Hồ sơ nhân viên B1, bản vẽ duyệt 19/10/2026) — logic THUẦN.
 * Ngày là chuỗi 'YYYY-MM-DD' (giờ VN), so sánh chuỗi là so ngày.
 */

export const LY_DO_NGHI = [
  'resign',
  'contract_end',
  'terminated',
  'dismissed',
  'retired',
  'other',
] as const
export type LyDoNghi = (typeof LY_DO_NGHI)[number]

export const TEN_LY_DO_NGHI: Record<LyDoNghi, string> = {
  resign: 'Tự xin nghỉ',
  contract_end: 'Hết hạn hợp đồng',
  terminated: 'Công ty chấm dứt',
  dismissed: 'Kỷ luật sa thải',
  retired: 'Nghỉ hưu',
  other: 'Khác',
}

/** `edit` (0249): lần sửa tại chỗ một khối hồ sơ — chỉ ghi TÊN ô đổi, không ghi giá trị. */
export type LoaiBienDong = 'hire' | 'leave' | 'rehire' | 'transfer' | 'edit'
export const TEN_BIEN_DONG: Record<LoaiBienDong, string> = {
  hire: 'Tuyển vào',
  leave: 'Nghỉ việc',
  rehire: 'Đi làm lại',
  transfer: 'Chuyển tổ / chức danh',
  edit: 'Sửa hồ sơ',
}

export type DoanLam = { hireDate: string | null; leaveDate: string | null }

/**
 * Phần của kỳ [tu, den] mà người này còn làm: từ ngày vào (nếu vào giữa kỳ) tới ngày làm
 * cuối (nếu nghỉ giữa kỳ). `null` = không làm ngày nào trong kỳ. Không có ngày vào thì coi
 * như đã làm từ trước kỳ (152 người cũ chưa ai có ngày vào — Q1).
 */
export function khoangTrongKy(
  e: DoanLam,
  tu: string,
  den: string,
): { tu: string; den: string } | null {
  const a = e.hireDate && e.hireDate > tu ? e.hireDate : tu
  const b = e.leaveDate && e.leaveDate < den ? e.leaveDate : den
  return a <= b ? { tu: a, den: b } : null
}

export type TinhTrangLam = 'dang_lam' | 'sap_nghi' | 'da_nghi' | 'chua_vao'

/** Tình trạng suy ra từ ngày, không từ cờ gõ tay. */
export function tinhTrangLam(e: DoanLam, homNay: string): TinhTrangLam {
  if (e.leaveDate && e.leaveDate < homNay) return 'da_nghi'
  if (e.hireDate && e.hireDate > homNay) return 'chua_vao'
  if (e.leaveDate) return 'sap_nghi'
  return 'dang_lam'
}

/** Mã cho người không quẹt máy (Q3): số tiếp theo của dãy KCC-NNN đang có. */
export function maKccTiep(codes: string[]): string {
  let max = 0
  for (const c of codes) {
    const m = /^KCC-(\d+)$/i.exec(c.trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `KCC-${String(max + 1).padStart(3, '0')}`
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy'. */
export const ngayVn = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—'

/** Ngày kế tiếp của 'YYYY-MM-DD'. */
export function ngaySau(d: string): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}
