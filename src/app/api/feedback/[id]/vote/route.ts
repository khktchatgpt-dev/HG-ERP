import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'

type Params = { params: Promise<{ id: string }> }

/** Bật / tắt "tôi cũng gặp" (không tự vote góp ý của mình). */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await feedbackService.toggleVote(user, id))
})
