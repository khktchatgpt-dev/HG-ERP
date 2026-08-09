import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  /*
   * Đã đăng nhập thì không hiện form nữa — "/" tự đưa vào workspace mặc định.
   *
   * Phải tra USER THẬT trong DB (currentUser), không chỉ verify cookie
   * (getSession): tài khoản bị xoá/khoá giữa phiên thì cookie vẫn hợp lệ —
   * chỉ nhìn cookie là /login đá về "/", "/" thấy user null đá lại /login,
   * lặp vô tận và trình duyệt báo "quá nhiều redirect" (gặp thật 09/08/2026).
   * User null thì CỨ HIỆN FORM: đăng nhập lại là cookie mới đè cookie mồ côi.
   */
  const user = await authService.currentUser()
  if (user) redirect('/')

  const { next } = await searchParams
  return <LoginForm next={typeof next === 'string' ? next : undefined} />
}
