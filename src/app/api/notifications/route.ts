import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { notificationsService } from '@/modules/core/notifications/notifications.service'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams
  const unreadOnly = sp.get('unread') === '1'
  // `bell=1`: hộp chuông — chỉ loại việc giao (lib/bell-types), số đỏ đếm cùng tập.
  if (sp.get('bell') === '1') {
    const [items, unread] = await Promise.all([
      notificationsService.listBell(user),
      notificationsService.unreadBellCount(user),
    ])
    return NextResponse.json({ notifications: items, unread })
  }
  const [items, unread] = await Promise.all([
    notificationsService.listMine(user, { unreadOnly }),
    notificationsService.unreadCount(user),
  ])
  return NextResponse.json({ notifications: items, unread })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  if (new URL(req.url).searchParams.get('bell') === '1') {
    await notificationsService.markBellRead(user)
  } else {
    await notificationsService.markAllRead(user)
  }
  return NextResponse.json({ ok: true })
})
