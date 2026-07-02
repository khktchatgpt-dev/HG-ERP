import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { AppShell } from '@/components/AppShell'

/**
 * Layout for all signed-in users (employee/manager/admin).
 * Centralises the auth gate so individual pages don't repeat `redirect('/login')`.
 *
 * Pages inside this group still call AppShell themselves with their own title/subtitle/actions
 * — this layout only validates the session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
