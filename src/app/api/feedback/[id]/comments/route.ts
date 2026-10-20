import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackCommentCreateSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string }> }

/** Thêm dòng trao đổi (hoặc "vẫn cần chỉnh thêm" khi `needs_more`). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, feedbackCommentCreateSchema)
  const comment = await feedbackService.addComment(user, id, input)
  return NextResponse.json({ comment }, { status: 201 })
})
