import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'

/**
 * Auth gate cho mọi trang trong workspace group.
 * Page tự resolve workspace từ path và wrap trong WorkspaceShell —
 * layout này chỉ đảm bảo user đã login.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
