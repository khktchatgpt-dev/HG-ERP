/**
 * NHÓM DÒNG CỦA LƯỚI GHI SẢN LƯỢNG (bản vẽ 11/11/2026): mã hàng → cụm → chi
 * tiết, mỗi nhóm kèm số BỘ ĐỒNG BỘ ở công đoạn đang ghi — câu sổ Excel không
 * trả lời được: "gõ xong 150 chân thì đẩy được bao nhiêu bộ, kẹt ở đâu?".
 *
 * Thuần, không chạm DB. `done` là số đạt CHÍNH THỨC (như cột Đã của lưới).
 */

import { quyCach } from './bom-chua-ma'
import { khoaCum } from './khoa-cum'

type WithCluster = { cluster: string | null }

/**
 * Xếp chi tiết theo cụm, cụm theo thứ tự xuất hiện đầu tiên; trong cụm giữ
 * nguyên thứ tự cũ. Không xếp thì một cụm nằm rải rác thành nhiều đầu nhóm.
 */
export function xepTheoCum<T extends WithCluster>(lines: T[]): T[] {
  // So tên cụm bằng khoaCum (Q20): "Cụm tựa" và "cụm tựa" là MỘT cụm.
  const firstAt = new Map<string, number>()
  lines.forEach((l, i) => {
    const k = khoaCum(l.cluster)
    if (!firstAt.has(k)) firstAt.set(k, i)
  })
  return lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      const ka = firstAt.get(khoaCum(a.l.cluster))!
      const kb = firstAt.get(khoaCum(b.l.cluster))!
      return ka - kb || a.i - b.i
    })
    .map((x) => x.l)
}

export type DongBo = {
  /** Bộ đồng bộ = MIN qua các dòng của ⌊đã đạt ÷ (cần ÷ SL đặt)⌋; null khi không tính được. */
  sets: number | null
  /** Cụm (hoặc tên dòng khi chưa gán cụm) đang kéo số bộ xuống — rỗng khi đã đủ. */
  short: string[]
}

/** Đồng bộ của một nhóm dòng ở công đoạn đang ghi. `qty` = SL đặt của mã hàng. */
export function dongBo(
  lines: { name: string; cluster: string | null; needed: number; done: number }[],
  qty: number,
): DongBo {
  if (!(qty > 0)) return { sets: null, short: [] }
  let sets: number | null = null
  const per: { who: string; sets: number }[] = []
  for (const l of lines) {
    if (!(l.needed > 0)) continue
    const perSet = l.needed / qty
    const s = Math.min(qty, Math.floor(l.done / perSet + 1e-9))
    per.push({ who: l.cluster ?? l.name, sets: s })
    sets = sets == null ? s : Math.min(sets, s)
  }
  if (sets == null || sets >= qty) return { sets, short: [] }
  const short = [...new Set(per.filter((p) => p.sets === sets).map((p) => p.who))]
  return { sets, short }
}

/**
 * QUY CÁCH trên dòng ghi (bản vẽ 12/11/2026, Q10): "40×40×625·1,2" = dày × rộng
 * × dài (mm) · độ dày thành. Dùng lại `quyCach` của bảng kê chưa mã để hai màn
 * viết cùng một kiểu. Không có số nào → chuỗi rỗng (ô để trống, không bịa "—").
 */
export function quyCachDong(
  spec: {
    t: number | null
    w: number | null
    l: number | null
    wall: number | null
  } | null,
): string {
  if (!spec) return ''
  // Dấu phẩy kiểu VN ("13,5×50×1145"), bản 5 Q20 — `quyCach` gốc giữ dấu chấm
  // vì nó còn làm KHOÁ gom ở bảng kê chưa mã.
  const kt = (quyCach([spec.t, spec.w, spec.l]) ?? '').replace(/\./g, ',')
  // Thành = dày → thanh đặc / la / pát: "2×20×65·2" nói thừa một số.
  const wall =
    spec.wall && spec.wall > 0 && spec.wall !== spec.t
      ? String(spec.wall).replace('.', ',')
      : ''
  return kt && wall ? `${kt}·${wall}` : kt || (wall ? `thành ${wall}` : '')
}

/** Lựa chọn "Tất cả mã hàng" ở thanh chọn mã. */
export const TAT_CA_MA = '*'

/**
 * Mã hàng mở mặc định (Q11): mã lần trước nếu lệnh này còn có nó (hoặc "Tất
 * cả"); không thì mã ĐẦU TIÊN còn việc; lệnh xong hết thì mã đầu.
 */
export function maMacDinh(
  groups: { product_code: string; lines: { remaining: number }[] }[],
  remembered: string | null,
): string {
  if (groups.length === 0) return TAT_CA_MA
  if (remembered === TAT_CA_MA) return TAT_CA_MA
  if (remembered && groups.some((g) => g.product_code === remembered)) return remembered
  return (groups.find((g) => g.lines.some((l) => l.remaining > 0)) ?? groups[0])
    .product_code
}
