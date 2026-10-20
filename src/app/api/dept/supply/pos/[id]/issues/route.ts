import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poTrackingService } from '@/modules/dept/supply/po-tracking.service'
import { issueSchema } from '@/modules/dept/supply/po-tracking.schema'

type Params = { params: Promise<{ id: string }> }

/** Sổ hẹn giao + sổ sự cố của đơn (0213) — ai mở được đơn cũng xem được. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await poTrackingService.forPo(user, id))
})

/** Ghi một sự cố giao hàng — Cung ứng hoặc Kho. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, issueSchema)
  return NextResponse.json(await poTrackingService.addIssue(user, id, input))
})
