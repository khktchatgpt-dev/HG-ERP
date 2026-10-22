/**
 * CÔNG NHẬP TAY — khối A của màn Kỳ công (bản vẽ duyệt 22/10/2026, PYQ1Dw2W…, Q1–Q6 theo đề xuất).
 *
 * Người "không chấm công" không có lượt máy; trước đây ERP tự cho đủ công chuẩn nên lệch sổ
 * lương T9 (sổ ghi công thật 26–32, có người kèm tăng ca). Nay Nhân sự nhập số công + giờ tăng
 * ca mỗi kỳ; ô trống chặn chốt kỳ. Hàm thuần — client kiểm tại chỗ, server kiểm lại.
 *
 * Tăng ca nhập bằng GIỜ (Q4), lương tính ở khung tăng ca đầu tiên (16h–19h, hệ số của bản cách tính).
 */

/** Đọc số kiểu Việt Nam: "27,5" = 27.5; trống = null; chữ lạ = NaN. */
export function docSo(s: string): number | null {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return null
  if (!/^\d+([.,]\d+)?$/.test(t)) return Number.NaN
  return Number(t.replace(',', '.'))
}

const laChuNhat = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0
const sau = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Ngày làm việc của một người trong kỳ = mọi ngày trừ Chủ nhật (ngày lễ VẪN tính — sổ T9 cho
 * 28 = 27 ngày làm việc + lễ 02/09), cắt theo ngày vào / ngày nghỉ việc. Đây là GỢI Ý cho ô trống.
 */
export function ngayLamViec(
  tu: string,
  den: string,
  nguoi: { ngayVao?: string | null; ngayNghi?: string | null } = {},
): number {
  const a = nguoi.ngayVao && nguoi.ngayVao > tu ? nguoi.ngayVao : tu
  const b = nguoi.ngayNghi && nguoi.ngayNghi < den ? nguoi.ngayNghi : den
  let n = 0
  for (let d = a; d <= b; d = sau(d)) if (!laChuNhat(d)) n++
  return n
}

/** Số ngày lịch của kỳ — trần cứng cho số công. */
export function soNgayKy(tu: string, den: string): number {
  return Math.round((Date.parse(den) - Date.parse(tu)) / 86_400_000) + 1
}

export type KiemNhap = { loi: string | null; canhBao: string | null }

/**
 * Kiểm một dòng. Lỗi = không lưu được; cảnh báo = vẫn lưu (vd. làm cả Chủ nhật).
 * `cong` null = ô trống (hợp lệ khi đang nhập dở; chặn ở điều kiện chốt, không ở đây).
 */
export function kiemNhap(
  v: { cong: number | null; tcGio: number | null },
  k: { soNgayKy: number; ngayLamViec: number },
): KiemNhap {
  if (v.cong != null) {
    if (Number.isNaN(v.cong))
      return { loi: 'Công phải là số, vd. 27 hoặc 27,5', canhBao: null }
    if (v.cong < 0) return { loi: 'Công không âm', canhBao: null }
    if (v.cong > k.soNgayKy)
      return {
        loi: `Công ${so(v.cong)} lớn hơn số ngày của kỳ (${k.soNgayKy}) — sửa lại số công`,
        canhBao: null,
      }
    if (!haiLe(v.cong)) return { loi: 'Công lấy tối đa 2 số lẻ', canhBao: null }
  }
  if (v.tcGio != null) {
    if (Number.isNaN(v.tcGio))
      return { loi: 'Giờ tăng ca phải là số, vd. 80 hoặc 12,5', canhBao: null }
    if (v.tcGio < 0) return { loi: 'Giờ tăng ca không âm', canhBao: null }
    if (v.tcGio > k.soNgayKy * 16)
      return {
        loi: `${so(v.tcGio)} giờ tăng ca quá ${k.soNgayKy * 16} giờ (16 giờ × ${k.soNgayKy} ngày) — kiểm lại`,
        canhBao: null,
      }
    if (v.cong == null && v.tcGio > 0)
      return { loi: 'Có giờ tăng ca thì phải nhập cả số công', canhBao: null }
  }
  if (v.cong != null && v.cong > k.ngayLamViec)
    return {
      loi: null,
      canhBao: `${so(v.cong)} công nhiều hơn ${k.ngayLamViec} ngày làm việc — làm cả Chủ nhật?`,
    }
  return { loi: null, canhBao: null }
}

/** Tối đa 2 số lẻ — so có dung sai: 5,1 × 100 = 509,999… trong số thực máy. */
const haiLe = (x: number) => Math.abs(Math.round(x * 100) - x * 100) < 1e-6

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

// ── Khối B — công cộng thêm ngoài máy (bước 3) ────────────────────────────

/**
 * Lý do cộng thêm. `ngoai_gio` theo cột "Công ngoài giờ" sổ TH tổ Sơn: Kế toán cộng vào công
 * TĂNG CA (Q5) → phiếu lương có dòng riêng trong nhóm tăng ca. Còn lại (làm Chủ nhật không
 * quẹt, khác) là công thường — cộng vào số công của lương công (Q3: 6052, 6067 sổ ghi 29).
 */
export type LyDoThem = 'ngoai_gio' | 'chu_nhat' | 'khac'
export const LY_DO_THEM: LyDoThem[] = ['ngoai_gio', 'chu_nhat', 'khac']
export const TEN_LY_DO_THEM: Record<LyDoThem, string> = {
  ngoai_gio: 'Công ngoài giờ',
  chu_nhat: 'Làm Chủ nhật',
  khac: 'Khác',
}
/** Lý do nào trả như tăng ca (nhóm tăng ca, nền phụ cấp "công + công TC"). */
export const laTangCa = (l: LyDoThem) => l === 'ngoai_gio'
export const lyDoCua = (s: string | null | undefined): LyDoThem =>
  LY_DO_THEM.find((x) => x === s) ?? 'khac'

/** Kiểm một dòng công cộng thêm: công > 0, tối đa số ngày kỳ, 2 số lẻ. */
export function kiemThem(cong: number | null, soNgayKy: number): string | null {
  if (cong == null) return 'Nhập số công'
  if (Number.isNaN(cong)) return 'Công phải là số, vd. 1 hoặc 0,71'
  if (cong <= 0) return 'Công phải lớn hơn 0 — muốn bỏ thì xoá dòng'
  if (cong > soNgayKy) return `Công lớn hơn số ngày của kỳ (${soNgayKy})`
  if (!haiLe(cong)) return 'Công lấy tối đa 2 số lẻ'
  return null
}

/**
 * Dán từ Excel: mỗi dòng "mã ⇥ công" (thêm cột ghi chú tuỳ ý). Bỏ dòng tiêu đề / dòng trống;
 * mã có số 0 đầu ("01043") bỏ 0 như mã máy. Dòng hỏng trả kèm lý do, không đoán.
 */
export function docDan(text: string): {
  dong: { ma: string; cong: number; ghiChu: string | null }[]
  hong: string[]
} {
  const dong: { ma: string; cong: number; ghiChu: string | null }[] = []
  const hong: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const cot = raw.split('\t').map((c) => c.trim())
    if (!cot.join('')) continue
    const ma = (cot[0] ?? '').replace(/^'/, '').replace(/^0+(?=\d)/, '')
    const cong = docSo(cot[1] ?? '')
    if (!ma || cong == null || Number.isNaN(cong)) {
      if (dong.length || /\d/.test(cot[1] ?? ''))
        hong.push(`“${raw.slice(0, 40)}” — cần mã ⇥ số công`)
      continue
    }
    dong.push({ ma, cong, ghiChu: cot[2] || null })
  }
  return { dong, hong }
}
