/**
 * CÓ MẶT THEO NGÀY × TỔ — hàm thuần, dùng chung cho màn hình và file Excel (một
 * nguồn số, nguyên tắc 3). Ô = số người có ít nhất 1 lượt quẹt trong ngày; KHÔNG
 * tính công. Mẫu số = nhân viên đang làm, trừ người Không chấm công.
 *
 * Ngày cả công ty chưa có lượt nào = chưa lấy về → `null` (không phải vắng). Chủ
 * nhật không vào trung bình (câu 12, duyệt 16/10/2026).
 */

export const CHUA_BO_PHAN = '(chưa có bộ phận)'

export type CoMatVao = {
  /** Mỗi ngày của kỳ: số lượt theo máy (rỗng = chưa có lượt). */
  theoNgay: { ngay: string; theoMay: Record<string, number> }[]
  /** Dòng người-ngày đã ghép người (`ma` = mã NV). */
  dong: { ngay: string; ma: string; daGhep: boolean }[]
  nhanSu: { ma: string; ten: string; boPhan: string | null }[]
  /** 'YYYY-MM-DD' — ngày sau hôm nay không bày. */
  homNay: string
}

export type CoMatTo = {
  to: string
  ds: { ma: string; ten: string }[]
  /** Song song `ngays`: số người có mặt, null = ngày chưa có dữ liệu. */
  ngay: (number | null)[]
  /** Tỉ lệ có mặt trung bình các ngày thường đã có dữ liệu (0..1), null = chưa có ngày nào. */
  tb: number | null
}

export type CoMat = {
  ngays: string[]
  tos: CoMatTo[]
  tong: (number | null)[]
  tongNguoi: number
  tbTong: number | null
}

const laCN = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0

function trungBinh(
  vals: (number | null)[],
  ngays: string[],
  coLuot: Set<string>,
  mau: number,
) {
  const v = ngays
    .map((d, i) => (coLuot.has(d) && !laCN(d) ? vals[i] : null))
    .filter((x): x is number => x != null)
  return v.length && mau ? v.reduce((a, b) => a + b, 0) / v.length / mau : null
}

export function tinhCoMat(d: CoMatVao): CoMat {
  const coLuot = new Set(
    d.theoNgay.filter((n) => Object.keys(n.theoMay).length > 0).map((n) => n.ngay),
  )
  const ngays = d.theoNgay.map((n) => n.ngay).filter((x) => x <= d.homNay)
  const co = new Set(d.dong.filter((r) => r.daGhep).map((r) => `${r.ngay}|${r.ma}`))
  const theoTo = new Map<string, { ma: string; ten: string }[]>()
  for (const n of d.nhanSu) {
    const to = n.boPhan ?? CHUA_BO_PHAN
    theoTo.set(to, [...(theoTo.get(to) ?? []), { ma: n.ma, ten: n.ten }])
  }
  const tos: CoMatTo[] = [...theoTo.entries()]
    .map(([to, ds]) => {
      const ngay = ngays.map((x) =>
        coLuot.has(x) ? ds.filter((p) => co.has(`${x}|${p.ma}`)).length : null,
      )
      return { to, ds, ngay, tb: trungBinh(ngay, ngays, coLuot, ds.length) }
    })
    .sort((a, b) =>
      a.to === CHUA_BO_PHAN
        ? 1
        : b.to === CHUA_BO_PHAN
          ? -1
          : b.ds.length - a.ds.length || a.to.localeCompare(b.to, 'vi'),
    )
  const tong = ngays.map((_, i) =>
    tos.every((t) => t.ngay[i] == null)
      ? null
      : tos.reduce((s, t) => s + (t.ngay[i] ?? 0), 0),
  )
  const tongNguoi = d.nhanSu.length
  return {
    ngays,
    tos,
    tong,
    tongNguoi,
    tbTong: trungBinh(tong, ngays, coLuot, tongNguoi),
  }
}
