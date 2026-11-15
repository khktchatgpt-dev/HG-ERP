/**
 * LỘ TRÌNH THEO NHÓM CHI TIẾT RỜI ở màn Lộ trình công đoạn (bản vẽ 15/11/2026
 * https://claude.ai/artifact/QR43i6trT8zJBgnrhyRst1, Q2 + Q4). Thuần, có test.
 *
 * Dòng tóm tắt "9 chi tiết khung" / "9 chi tiết gỗ" từng chỉ để xem: thêm Mài
 * cho khung là mở từng dòng rồi bấm 9 lần. Nay bấm ô trên dòng tóm tắt là
 * tick / bỏ cho cả nhóm.
 */

export type DongNhom = {
  key: string
  /** Lộ trình hiệu lực hiện tại của dòng (khai riêng thắng nhóm). */
  route: readonly string[]
  /** Lộ trình mặc định theo nhóm vật tư (khung: Phôi → Hàn → Nguội → Sơn; gỗ: rỗng). */
  macDinh: readonly string[]
}

const giong = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

/** Bao nhiêu dòng của nhóm đang đi qua công đoạn `code`. */
export function demQua(dongs: readonly DongNhom[], code: string): number {
  return dongs.filter((d) => d.route.includes(code)).length
}

/**
 * Bấm ô `code` trên dòng tóm tắt: MỌI dòng đã qua → bỏ cho cả nhóm; còn dòng
 * chưa qua → thêm cho mọi dòng. Trả lộ trình khai mới của từng dòng; trùng mặc
 * định nhóm thì `null` (về mặc định — không đếm là "khai riêng").
 */
export function bamCaNhom(
  dongs: readonly DongNhom[],
  code: string,
  sapXep: (xs: string[]) => string[],
): Map<string, string[] | null> {
  const bo = dongs.length > 0 && demQua(dongs, code) === dongs.length
  const out = new Map<string, string[] | null>()
  for (const d of dongs) {
    const moi = bo
      ? d.route.filter((x) => x !== code)
      : d.route.includes(code)
        ? [...d.route]
        : [...d.route, code]
    const st = sapXep(moi)
    out.set(d.key, giong(st, d.macDinh) ? null : st)
  }
  return out
}

/** Khoá so một chi tiết giữa các đợt cùng mã hàng: tên gọn (không phân biệt hoa thường) + nhóm. */
export function khoaChiTiet(name: string, groupCode: string | null | undefined): string {
  return `${(groupCode ?? '').trim().toUpperCase()}|${name.replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')}`
}
