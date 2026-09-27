/**
 * NHÃN HIỂN THỊ CHO DANH SÁCH ĐƠN MUA — thuần, có test (27/09/2026).
 *
 * Cá nhân hoá màn Đơn mua (artboard 4, canvas "Cá nhân hoá phòng Cung ứng"):
 * màn phải nói đơn của AI, mua của AI, mua CÁI GÌ — mà không phải mở từng đơn.
 */

/**
 * Tên NCC để ĐỌC TRONG CỘT: bỏ phần loại hình ở đầu ("CÔNG TY TNHH SX & TM DV",
 * "CÔNG TY CỔ PHẦN", "DOANH NGHIỆP TƯ NHÂN", "HỘ KINH DOANH") — phần người ta
 * gọi nhau là phần còn lại ("TÂN THÀNH LONG", "BAO BÌ 3/2").
 *
 * Đo 27/09: 26/46 NCC có đơn tên dài quá 30 ký tự nên cột cắt mất đúng phần
 * phân biệt. KHÔNG dùng `short_name` của danh mục: đó là mã đánh số đơn (BB,
 * TTL, TN), đọc không ra ai. Tên đầy đủ vẫn phải đi kèm (`title` của ô).
 * Bóc xong mà rỗng (tên chỉ có loại hình) thì trả nguyên tên.
 */
const LEGAL_FORM = new RegExp(
  String.raw`^(?:(?:CÔNG\s+TY|CTY)\s+(?:(?:TNHH|CỔ\s+PHẦN|CP|HỢP\s+DANH)\s+)?(?:(?:MTV|MỘT\s+THÀNH\s+VIÊN)\s+)?(?:(?:SX|SẢN\s+XUẤT|TM|THƯƠNG\s+MẠI|DV|DỊCH\s+VỤ|XNK|XUẤT\s+NHẬP\s+KHẨU|XD|KT|&|-|,)\s*)*|DOANH\s+NGHIỆP\s+TƯ\s+NHÂN\s+|DNTN\s+|HỘ\s+KINH\s+DOANH\s+)`,
  'iu',
)

export function supplierShortName(name: string | null | undefined): string {
  const full = (name ?? '').trim()
  const rest = full.replace(LEGAL_FORM, '').trim()
  // Còn lại chỉ là mẩu loại hình ("CÔNG TY TNHH" → "TNHH") thì không có tên riêng.
  return rest && !/^(TNHH|CỔ\s+PHẦN|CP|MTV)$/iu.test(rest) ? rest : full
}

/**
 * Tên GỌI của một người — chữ cuối của họ tên, viết hoa chữ đầu ("nguyễn đình
 * huy" → "Huy"). Hai người trùng tên gọi thì trả họ tên đầy đủ cho CẢ HAI:
 * hai chip cùng chữ "Nga" là không biết bấm cái nào.
 */
export function givenNames(people: { id: string; name: string }[]): Map<string, string> {
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1)
  const given = (n: string) => cap(n.trim().split(/\s+/).pop() ?? n)
  const seen = new Map<string, number>()
  for (const p of people) seen.set(given(p.name), (seen.get(given(p.name)) ?? 0) + 1)
  return new Map(
    people.map((p) => [
      p.id,
      (seen.get(given(p.name)) ?? 0) > 1
        ? p.name.trim().split(/\s+/).map(cap).join(' ')
        : given(p.name),
    ]),
  )
}

/**
 * Đơn mua CÁI GÌ, trong một ô: tên vật tư đầu (khác nhau, theo thứ tự dòng) +
 * số mã còn lại. Đo 27/09: 4,1 dòng/đơn, 29/87 đơn chỉ một dòng — hai tên là
 * đủ nhận ra đơn, phần dư nói bằng số.
 */
export function materialSummary(
  names: readonly string[],
  take = 2,
): { head: string; more: number } {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  return { head: uniq.slice(0, take).join(', '), more: Math.max(0, uniq.length - take) }
}
