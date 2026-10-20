import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poTrackingService } from '@/modules/dept/supply/po-tracking.service'
import { resolveIssueSchema } from '@/modules/dept/supply/po-tracking.schema'

type Params = { params: Promise<{ id: string }> }

/** Đóng sự cố kèm cách xử lý (đổi hàng, trả NCC, NCC giao bù…). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { resolution } = await parseJson(req, resolveIssueSchema)
  await poTrackingService.resolveIssue(user, id, resolution)
  return NextResponse.json({ ok: true })
})
