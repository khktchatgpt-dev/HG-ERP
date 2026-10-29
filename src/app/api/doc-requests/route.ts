import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docRequestsService } from '@/modules/core/doc-notes/doc-requests.service'
import { requestCreateSchema, requestListQuerySchema } from '@/lib/doc-requests'

/**
 * YÊU CẦU VIỆC TRÊN CHỨNG TỪ (0281).
 *
 *   GET  ?tab=assigned|given&filter=open|overdue|done|cancelled
 *        → yêu cầu của người đang đăng nhập + số trên từng chip
 *   POST { doc_type: 'po'|'lsx', doc_id, assignee_id, due_on?, body } → giao việc
 *
 * Bước trên một yêu cầu (báo xong / mở lại / chuyển / huỷ): POST /api/doc-requests/[id].
 */

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), requestListQuerySchema)
  return NextResponse.json(await docRequestsService.listMine(user, q))
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, requestCreateSchema)
  const request = await docRequestsService.create(user, input)
  return NextResponse.json({ request }, { status: 201 })
})
