/**
 * KHOÁ SO TRÙNG CHO TÊN VẬT TƯ.
 *
 * BẢN GỐC DUY NHẤT — `scripts/materials-dedupe.mjs` import thẳng file này (Node
 * 24 chạy được .ts nhờ type-stripping). Trước đây script giữ bản riêng; hai bản
 * lệch nhau nghĩa là chỗ CHẶN lúc tạo và chỗ DÒ lúc dọn hiểu "trùng" khác nhau —
 * chặn hụt rồi lại đi dọn thủ công.
 *
 * Vì sao cần: danh mục nạp từ nhiều nguồn viết tay nên cùng một con long đền ra
 * bốn mã —
 *   "LĐN 6x16x2 đen" · "LĐN 6x16x2, màu đen" · "LĐN 6x16x2 ly" · "LĐN 6x16x2 , đem"
 * Để nguyên thì mỗi đơn hàng trỏ vào một mã khác nhau, tồn kho và giá mua vỡ vụn.
 *
 * HAI MỨC, KHÔNG GỘP BỪA:
 *   · CHẮC CHẮN (`sureKey`) — chỉ khác dấu câu / khoảng trắng / chữ "màu" / đuôi
 *     "ly|li". Nghĩa không đổi → chặn được lúc tạo, gộp được lúc dọn.
 *   · NGHI NGỜ (`softKey`) — cùng chữ đầu + cùng bộ số nhưng khác chữ. Chỉ CẢNH
 *     BÁO: "LĐN 6x16x2 đen" và "LĐN 6x16x2 xám" là hai mặt hàng thật, chặn nhầm
 *     là không khai được hàng mới.
 */

export function nod(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

/**
 * VIẾT TẮT CỦA XƯỞNG → dạng đầy đủ, chạy trên chuỗi ĐÃ qua `nod()` (ascii thường).
 *
 * Nguồn: chính sổ của Cung ứng. Sheet "Tổng VT cần mua" (LSX 04) phải ghi tay
 * "Gộp 3 dòng (4x15 7 màu / 7M)", "Gộp 2 dòng (xi trắng / XT)" — tức cùng một
 * món đã thành nhiều mã chỉ vì cách viết. Đưa vào khoá "chắc chắn" để hai cách
 * viết ra CÙNG khoá và bị chặn ngay lúc tạo.
 *
 * Chỉ nhận viết tắt nghĩa KHÔNG thể lẫn: "7m" đứng một mình trong tên vật tư là
 * "7 màu" (bảy màu — lớp xi); độ dài cây luôn viết kèm chữ ("cây 6m", "dài 7m")
 * nhưng các tên đó có chữ "cay|dai" đứng trước nên không lọt mẫu \b7m\b sau khi
 * tách từ. ĐBĐC/ĐDĐC là đầu bằng/đầu dù đuôi cá — chỉ có ở nhóm vít.
 */
const ABBREVS: [RegExp, string][] = [
  [/\b7m\b/g, '7 mau'],
  [/\bxt\b/g, 'xi trang'],
  [/\bdbdc\b/g, 'dau bang duoi ca'],
  [/\bdddc\b/g, 'dau du duoi ca'],
]

export function expandAbbrevs(s: string): string {
  return ABBREVS.reduce((acc, [re, to]) => acc.replace(re, to), s)
}

/**
 * Khoá "chắc chắn": bỏ dấu câu, chữ "màu", đuôi đơn vị ly/li, mọi khoảng trắng.
 * Viết tắt xưởng (7M/XT/ĐBĐC) được bung ra trước nên "Vít 4x15, 7M" và
 * "Vít 4x15, 7 màu" ra cùng khoá — đúng như ghi chú "Gộp dòng" trong sổ thật.
 *
 * DẤU GẠCH CHÉO GIỮA HAI SỐ ĐƯỢC GIỮ. Bỏ nó đi thì "Cục típ 1/2" (1/2 inch) và
 * "Cục típ 12" (12 mm) ra cùng khoá — hai mặt hàng thật bị coi là một, và vì mức
 * "chắc chắn" CHẶN CỨNG lúc tạo nên hậu quả là không khai được vật tư, tức quên
 * mua. Phát hiện khi dry-run nhập sổ Drive 02/08.
 *
 * Đánh đổi: "Đầu cos 25/8" và "Đầu cos 25-8" (cùng một món, hai cách viết cỡ)
 * thôi không tự gộp nữa. Chấp nhận được — `softKey` vẫn gom chúng vào mức "nghi
 * ngờ" cho người rà, mà mức đó không chặn ai cả. Mức "chắc chắn" sai một lần là
 * mất hàng; mức "nghi ngờ" sai chỉ tốn một lượt nhìn.
 */
export function sureKey(name: string | null | undefined): string {
  return expandAbbrevs(nod(name))
    .replace(/\bmau\b/g, ' ')
    .replace(/(\d)\s*(?:ly|li)\b/g, '$1')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1⁄$2') // ⁄ sống sót qua bước lọc dưới
    .replace(/[^a-z0-9⁄]/g, '')
}

/**
 * Khoá "nghi ngờ": chữ đầu + BỘ SỐ. Bắt sai chính tả ở phần chữ ("đem"/"đen")
 * mà vẫn cùng quy cách.
 *
 * Bắt buộc có số: không có số thì "Bao bì — Ghế Hali", "Bao bì bàn", "Bao bì
 * bank I" gom thành một cụm 12 mặt hàng khác nhau — danh sách rà thành vô dụng.
 */
export function softKey(name: string | null | undefined): string | null {
  const s = nod(name).replace(/[^a-z0-9\s]/g, ' ')
  const first = s.trim().split(/\s+/)[0] ?? ''
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? []).join('x')
  if (!nums || !first) return null
  return `${first}|${nums}`
}

/**
 * Khoá đầy đủ để so trùng: NHÓM + tên chuẩn hoá.
 *
 * Bỏ nhóm ra khỏi khoá là gộp nhầm chéo vật liệu: "Hộp 25x50x1" của INOX
 * (IX-0002) và "Hộp 25x50x1li" của NHÔM (NH-0080) trùng từng ký tự sau chuẩn hoá
 * nhưng là hai mặt hàng khác nhau, giá chênh nhiều lần.
 */
export function scopedSureKey(
  name: string | null | undefined,
  groupName: string | null | undefined,
): string {
  return `${nod(groupName) || '—'}::${sureKey(name)}`
}

/** Khoá quá ngắn thì so trùng vô nghĩa ("ốc", "vít") — bỏ qua thay vì chặn bừa. */
export const MIN_KEY_LEN = 3

/** Hai chuỗi lệch nhau tối đa 1 phép sửa (thêm/xoá/thay 1 ký tự)? */
function editDistanceLe1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  while (i < s.length && s[i] === l[i]) i++
  // Cùng độ dài → thử THAY ký tự i; khác 1 → thử XOÁ ký tự i của chuỗi dài.
  return s.length === l.length
    ? s.slice(i + 1) === l.slice(i + 1)
    : s.slice(i) === l.slice(i + 1)
}

/**
 * SO MỜ CHO MỨC "NGHI NGỜ" — bắt sai chính tả mà `sureKey`/`softKey` đều lọt.
 *
 * Ca thật từ sổ Cung ứng: "Bộ tip Buri + Cây xỏ" (LSX 04) và "Bộ Típ Bori +
 * cây xỏ" (BKVT LSX 02) là MỘT món — không chứa nhau (Buri/Bori), không có số
 * (softKey trả null). So theo TỪ: từ có chữ số phải khớp TUYỆT ĐỐI ("6x16x2" ≠
 * "6x16x3" là hai cỡ thật), từ chỉ chữ ≥3 ký tự cho lệch 1 ký tự (buri≈bori,
 * den≈dem — ca "đen/đem" ghi ngay đầu file này).
 *
 * CHỈ dùng để CẢNH BÁO, không chặn: lệch 1 ký tự vẫn có thể là hai hàng thật.
 */
export function namesAlike(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = sureKey(a)
  const kb = sureKey(b)
  if (ka.length < MIN_KEY_LEN || kb.length < MIN_KEY_LEN) return false
  if (ka === kb) return true

  const tokens = (name: string | null | undefined) =>
    expandAbbrevs(nod(name))
      .replace(/[^a-z0-9⁄]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t !== 'mau') // sureKey cũng bỏ "màu" — hai mức cùng luật
      .sort()
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || ta.length !== tb.length) return false

  return ta.every((t, i) => {
    const u = tb[i]
    if (t === u) return true
    // Từ mang CHỮ SỐ là quy cách — khác một ký tự là khác cỡ hàng, không mờ.
    if (/\d/.test(t) || /\d/.test(u)) return false
    return t.length >= 3 && u.length >= 3 && editDistanceLe1(t, u)
  })
}

/**
 * TIỀN TỐ MÃ theo nhóm, dùng khi nhóm chưa có vật tư nào để suy ra.
 *
 * Bảng lấy từ `classify()` của `scripts/materials-import.mjs` — nơi đã phân 1.351
 * vật tư thật vào nhóm. Không khớp gì thì trả null để nơi gọi tự quyết.
 */
const PREFIX_BY_GROUP: [RegExp, string][] = [
  [/ngu kim|phu kien/, 'NK'],
  [/bao bi|carton/, 'BB'],
  [/xop|mut|bi nhua/, 'XM'],
  [/may|day/, 'MA'],
  [/son|hoa chat/, 'SO'],
  [/go|van ep/, 'GO'],
  [/nhom/, 'NH'],
  [/inox/, 'IX'],
  [/sat|thep/, 'ST'],
  [/kinh/, 'KI'],
]

export function prefixForGroup(groupName: string | null | undefined): string | null {
  const g = nod(groupName).trim()
  if (!g) return null
  return PREFIX_BY_GROUP.find(([re]) => re.test(g))?.[1] ?? null
}
