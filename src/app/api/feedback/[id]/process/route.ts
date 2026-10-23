import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackProcessSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string }> }

/** Admin / BOD xử lý: trạng thái (kể cả kéo thả kanban), chủ đề, trả lời. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, feedbackProcessSchema)
  const feedback = await feedbackService.process(user, id, input)
  return NextResponse.json({ feedback })
})
