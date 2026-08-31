import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { ForcePasswordForm } from './ForcePasswordForm'

export const metadata = { title: 'Đổi mật khẩu' }

/**
 * Đổi mật khẩu BẮT BUỘC — chặn đứng ở đây cho tới khi người dùng tự đặt mật
 * khẩu riêng (`users.must_change_password`). Cổng chặn nằm ở `src/proxy.ts`;
 * trang này chỉ là điểm đến.
 *
 * Nằm trong nhóm `(public)` vì đó là nhóm KHÔNG CÓ shell (toàn màn hình, không
 * sidebar) chứ không phải vì mở cho khách — proxy vẫn đòi đăng nhập, pathname
 * này không có trong `PUBLIC_PATHS`. Cố ý không có sidebar: người đang bị giữ
 * ở đây chưa được đi đâu cả, bày menu ra chỉ để họ bấm vào rồi bị đá về.
 */
export default async function ForcePasswordPage() {
  const user = await authService.requirePageUser()
  // Vào thẳng URL này khi không nợ gì thì về nhà — đổi mật khẩu tự nguyện đã có
  // chỗ tử tế hơn ở /tai-khoan.
  if (!user.must_change_password) redirect('/tai-khoan')

  return <ForcePasswordForm email={user.email} name={user.name} />
}
