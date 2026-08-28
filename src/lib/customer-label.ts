/**
 * CHUẨN HOÁ NHÃN KHÁCH / NHÓM của thư viện sản phẩm (`technical_products.customer_name`).
 *
 * Nhãn này CỐ Ý gõ tự do, không FK sang danh mục khách của Kinh doanh (0091) —
 * Kỹ thuật phải tạo được SP cho khách chưa có hồ sơ. Cái giá của tự do là trùng
 * lặp, và đo trên dữ liệu thật (21/08/2026) đúng như vậy: 47 nhãn cho 557 SP,
 * trong đó 5 cặp chỉ khác hoa/thường — `LAURA` 93 SP nằm cạnh `Laura` 17 SP,
 * `CASUAL` 16 cạnh `Casual` 1. Người lọc theo khách bị chia đôi danh sách mà
 * không hề biết.
 *
 * Luật: bỏ khoảng trắng thừa, gộp khoảng trắng trong tên, rồi VIẾT HOA HẾT
 * (user chốt 21/08/2026). Viết hoa là chốt chặn quan trọng nhất — nó khiến lớp
 * trùng "chỉ khác hoa/thường" KHÔNG THỂ tái sinh, chứ không phải dọn xong lại
 * đâu vào đấy sau vài tuần.
 *
 * KHÔNG bỏ dấu tiếng Việt và không đụng ký tự khác (`&`, `-`, `.`, `'`): tên
 * riêng của khách là thứ pháp lý, chuẩn hoá quá tay là sửa tên người ta.
 */

/** `"  merxx  handels " ` → `"MERXX HANDELS"`; rỗng → `null`. */
export function normalizeCustomerLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = raw
    // NFKC gộp ký tự dựng sẵn / nửa-toàn phần — dán từ Excel hay dính chúng.
    .normalize('NFKC')
    // \s không bắt no-break space (U+00A0) mà Word/Excel chèn đầy.
    .replace(/[\s ]+/g, ' ')
    .trim()
  if (!t) return null
  return t.toLocaleUpperCase('vi')
}

/**
 * Nhãn cho SP do Kinh doanh tạo nhanh: lấy MÃ khách chứ không lấy tên pháp nhân.
 *
 * `sales_customers` ghi `MERXX / "MERXX HANDELS GMBH"`, `YOTRIO / "YOTRIO GROUP"`
 * — mà thư viện SP gọi khách bằng mã ngắn (MERXX, YOTRIO, ROSCO). Lấy `name` thì
 * mỗi lần Kinh doanh tạo nhanh một SP là đẻ lại đúng nhãn trùng vừa dọn xong.
 */
export function customerLabelFrom(c: {
  code?: string | null
  name?: string | null
}): string | null {
  return normalizeCustomerLabel(c.code?.trim() || c.name)
}
