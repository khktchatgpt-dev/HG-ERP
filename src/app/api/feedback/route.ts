import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import {
  feedbackCreateSchema,
  feedbackListQuerySchema,
} from '@/modules/core/feedback/feedback.schema'

/** Danh sách góp ý (+ đếm theo trạng thái, cờ vai của người xem). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), feedbackListQuerySchema)
  return NextResponse.json(await feedbackService.list(user, q.scope))
})

/** Ghi góp ý mới (từ hộp ghi nhanh trên mọi trang). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, feedbackCreateSchema)
  const feedback = await feedbackService.create(user, input)
  return NextResponse.json({ feedback }, { status: 201 })
})
