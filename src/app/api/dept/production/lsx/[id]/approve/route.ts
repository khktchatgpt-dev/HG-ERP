import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

type Params = { params: Promise<{ id: string }> }

/** GĐ duyệt LSX → đơn sang 'lsx_issued', báo các bộ phận (FR-SAL-06). */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const lsx = await lsxService.approve(user, id)
  return NextResponse.json({ lsx })
})
