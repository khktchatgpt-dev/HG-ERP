import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'

type Params = { params: Promise<{ id: string }> }

/** Người viết bấm "Đã ổn" khi góp ý đã đẩy online — khép vòng. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const feedback = await feedbackService.confirmOk(user, id)
  return NextResponse.json({ feedback })
})
