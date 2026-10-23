import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackResubmitSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string }> }

/** Người viết gửi lại góp ý bị trả lại → chờ xác nhận. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, feedbackResubmitSchema)
  const feedback = await feedbackService.resubmit(user, id, input.content)
  return NextResponse.json({ feedback })
})
