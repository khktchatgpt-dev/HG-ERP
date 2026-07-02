import { redirect } from 'next/navigation'

/**
 * Trang cũ — đã chuyển vào workspace Kỹ thuật.
 * Giữ redirect để link/bookmark cũ vẫn hoạt động.
 */
export default function LegacyTechProductsPage() {
  redirect('/technical/products')
}
