import { redirect } from 'next/navigation'

/**
 * Khu Ban Giám đốc KHÔNG còn trang "Báo cáo CEO" (gỡ 07/2026 theo yêu cầu GĐ) —
 * vào thẳng Tháp điều hành (COO). Route workspace vẫn là `/exec` nên
 * resolveWorkspace + highlight sidebar giữ nguyên; trang này chỉ điều hướng.
 */
export default function ExecHome() {
  redirect('/exec/ops')
}
