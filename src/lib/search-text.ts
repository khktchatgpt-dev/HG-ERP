/**
 * Chuẩn hoá từ khoá tìm kiếm — PHẢI khớp đúng cách cột `technical_products.
 * search_text` được sinh ra ở migration 0098 (`immutable_unaccent(lower(...))`),
 * nếu không thì phía app gửi xuống một chuỗi mà phía DB không bao giờ khớp.
 *
 * Ba thứ được xử lý, theo đúng ba kiểu gõ hay gặp:
 *  1. DẤU TIẾNG VIỆT — "Ghế" và "ghe" phải cùng ra một kết quả.
 *  2. NHIỀU TỪ — "ghe florenz" tách thành 2 từ rồi AND lại, nên thứ tự gõ không
 *     quan trọng và không đòi hai từ phải liền nhau.
 *  3. KÝ TỰ ĐẶC BIỆT của cú pháp lọc PostgREST (dấu phẩy, ngoặc, sao) — bỏ đi
 *     để người dùng gõ "S0049HG-AL, ghế" không làm vỡ câu truy vấn.
 */

/** Bỏ dấu tiếng Việt + hạ chữ thường. Giống `immutable_unaccent(lower(x))` ở DB. */
export function normalizeSearch(input: string): string {
  return (
    input
      .normalize('NFD')
      // Bỏ toàn bộ dấu thanh + dấu mũ (U+0300–U+036F).
      .replace(/[̀-ͯ]/g, '')
      // đ/Đ không phải là "d + dấu" trong Unicode nên NFD không tách được.
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .trim()
  )
}

/**
 * Cắt từ khoá thành các từ để AND lại với nhau.
 *
 * Bỏ ký tự có nghĩa trong cú pháp `or()` của PostgREST (`,` `(` `)` `*`) — gõ
 * dấu phẩy mà không lọc thì câu lọc bị tách sai chỗ. Giữ lại `-` và `.` vì mã
 * sản phẩm có chúng (`S0049HG-AL`, `21605-217`).
 */
export function searchTokens(input: string, max = 5): string[] {
  return normalizeSearch(input)
    .replace(/[,()*%\\]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, max)
}

/** Từ khoá quá ngắn thì tìm gần đúng chỉ tổ ra nhiễu — "gh" khớp mọi thứ. */
export const worthFuzzy = (input: string): boolean => normalizeSearch(input).length >= 3

/**
 * LỌC TẠI CHỖ (client) theo cùng luật với ô tìm ở server — 06/10/2026.
 *
 * Trước đó các màn danh sách lọc ở trình duyệt bằng `toLowerCase().includes()`:
 * gõ "tan phat" không ra "TÂN PHÁT", gõ "tân phát" bằng bộ gõ ra chữ tổ hợp
 * (NFD) cũng trượt dù trông giống hệt, và hai từ phải liền nhau đúng thứ tự.
 * Người dùng đọc thành "ô tìm bị lỗi gõ". Nay: bỏ dấu, tách từ, MỌI từ phải có
 * mặt ở đâu đó trong các trường của dòng — đúng như `ilike` từng từ trên
 * `search_text` ở server.
 *
 * Trả về một hàm để dựng từ khoá MỘT lần cho cả danh sách, không mỗi dòng một lần.
 */
export function searchMatcher(input: string): (fields: readonly unknown[]) => boolean {
  const toks = searchTokens(input, 8)
  if (toks.length === 0) return () => true
  return (fields) => {
    const hay = normalizeSearch(
      fields
        .filter((v) => v != null && v !== '')
        .map(String)
        .join(' '),
    )
    return toks.every((t) => hay.includes(t))
  }
}
