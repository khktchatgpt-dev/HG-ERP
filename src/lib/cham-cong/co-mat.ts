/**
 * CÓ MẶT THEO NGÀY × TỔ — hàm thuần, dùng chung cho màn hình và file Excel (một
 * nguồn số, nguyên tắc 3). Ô = số người có ít nhất 1 lượt quẹt trong ngày; KHÔNG
 * tính công. Mẫu số = người CÒN LÀM ngày đó (theo ngày vào / ngày nghỉ việc), trừ người Không
 * chấm công — người nghỉ giữa kỳ vẫn đếm những ngày họ còn làm (22/10/2026: trước đó màn này
 * bỏ họ nên ghi 126 người trong khi Bảng công / Kỳ công ghi 133).
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
  nhanSu: {
    ma: string
    ten: string
    boPhan: string | null
    ngayVao?: string | null
    /** Ngày làm cuối của người đã nghỉ; trống = đang làm. */
    ngayCuoi?: string | null
  }[]
  /** 'YYYY-MM-DD' — ngày sau hôm nay không bày. */
  homNay: string
}

export type CoMatTo = {
  to: string
  ds: { ma: string; ten: string }[]
  /** Song song `ngays`: số người có mặt, null = ngày chưa có dữ liệu. */
  ngay: (number | null)[]
  /** Song song `ngays`: số người còn làm ngày đó — mẫu số của ô. */
  mau: number[]
  /** Tỉ lệ có mặt trung bình các ngày thường đã có dữ liệu (0..1), null = chưa có ngày nào. */
  tb: number | null
}

export type CoMat = {
  ngays: string[]
  tos: CoMatTo[]
  tong: (number | null)[]
  /** Song song `ngays`: người còn làm cả công ty ngày đó. */
  tongMau: number[]
  /** Người trong kỳ (gồm người nghỉ giữa kỳ). */
  tongNguoi: number
  tbTong: number | null
}

const laCN = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0

/** Tỉ lệ có mặt trung bình các ngày thường có dữ liệu, mỗi ngày chia đúng mẫu số ngày đó. */
function trungBinh(
  vals: (number | null)[],
  ngays: string[],
  coLuot: Set<string>,
  mau: number[],
) {
  const v = ngays
    .map((d, i) =>
      coLuot.has(d) && !laCN(d) && vals[i] != null && mau[i] ? vals[i]! / mau[i] : null,
    )
    .filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

const conLam = (n: { ngayVao?: string | null; ngayCuoi?: string | null }, d: string) =>
  (!n.ngayVao || d >= n.ngayVao) && (!n.ngayCuoi || d <= n.ngayCuoi)

export function tinhCoMat(d: CoMatVao): CoMat {
  const coLuot = new Set(
    d.theoNgay.filter((n) => Object.keys(n.theoMay).length > 0).map((n) => n.ngay),
  )
  const ngays = d.theoNgay.map((n) => n.ngay).filter((x) => x <= d.homNay)
  const co = new Set(d.dong.filter((r) => r.daGhep).map((r) => `${r.ngay}|${r.ma}`))
  const theoTo = new Map<string, (typeof d.nhanSu)[number][]>()
  for (const n of d.nhanSu) {
    const to = n.boPhan ?? CHUA_BO_PHAN
    theoTo.set(to, [...(theoTo.get(to) ?? []), n])
  }
  const tos: CoMatTo[] = [...theoTo.entries()]
    .map(([to, nguoi]) => {
      const mau = ngays.map((x) => nguoi.filter((p) => conLam(p, x)).length)
      const ngay = ngays.map((x) =>
        coLuot.has(x)
          ? nguoi.filter((p) => conLam(p, x) && co.has(`${x}|${p.ma}`)).length
          : null,
      )
      const ds = nguoi.map((p) => ({ ma: p.ma, ten: p.ten }))
      return { to, ds, ngay, mau, tb: trungBinh(ngay, ngays, coLuot, mau) }
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
  const tongMau = ngays.map((_, i) => tos.reduce((s, t) => s + t.mau[i], 0))
  return {
    ngays,
    tos,
    tong,
    tongMau,
    tongNguoi: d.nhanSu.length,
    tbTong: trungBinh(tong, ngays, coLuot, tongMau),
  }
}
