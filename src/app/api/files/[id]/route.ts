import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { url, expiresIn } = await filesService.getDownloadTarget(user, id)
  // `private` vì URL gắn quyền của chính user này — không được để CDN dùng chung.
  // max-age bám đúng hạn token: cache lâu hơn là phát ra URL đã chết.
  return NextResponse.json(
    { url },
    { headers: { 'cache-control': `private, max-age=${expiresIn}` } },
  )
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await filesService.delete(user, id)
  return NextResponse.json({ ok: true })
})
