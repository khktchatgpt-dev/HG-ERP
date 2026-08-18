import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { accountService } from '@/modules/core/account/account.service'
import { UserMenu } from '@/components/UserMenu'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { hasCrossRole, userHomeWorkspaceId } from '@/workspaces/access'
import { ACCENT_CLASSES, type WorkspaceConfig } from '@/workspaces/workspaces.config'
import { MobileNav } from './MobileNav'
import { TopbarSearch } from './TopbarSearch'

export async function WorkspaceTopbar({
  workspace,
  title,
  subtitle,
  actions,
}: {
  workspace: WorkspaceConfig
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) return null
  const [unread, avatarUrl] = await Promise.all([
    notificationsService.unreadCount(user),
    accountService.avatarUrl(user),
  ])
  // Đang xem chéo workspace phòng khác → nhắc "chỉ xem" để khỏi bất ngờ khi
  // không thấy nút sửa (quyền ghi thật vẫn do service quyết theo phòng chủ quản).
  // Chỉ áp cho NV thường: admin/manager có quyền thao tác rộng (duyệt, sửa) ở
  // hầu hết workspace, và phòng có vai trò tác nghiệp chéo (hasCrossRole — vd
  // Cung ứng định hình trong Sản xuất) cũng không phải "chỉ xem".
  const accent = ACCENT_CLASSES[workspace.accent]
  const homeId = await userHomeWorkspaceId(user)
  // Gia đình SX (0087): NV xưởng coi team/stat/prodplan/production đều là nhà.
  const PRODUCTION_FAMILY = ['production', 'team', 'stat', 'prodplan']
  const isHome =
    homeId === workspace.id ||
    (homeId === 'production' && PRODUCTION_FAMILY.includes(workspace.id))
  const crossViewing =
    user.role === 'employee' && !isHome && !(await hasCrossRole(user, workspace.id))

  return (
    // Topbar theo thiết kế v3 (/design-lab mục 02): breadcrumb chữ thay pill màu.
    // VẠCH ACCENT mỏng giữ lại làm danh tính phòng — mobile không thấy sidebar
    // nên đây là dấu hiệu "đang ở khu nào" duy nhất luôn trong tầm mắt.
    <header className="bg-card/85 sticky top-0 z-10 border-b backdrop-blur">
      <div className={`h-0.5 ${accent.bg}`} />
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileNav workspace={workspace} />
          <nav className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
            <Link
              href={`${workspace.route}/`}
              className={`text-muted-foreground hover:text-foreground hidden transition-colors sm:inline ${
                title ? '' : 'text-foreground font-medium'
              }`}
            >
              {workspace.label}
            </Link>
            {title && (
              <ChevronRight
                className="text-muted-foreground hidden size-3.5 shrink-0 sm:block"
                aria-hidden
              />
            )}
            {title && (
              <span className="text-foreground truncate font-medium">{title}</span>
            )}
          </nav>
          {crossViewing && (
            <span className="rounded-md border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warn)]">
              Chỉ xem
            </span>
          )}
          {subtitle && (
            <p className="text-muted-foreground hidden truncate text-xs lg:block">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <TopbarSearch />
          <NotificationsDropdown initialUnread={unread} />
          <UserMenu
            user={{
              name: user.name,
              email: user.email,
              role: user.role,
              title: user.title,
            }}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </header>
  )
}
