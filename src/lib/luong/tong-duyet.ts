/**
 * TỔNG LƯƠNG CHO SẾP DUYỆT (bản vẽ duyệt 21/10/2026, Q3–Q4 theo đề xuất). Sếp KHÔNG thấy
 * lương từng người (Q9 của 20/10) — chỉ tổng theo tổ, gom dưới 4 khối như 4 sổ Kế toán.
 * Hàm thuần: nhận phiếu (chỉ cần tổ + tiền), trả bảng tổng; không có tên người nào lọt ra.
 */

export type KhoiLuong = 'ttsx' | 'gtsx' | 'vp' | 'qc'

export const TEN_KHOI: Record<KhoiLuong | 'khac', string> = {
  ttsx: 'Trực tiếp sản xuất',
  gtsx: 'Gián tiếp sản xuất',
  vp: 'Văn phòng',
  qc: 'QC',
  khac: 'Chưa xếp khối',
}
const THU_TU: (KhoiLuong | 'khac')[] = ['ttsx', 'gtsx', 'vp', 'qc', 'khac']

/** Tổ chênh quá mức này so với kỳ trước thì tô cảnh báo (Q4). */
export const NGUONG_CHENH = 0.15

export type PhieuTong = { to: string | null; tong: number; thucLinh: number }

export type DongTong = {
  ten: string
  nguoi: number
  /** Tổng thu nhập (trước BH, đoàn phí, khoản trừ). */
  tong: number
  /** Tổng − thực lĩnh: BH NLĐ + đoàn phí + thuế (nếu trừ) + tạm ứng / khoản trừ. */
  tru: number
  thucLinh: number
  /** Thực lĩnh kỳ trước; null = kỳ trước không có bảng trong ERP. */
  truoc: number | null
  /** (thực lĩnh − kỳ trước) ÷ kỳ trước; null khi không so được. */
  chenh: number | null
  /** |chênh| > NGUONG_CHENH. */
  canhBao: boolean
}

export type KhoiTong = DongTong & { khoi: KhoiLuong | 'khac'; to: DongTong[] }

function dong(ten: string, ps: PhieuTong[], truoc: number | null): DongTong {
  const tong = ps.reduce((s, p) => s + p.tong, 0)
  const thucLinh = ps.reduce((s, p) => s + p.thucLinh, 0)
  const chenh = truoc ? (thucLinh - truoc) / truoc : null
  return {
    ten,
    nguoi: ps.length,
    tong,
    tru: tong - thucLinh,
    thucLinh,
    truoc,
    chenh,
    canhBao: chenh != null && Math.abs(chenh) > NGUONG_CHENH,
  }
}

const TEN_TRONG = '(chưa có tổ)'

/**
 * Gom phiếu kỳ này theo khối → tổ. `kyTruoc` = phiếu kỳ trước (null = không có bảng kỳ trước
 * trong ERP → cột so sánh trống, không tô gì).
 */
export function tongTheoKhoi(
  phieu: PhieuTong[],
  khoiCuaTo: Map<string, KhoiLuong | null>,
  kyTruoc: PhieuTong[] | null,
): { khoi: KhoiTong[]; cong: DongTong } {
  const truocTo = new Map<string, number>()
  for (const p of kyTruoc ?? [])
    truocTo.set(p.to ?? TEN_TRONG, (truocTo.get(p.to ?? TEN_TRONG) ?? 0) + p.thucLinh)
  const theoKhoi = new Map<KhoiLuong | 'khac', Map<string, PhieuTong[]>>()
  for (const p of phieu) {
    const ten = p.to ?? TEN_TRONG
    const k = (p.to && khoiCuaTo.get(p.to)) || 'khac'
    const m = theoKhoi.get(k) ?? new Map<string, PhieuTong[]>()
    m.set(ten, [...(m.get(ten) ?? []), p])
    theoKhoi.set(k, m)
  }
  const khoi: KhoiTong[] = []
  for (const k of THU_TU) {
    const m = theoKhoi.get(k)
    if (!m) continue
    const to = [...m]
      .map(([ten, ps]) => dong(ten, ps, kyTruoc ? (truocTo.get(ten) ?? null) : null))
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
    const truocKhoi = kyTruoc
      ? to.reduce<number | null>(
          (s, t) => (t.truoc == null ? s : (s ?? 0) + t.truoc),
          null,
        )
      : null
    khoi.push({ ...dong(TEN_KHOI[k], [...m.values()].flat(), truocKhoi), khoi: k, to })
  }
  const truocCong = kyTruoc ? kyTruoc.reduce((s, p) => s + p.thucLinh, 0) : null
  return { khoi, cong: dong('Cộng', phieu, truocCong || null) }
}
