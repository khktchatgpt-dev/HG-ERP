import { redirect } from 'next/navigation'
import { getSession } from '@/modules/core/auth/session'
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  // Đã đăng nhập thì không hiện form nữa — "/" tự đưa vào workspace mặc định.
  const session = await getSession()
  if (session) redirect('/')

  const { next } = await searchParams
  return <LoginForm next={typeof next === 'string' ? next : undefined} />
}
