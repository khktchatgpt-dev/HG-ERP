import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxRejectSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** GĐ từ chối LSX → đơn về 'confirmed', báo người phát (FR-SAL-06). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, lsxRejectSchema)
  const lsx = await lsxService.reject(user, id, reason)
  return NextResponse.json({ lsx })
})
