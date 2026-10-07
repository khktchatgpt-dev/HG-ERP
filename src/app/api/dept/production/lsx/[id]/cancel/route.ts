import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxCancelSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Huỷ lệnh đã phát hành — bắt lý do; đơn về Xác nhận; báo xưởng + Cung ứng. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, lsxCancelSchema)
  return NextResponse.json({ lsx: await lsxService.cancel(user, id, reason) })
})
