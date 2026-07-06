import { authService } from '@/modules/core/auth/auth.service'
import { leaveService } from '@/modules/dept/hr/hr.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { LeaveManager } from './LeaveManager'

type Scope = 'mine' | 'pending' | 'all'

/**
 * Màn nghỉ phép dùng chung cho:
 *  • /hr/leave        (duyệt — mặc định scope 'pending')
 *  • /hr/leave/mine   (đơn của tôi — scope 'mine')
 * Nếu user không đủ quyền xem scope yêu cầu → tự lùi về 'mine'.
 */
export async function LeaveScreen({ scope }: { scope: Scope }) {
  const user = (await authService.currentUser())!

  let effScope: Scope = scope
  let data
  try {
    data = await leaveService.list(user, { scope, page: 1, page_size: 50 })
  } catch {
    effScope = 'mine'
    data = await leaveService.list(user, { scope: 'mine', page: 1, page_size: 50 })
  }

  const canApprove = user.role === 'manager' || user.role === 'admin'
  const title = effScope === 'mine' ? 'Đơn nghỉ phép của tôi' : 'Duyệt nghỉ phép'

  return (
    <WorkspaceShell
      workspace={WORKSPACES.hr}
      title={title}
      subtitle={`${data.total} đơn`}
    >
      <LeaveManager
        rows={data.rows}
        scope={effScope}
        canApprove={canApprove}
        currentUserId={user.id}
      />
    </WorkspaceShell>
  )
}
