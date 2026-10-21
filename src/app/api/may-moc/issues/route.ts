import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { issuesService } from '@/modules/core/assets/issues.service'
import { issueCreateSchema } from '@/modules/core/assets/assets.schema'

/** Báo hỏng — mọi người đăng nhập. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const issue = await issuesService.create(user, await parseJson(req, issueCreateSchema))
  return NextResponse.json({ issue }, { status: 201 })
})
