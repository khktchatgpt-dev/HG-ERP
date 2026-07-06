import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import {
  invoicesService,
  isAccountingStaff,
} from '@/modules/dept/accounting/accounting.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES, ACCENT_CLASSES } from '@/workspaces/workspaces.config'

const workspace = WORKSPACES.finance

export default async function FinanceHomePage() {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isAccountingStaff(user))
  if (!allowed) redirect('/')

  const { total } = await invoicesService.list(user, { page: 1, page_size: 1 })
  const accent = ACCENT_CLASSES[workspace.accent]

  return (
    <WorkspaceShell
      workspace={workspace}
      title="Trang chủ Tài chính - Kế toán"
      subtitle={`Chào ${user.name ?? user.email}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
            <span className="text-xs font-medium text-zinc-500 uppercase">Hoá đơn</span>
          </div>
          <div className="mt-2 text-3xl font-semibold">{total}</div>
          <div className="mt-1 text-xs text-zinc-400">Tổng số hoá đơn</div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/finance/invoices"
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <div className="font-medium">Hoá đơn</div>
            <div className="mt-1 text-xs text-zinc-500">
              Quản lý hoá đơn mua/bán, công nợ
            </div>
          </Link>
          <Link
            href="/tasks"
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <div className="font-medium">Công việc của tôi</div>
            <div className="mt-1 text-xs text-zinc-500">Task được giao cho bạn</div>
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  )
}
