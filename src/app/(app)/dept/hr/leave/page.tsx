import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { leaveService } from '@/modules/dept/hr/hr.service'
import { AppShell } from '@/components/AppShell'
import { LeaveManager } from './LeaveManager'

export default async function HRLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: 'mine' | 'pending' | 'all' }>
}) {
  const user = (await authService.currentUser())!
  const sp = await searchParams
  // Default to "mine" for everyone; managers can flip to "pending".
  const scope = sp.scope ?? 'mine'

  let data
  try {
    data = await leaveService.list(user, { scope, page: 1, page_size: 50 })
  } catch {
    // Fall back to mine if user doesn't have perm for the requested scope.
    data = await leaveService.list(user, { scope: 'mine', page: 1, page_size: 50 })
  }

  const canApprove = user.role === 'manager' || user.role === 'admin'

  return (
    <AppShell
      title="Đơn nghỉ phép"
      subtitle={`${data.total} đơn`}
    >
      <LeaveManager
        rows={data.rows}
        scope={scope}
        canApprove={canApprove}
        currentUserId={user.id}
      />
    </AppShell>
  )
}
