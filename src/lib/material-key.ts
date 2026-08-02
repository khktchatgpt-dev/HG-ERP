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

/** Khoá "chắc chắn": bỏ dấu câu, chữ "màu", đuôi đơn vị ly/li, mọi khoảng trắng. */
export function sureKey(name: string | null | undefined): string {
  return nod(name)
    .replace(/\bmau\b/g, ' ')
    .replace(/(\d)\s*(?:ly|li)\b/g, '$1')
    .replace(/[^a-z0-9]/g, '')
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
