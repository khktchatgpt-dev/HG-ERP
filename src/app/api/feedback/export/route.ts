import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { feedbackExportQuerySchema } from '@/modules/core/feedback/feedback.schema'

/** Markdown toàn bộ góp ý N ngày gần đây — đưa trợ lý AI đọc (admin / BOD). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), feedbackExportQuerySchema)
  const md = await feedbackService.exportMarkdown(user, q.days)
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="gop-y_${q.days}-ngay_${stamp}.md"`,
      'cache-control': 'no-store',
    },
  })
})
