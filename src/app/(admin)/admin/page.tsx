import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { db } from '@/server/db'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'

const ACTION_LABEL: Record<string, string> = {
  create: 'Tạo',
  update: 'Cập nhật',
  password_reset: 'Reset PW',
  soft_delete: 'Xoá',
  restore: 'Khôi phục',
  bulk_import: 'Import',
}

export default async function AdminOverview() {
  const user = (await authService.currentUser())!

  const [users, departments, recentAudit] = await Promise.all([
    usersService.list(user, { includeInactive: true, includeDeleted: true }),
    departmentsService.list(),
    db()
      .from('user_audit_log')
      .select('id, target_user_id, actor_id, action, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const byRole = { admin: 0, manager: 0, employee: 0 }
  let inactive = 0
  let deleted = 0
  for (const u of users) {
    if (u.deleted_at) deleted++
    else if (!u.is_active) inactive++
    else byRole[u.role]++
  }
  const activeTotal = byRole.admin + byRole.manager + byRole.employee
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Quản trị' }]}
          title="Tổng quan hệ thống"
          description="Trạng thái tài khoản, phòng ban và thao tác gần đây."
          actions={
            <span className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              Ctrl+K để tìm nhanh
            </span>
          }
        />

        <StatsBar
          stats={[
            { label: 'Hoạt động', value: activeTotal, tone: 'green', hint: 'Đang truy cập' },
            { label: 'Quản trị', value: byRole.admin, tone: 'purple' },
            { label: 'Quản lý', value: byRole.manager, tone: 'blue' },
            { label: 'Nhân viên', value: byRole.employee, tone: 'gray' },
            { label: 'Đã khoá', value: inactive, tone: inactive ? 'amber' : 'gray' },
            { label: 'Đã xoá', value: deleted, tone: deleted ? 'red' : 'gray' },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent audit — 2 cột */}
          <section className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Thao tác gần đây
              </h2>
              <Link href="/admin/audit" className="text-xs text-zinc-500 hover:underline">
                Xem tất cả →
              </Link>
            </div>
            {(recentAudit.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                Chưa có thao tác nào được ghi.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <tr>
                      <th className="px-3 py-2">Thời gian</th>
                      <th className="px-3 py-2">Hành động</th>
                      <th className="px-3 py-2">Mục tiêu</th>
                      <th className="px-3 py-2">Bởi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {(recentAudit.data ?? []).map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-1.5 text-xs text-zinc-500">
                          {new Date(e.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-3 py-1.5 font-medium">
                          {ACTION_LABEL[e.action] ?? e.action}
                        </td>
                        <td className="px-3 py-1.5">
                          {userMap.get(e.target_user_id) ?? e.target_user_id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-500">
                          {e.actor_id ? userMap.get(e.actor_id) ?? '—' : 'Hệ thống'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Quick actions — 1 cột */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Thao tác nhanh
            </h2>
            <div className="flex flex-col gap-2">
              <QuickAction href="/admin/users?new=1" title="+ Tạo tài khoản mới" />
              <QuickAction href="/admin/users?import=1" title="Import Excel người dùng" />
              <QuickAction href="/admin/departments" title="Quản lý phòng ban" />
              <QuickAction href="/admin/health" title="Kiểm tra sức khoẻ hệ thống" />
              <QuickAction href="/admin/settings" title="Cấu hình công ty" />
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="font-semibold text-zinc-700 dark:text-zinc-300">💡 Mẹo</div>
              <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                Bấm <kbd className="rounded bg-white px-1 py-0.5 text-[10px] dark:bg-zinc-950">Ctrl+K</kbd> ở bất kỳ đâu để mở bảng lệnh nhanh.
              </div>
            </div>
          </section>
        </div>

      <p className="text-xs text-zinc-400">
        {users.length} tài khoản • {departments.length} phòng ban
      </p>
    </div>
  )
}

function QuickAction({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      {title}
    </Link>
  )
}
