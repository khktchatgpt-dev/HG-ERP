import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const unreadOnly = new URL(req.url).searchParams.get('unread') === '1'
  const [items, unread] = await Promise.all([
    notificationsService.listMine(user, { unreadOnly }),
    notificationsService.unreadCount(user),
  ])
  return NextResponse.json({ notifications: items, unread })
})

export const POST = handle(async () => {
  const user = await authService.requireUser()
  await notificationsService.markAllRead(user)
  return NextResponse.json({ ok: true })
})
