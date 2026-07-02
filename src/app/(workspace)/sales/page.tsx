import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES, ACCENT_CLASSES } from '@/workspaces/workspaces.config'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'

const workspace = WORKSPACES.sales

export default async function SalesHomePage() {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  // 3 widget dummy — sẽ đấu số liệu thật ở Phase sau.
  const { total: customerCount } = await salesService.list(user, {
    page: 1,
    page_size: 1,
    active_only: true,
  })

  const accent = ACCENT_CLASSES[workspace.accent]

  return (
    <WorkspaceShell
      workspace={workspace}
      title="Trang chủ Sales"
      subtitle={`Chào ${user.name ?? user.email}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Widget
          label="Khách hàng đang active"
          value={customerCount.toString()}
          hint="Cập nhật realtime"
          accentBg={accent.bg}
        />
        <Widget
          label="Doanh thu tháng này"
          value="—"
          hint="Chưa nối module doanh thu"
          accentBg={accent.bg}
        />
        <Widget
          label="Đơn hàng chờ"
          value="—"
          hint="Chưa nối module đơn"
          accentBg={accent.bg}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink href="/sales/customers" title="Danh sách khách hàng" desc="CRUD, phân KH cho sales, tìm kiếm" />
          <QuickLink href="/tasks" title="Công việc của tôi" desc="Task được giao cho bạn" />
        </div>
      </div>
    </WorkspaceShell>
  )
}

function Widget({
  label,
  value,
  hint,
  accentBg,
}: {
  label: string
  value: string
  hint: string
  accentBg: string
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accentBg}`} />
        <span className="text-xs font-medium uppercase text-zinc-500">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{hint}</div>
    </div>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </a>
  )
}
