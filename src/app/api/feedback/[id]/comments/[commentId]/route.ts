import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackCommentUpdateSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string; commentId: string }> }

/** Sửa dòng trao đổi của mình (khi chưa ai viết sau). */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, commentId } = await params
  const input = await parseJson(req, feedbackCommentUpdateSchema)
  const comment = await feedbackService.updateComment(user, id, commentId, input)
  return NextResponse.json({ comment })
})

/** Xoá dòng trao đổi của mình (khi chưa ai viết sau) / admin. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, commentId } = await params
  await feedbackService.deleteComment(user, id, commentId)
  return new NextResponse(null, { status: 204 })
})
