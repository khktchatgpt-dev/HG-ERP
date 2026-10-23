import { NextResponse } from 'next/server'
import { handle, parseJson, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { issuesService } from '@/modules/core/assets/issues.service'
import {
  issueAcceptSchema,
  issueCancelSchema,
  issueDoneSchema,
  issueRejectSchema,
} from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string; action: string }> }

/** Chuyển trạng thái phiếu báo hỏng: accept · approve · reject · done · cancel. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, action } = await params
  switch (action) {
    case 'accept':
      return NextResponse.json({
        issue: await issuesService.accept(
          user,
          id,
          await parseJson(req, issueAcceptSchema),
        ),
      })
    case 'approve':
      return NextResponse.json({ issue: await issuesService.approve(user, id) })
    case 'reject':
      return NextResponse.json({
        issue: await issuesService.reject(
          user,
          id,
          (await parseJson(req, issueRejectSchema)).reason,
        ),
      })
    case 'done':
      return NextResponse.json({
        issue: await issuesService.done(user, id, await parseJson(req, issueDoneSchema)),
      })
    case 'cancel':
      return NextResponse.json({
        issue: await issuesService.cancel(
          user,
          id,
          (await parseJson(req, issueCancelSchema)).reason,
        ),
      })
    default:
      throw NotFound('Không có thao tác này')
  }
})
