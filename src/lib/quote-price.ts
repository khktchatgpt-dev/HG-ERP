/**
 * Giá NET một dòng báo giá = đơn giá gộp trừ chiết khấu dòng (0050).
 *
 * Đây là con số in trên báo giá gửi khách (`/print/quotes/[id]`) và phải là con
 * số nạp sang ĐƠN HÀNG khi tạo đơn từ báo giá — trước 07/10/2026 OrderForm nạp
 * giá GỘP, nên đơn ghi giá cao hơn giá đã chào. Logic thuần để hai nơi dùng chung
 * và test được.
 */
export function quoteNetPrice(
  unitPrice: number,
  discountPct: number | null | undefined,
): number {
  const pct = discountPct ?? 0
  if (!(pct > 0)) return unitPrice
  // Làm tròn 2 số lẻ đúng kiểu tiền tệ (tránh 12.345000000001).
  return Math.round(unitPrice * (1 - pct / 100) * 100) / 100
}
