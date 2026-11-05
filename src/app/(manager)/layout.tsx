import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'

/**
 * Guard for routes only available to managers + admins:
 *   - /team        (team dashboard for dept heads)
 *   - /reports/*   (weekly report)
 *
 * Employees attempting to visit are redirected to their task list.
 * Pages still wrap their content in <AppShell> themselves.
 */
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'manager' && user.role !== 'admin') {
    redirect('/phan-cong-viec')
  }
  return <>{children}</>
}
