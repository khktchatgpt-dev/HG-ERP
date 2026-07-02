import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { UserMenu } from '@/components/UserMenu'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'

export async function Topbar({
  title,
  subtitle,
  actions,
}: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const user = await authService.currentUser()
  if (!user) return null
  const unread = await notificationsService.unreadCount(user)

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
      <div className="min-w-0">
        {title && (
          <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
        )}
        {subtitle && (
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        )}
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
    </header>
  )
}
