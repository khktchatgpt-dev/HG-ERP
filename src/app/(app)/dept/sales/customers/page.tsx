import { redirect } from 'next/navigation'

/**
 * Trang cũ — đã chuyển vào workspace Bán hàng.
 * Giữ redirect để link/bookmark cũ vẫn hoạt động.
 */
export default function LegacySalesCustomersPage() {
  redirect('/sales/customers')
}
