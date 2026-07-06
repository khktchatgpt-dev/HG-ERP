import { redirect } from 'next/navigation'

/**
 * Trang cũ — đã chuyển vào workspace Nhân sự.
 * Giữ redirect để link/bookmark cũ vẫn hoạt động.
 */
export default function LegacyHRLeavePage() {
  redirect('/hr/leave')
}
