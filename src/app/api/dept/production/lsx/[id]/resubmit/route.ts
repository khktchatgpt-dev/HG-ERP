import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxResubmitSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Sales gửi duyệt lại LSX bị từ chối (sửa kèm header) → chờ GĐ duyệt lại. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, lsxResubmitSchema)
  const lsx = await lsxService.resubmit(user, id, input)
  return NextResponse.json({ lsx })
})
