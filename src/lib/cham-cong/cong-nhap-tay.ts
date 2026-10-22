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
    if (Math.round(v.cong * 100) !== v.cong * 100)
      return { loi: 'Công lấy tối đa 2 số lẻ', canhBao: null }
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

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
