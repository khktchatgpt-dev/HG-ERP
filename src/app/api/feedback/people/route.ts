import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'

/** Danh sách người đang hoạt động (id, tên) — cho nhắc tên @ trong trao đổi. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ people: await feedbackService.people(user) })
})
