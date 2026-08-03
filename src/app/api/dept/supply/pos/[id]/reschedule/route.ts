import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poRescheduleSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Dời hẹn giao đơn đã duyệt/đã gửi — chỉ ngày + lý do, không đụng tiền/dòng hàng. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poRescheduleSchema)
  const po = await posService.reschedule(user, id, input)
  return NextResponse.json({ po })
})
