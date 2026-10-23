import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackReviewersSchema } from '@/modules/core/feedback/feedback.schema'

/** Người xác nhận hiện tại + ứng viên. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await feedbackService.reviewers(user))
})

/** Admin hệ thống đổi người xác nhận; mảng rỗng = tắt cửa. */
export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, feedbackReviewersSchema)
  const ids = await feedbackService.setReviewers(user, input.ids)
  return NextResponse.json({ ids })
})
