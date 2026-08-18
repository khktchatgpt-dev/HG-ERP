import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { filesService } from '@/modules/core/files/files.service'

type Params = { params: Promise<{ id: string }> }

/**
 * `?download=1` → URL ép tải về kèm ĐÚNG tên gốc. Không có tham số thì trả URL
 * xem trực tiếp (ảnh, PDF) như cũ — cùng endpoint phục vụ cả hai việc.
 */
export const GET = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const asAttachment = new URL(req.url).searchParams.get('download') === '1'
  const { url, expiresIn } = await filesService.getDownloadTarget(user, id, asAttachment)
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
