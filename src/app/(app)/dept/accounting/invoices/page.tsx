import { redirect } from 'next/navigation'

/**
 * Trang cũ — đã chuyển vào workspace Tài chính - Kế toán.
 * Giữ redirect để link/bookmark cũ vẫn hoạt động.
 */
export default function LegacyAcctInvoicesPage() {
  redirect('/finance/invoices')
}
