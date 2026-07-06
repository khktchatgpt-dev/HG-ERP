import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { isHRStaff } from '@/modules/dept/hr/hr.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'

const workspace = WORKSPACES.hr

export default async function HRHomePage() {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isHRStaff(user))
  if (!allowed) redirect('/')

  return (
    <WorkspaceShell
      workspace={workspace}
      title="Trang chủ Nhân sự"
      subtitle={`Chào ${user.name ?? user.email}`}
    >
      <div className="mt-2">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/hr/leave"
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <div className="font-medium">Duyệt nghỉ phép</div>
            <div className="mt-1 text-xs text-zinc-500">
              Xem và duyệt đơn nghỉ phép của nhân viên
            </div>
          </Link>
          <Link
            href="/hr/leave/mine"
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <div className="font-medium">Đơn nghỉ phép của tôi</div>
            <div className="mt-1 text-xs text-zinc-500">Gửi và theo dõi đơn của bạn</div>
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  )
}
