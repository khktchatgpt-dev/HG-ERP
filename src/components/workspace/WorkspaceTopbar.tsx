import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { UserMenu } from '@/components/UserMenu'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { ACCENT_CLASSES, type WorkspaceConfig } from '@/workspaces/workspaces.config'

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
  const unread = await notificationsService.unreadCount(user)
  const accent = ACCENT_CLASSES[workspace.accent]

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      {/* Accent bar mỏng để phân biệt workspace nhanh bằng mắt */}
      <div className={`h-0.5 ${accent.bg}`} />
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`hidden rounded px-2 py-0.5 text-[10px] font-semibold uppercase text-white sm:inline ${accent.bg}`}>
            {workspace.short}
          </span>
          <div className="min-w-0">
            {title && (
              <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            )}
            {subtitle && (
              <p className="truncate text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <NotificationsDropdown initialUnread={unread} />
          <UserMenu
            user={{
              name: user.name,
              email: user.email,
              role: user.role,
              title: user.title,
            }}
          />
        </div>
      </div>
    </header>
  )
}
