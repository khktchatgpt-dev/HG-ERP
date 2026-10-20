import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackUpdateSchema } from '@/modules/core/feedback/feedback.schema'

type Params = { params: Promise<{ id: string }> }

/** Một góp ý + luồng trao đổi. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await feedbackService.get(user, id))
})

/** Người viết tự sửa (theo luật) / admin. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, feedbackUpdateSchema)
  const feedback = await feedbackService.update(user, id, input)
  return NextResponse.json({ feedback })
})

/** Người viết xoá khi chưa tiếp nhận / admin xoá bất kỳ — xoá cả luồng. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await feedbackService.remove(user, id)
  return new NextResponse(null, { status: 204 })
})
