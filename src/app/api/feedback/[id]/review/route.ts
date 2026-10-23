import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackReviewSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string }> }

/** Người xác nhận: đồng ý (chuyển đội phát triển) hoặc trả lại kèm lý do. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, feedbackReviewSchema)
  const feedback = await feedbackService.review(user, id, input)
  return NextResponse.json({ feedback })
})
