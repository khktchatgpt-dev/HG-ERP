import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import {
  feedbackWeeklyQuerySchema,
  feedbackWeeklyUpsertSchema,
} from '@/modules/core/feedback/feedback.schema'

/** Từng tuần (thứ Hai → Chủ nhật): góp ý mới, việc xong, bản tóm tắt. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), feedbackWeeklyQuerySchema)
  return NextResponse.json({ weeks: await feedbackService.weekly(user, q.weeks) })
})

/** Admin / BOD lưu tóm tắt tuần (mỗi dòng một thay đổi; dòng `# ` là tên nhóm). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, feedbackWeeklyUpsertSchema)
  const update = await feedbackService.weeklyUpsert(user, input)
  return NextResponse.json({ update })
})
