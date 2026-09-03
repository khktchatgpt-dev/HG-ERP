import { normalizeSearch, searchTokens } from './search-text'

/**
 * XẾP HẠNG KẾT QUẢ TÌM VẬT TƯ — thuần, không đụng DB.
 *
 * Vì sao cần: ô tìm của form soạn đơn lọc bằng `ilike` AND từng từ rồi lấy N
 * dòng ĐẦU BẢNG CHỮ CÁI. Gõ "thùng carton" khớp 471 mã, cửa sổ 50 dòng chỉ toàn
 * "BB ..." — cái người ta vừa gõ gần đúng tên KHÔNG BAO GIỜ lọt vào, tới khi
 * chọn nhóm cho tập nhỏ lại thì mới thấy. Người dùng báo đúng hiện tượng đó
 * (03/09/2026): "gõ tên khá sát vẫn không lọc ra, chọn nhóm mới tìm thấy".
 *
 * Cách chấm: khớp CẢ CỤM thắng khớp rời từng từ; đứng đầu tên thắng nằm giữa;
 * gõ trúng mã thắng tất cả. Tên ngắn hơn nhích lên chút ở thế hoà — "Vít 4x15"
 * đáng đứng trước "Vít 4x15 đầu bằng ren gỗ xi trắng" khi người ta gõ "vít 4x15".
 */
export type RankableMaterial = { code: string; name: string }

/** Điểm khớp chữ, 0 = không khớp gì. Càng lớn càng đúng ý người gõ. */
export function matchScore(query: string, m: RankableMaterial): number {
  const nq = normalizeSearch(query)
  if (!nq) return 0
  const name = normalizeSearch(m.name)
  const code = normalizeSearch(m.code)

  if (code === nq || name === nq) return 100
  if (code.startsWith(nq)) return 80
  if (code.includes(nq)) return 60

  let s = 0
  if (name.startsWith(nq)) s = 70
  else if (name.includes(nq)) s = 50
  else {
    // Không có cả cụm: chấm theo số từ khớp, ưu tiên từ đứng ĐẦU MỘT TỪ trong
    // tên ("4x15" trong "Vít 4x15" hơn là lọt giữa "M4x150").
    const tokens = searchTokens(query)
    if (tokens.length === 0) return 0
    let hit = 0
    let atWordStart = 0
    for (const t of tokens) {
      if (!name.includes(t)) continue
      hit++
      if (new RegExp(`(^|[^a-z0-9])${escapeRe(t)}`).test(name)) atWordStart++
    }
    if (hit === 0) return 0
    s = Math.round((hit / tokens.length) * 30) + atWordStart
  }
  // Thế hoà: tên gọn hơn lên trước (tối đa 5 điểm, không lật được bậc trên).
  return s + Math.max(0, 5 - Math.floor(name.length / 20))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Sắp xếp kết quả: điểm khớp chữ trước, rồi tới TÍN HIỆU DÙNG THẬT (mã đã từng
 * lên đơn, mã có giá mua) để giữa một rừng mã na ná nhau thì mã người trước đã
 * chọn nổi lên — nguyên tắc có từ đợt "rừng mã trùng", nay chỉ đổi thứ tự ưu
 * tiên: đúng thứ đang tìm trước, đang dùng sau.
 */
export function rankMaterials<T extends RankableMaterial>(
  query: string,
  rows: T[],
  signal: (m: T) => { used?: boolean; priced?: boolean } = () => ({}),
): T[] {
  return [...rows]
    .map((m) => {
      const s = signal(m)
      return { m, k: matchScore(query, m) * 10 + (s.used ? 4 : 0) + (s.priced ? 2 : 0) }
    })
    .sort((a, b) => b.k - a.k || a.m.name.localeCompare(b.m.name, 'vi'))
    .map((x) => x.m)
}
